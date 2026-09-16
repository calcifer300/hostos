import "server-only";
import type { RecentGuestMessage } from "@/lib/messages/queries";
import type { Suggestion, SuggestionPriority } from "@/lib/dashboard/queries";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Butler's message-intelligence layer: scans guest messages the Companion
 * extension scraped in the last N hours (default 72 — see
 * getRecentGuestMessages) and turns the ones that read as an actual ask
 * into a ranked to-do, the same way a human ops manager triaging an inbox
 * would. Entirely rule-based regex matching, same as every other Suggestion
 * in src/lib/dashboard/queries.ts — no model call, no network, so it's
 * always available and always explainable ("why is this high priority?"
 * always has a one-line, inspectable answer).
 *
 * Deliberately biased toward over-surfacing rather than silently dropping a
 * real ask: text matching can't confirm an access request was actually
 * granted or an item actually shipped, so a match is shown as a reminder to
 * verify, not suppressed just because the thread later moved on to
 * something else.
 */

export type ButlerTaskCategory =
  | "emergency"
  | "access-request"
  | "lost-item"
  | "vehicle-issue"
  | "schedule-change"
  | "unanswered";

interface ClassificationRule {
  category: ButlerTaskCategory;
  priority: SuggestionPriority;
  label: string;
  pattern: RegExp;
}

/**
 * Order matters — first match wins, most severe first. A message can only
 * trip one rule; "locked out AND left my charger" surfaces as the lockout
 * (the guest needs to move right now), not the lost item.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    category: "emergency",
    priority: "high",
    label: "Urgent / safety",
    pattern:
      /\b(accident|stranded|emergency|tow(?:ed|ing)?|police|ambulance|flat tire|blow(?:n|out) tire|break ?down|broke down|crash(?:ed)?|injur(?:ed|y)|not safe|smoke|on fire|check engine light.*(?:red|flashing)|911)\b/i,
  },
  {
    category: "access-request",
    priority: "high",
    label: "Access request",
    pattern:
      /\b(tesla app|add(?:ing)? (?:my |your )?phone (?:to|on) (?:the )?(?:car|tesla|vehicle)|can'?t (?:get in|unlock|start|find the key)|won'?t (?:unlock|start)|locked out|lock ?box (?:code|won'?t|isn'?t|not)|access code (?:isn'?t|not|wrong)|gate code|key (?:isn'?t|not|won'?t) work|car (?:won'?t|wont) start|need access to the (?:car|vehicle)|share (?:my|the) location)\b/i,
  },
  {
    category: "lost-item",
    priority: "medium",
    label: "Possible lost item",
    pattern:
      /\b(left (?:my|a|an|behind|it in)|forgot (?:my|a|an|it in)|forgotten|lost (?:my|a|an item)|leave (?:anything|something) behind|missing (?:my|an? item)|did i leave|left in the car)\b/i,
  },
  {
    category: "vehicle-issue",
    priority: "medium",
    label: "Vehicle issue",
    pattern:
      /\b(dirty|smells? (?:bad|weird|like)|is broken|damage[d]?|not working|check engine|warning light|dead battery|won'?t charge|charging (?:issue|problem)|dispute|extra charge|charged me|refund)\b/i,
  },
  {
    category: "schedule-change",
    priority: "medium",
    label: "Schedule change",
    pattern: /\b(extend (?:my|the) trip|need (?:an )?extra day|running late|need more time|change (?:my|the) (?:pickup|return|drop.?off))\b/i,
  },
];

export function classifyMessageBody(body: string): ClassificationRule | null {
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(body)) return rule;
  }
  return null;
}

const TASK_TITLES: Record<ButlerTaskCategory, (guestName: string, vehicle: string) => string> = {
  emergency: (guestName) => `Urgent: check on ${guestName}`,
  "access-request": (guestName, vehicle) => `Confirm ${vehicle} access for ${guestName}`,
  "lost-item": (guestName, vehicle) => `Check ${vehicle} for ${guestName}'s item`,
  "vehicle-issue": (guestName, vehicle) => `Follow up on ${vehicle} with ${guestName}`,
  "schedule-change": (guestName) => `Confirm schedule change with ${guestName}`,
  unanswered: (guestName) => `Reply to ${guestName}`,
};

function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

/**
 * One task per (trip, category) — the newest matching message wins, so a
 * guest who mentions a lost item twice in the window doesn't produce two
 * identical cards. Deliberately independent of a trip's Guest Messages
 * "unread" flag: a host reply elsewhere in the thread doesn't prove an
 * access request was actually fulfilled or an item actually shipped, so
 * these keep surfacing until the window ages them out rather than
 * disappearing the moment any reply goes out.
 */
export function buildMessageButlerTasks(recentMessages: RecentGuestMessage[]): Suggestion[] {
  const bestPerKey = new Map<string, { message: RecentGuestMessage; rule: ClassificationRule }>();

  for (const message of recentMessages) {
    const rule = classifyMessageBody(message.body);
    if (!rule) continue;

    const key = `${message.tripId}:${rule.category}`;
    const existing = bestPerKey.get(key);
    if (!existing || new Date(message.resolvedAt).getTime() > new Date(existing.message.resolvedAt).getTime()) {
      bestPerKey.set(key, { message, rule });
    }
  }

  const tasks: Suggestion[] = Array.from(bestPerKey.values()).map(({ message, rule }) => ({
    id: `msg-${rule.category}-${message.tripId}`,
    title: TASK_TITLES[rule.category](message.guestName, message.vehicle),
    description: `${rule.label} · "${truncate(message.body)}" — ${message.guestName}, ${formatRelativeTime(message.resolvedAt)}${
      message.bookingStatus ? ` · ${message.bookingStatus}` : ""
    }`,
    priority: rule.priority,
    actionLabel: "Open conversation",
    href: `/app/messages/${encodeURIComponent(message.tripId)}`,
  }));

  const priorityRank: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };
  return tasks.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}
