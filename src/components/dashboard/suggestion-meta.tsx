import {
  AlertOctagon,
  KeyRound,
  PackageSearch,
  Wrench,
  CalendarClock,
  MessageCircleWarning,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Suggestion } from "@/lib/dashboard/queries";

/**
 * Suggestion.id carries its own origin as a prefix (see
 * buildSuggestions/buildMessageButlerTasks in src/lib/dashboard/queries.ts
 * and src/lib/butler/priority.ts) — "msg-access-request-<tripId>",
 * "overdue-msg-<tripId>", "prep-<id>", etc. Reading that prefix here keeps
 * Suggestion itself a plain server-safe data type (no JSX/icon references
 * inside a module that also runs in Server Components) while still letting
 * every card show a category-specific icon and label instead of a bare
 * priority badge.
 */
interface SuggestionMeta {
  icon: LucideIcon;
  label: string;
}

const PREFIX_META: [prefix: string, meta: SuggestionMeta][] = [
  ["msg-emergency-", { icon: AlertOctagon, label: "Urgent" }],
  ["msg-access-request-", { icon: KeyRound, label: "Access" }],
  ["msg-lost-item-", { icon: PackageSearch, label: "Lost item" }],
  ["msg-vehicle-issue-", { icon: Wrench, label: "Vehicle issue" }],
  ["msg-schedule-change-", { icon: CalendarClock, label: "Schedule" }],
  ["overdue-msg-", { icon: AlertOctagon, label: "Overdue" }],
  ["reply-", { icon: MessageCircleWarning, label: "Reply" }],
  ["prep-", { icon: Sparkles, label: "Prep" }],
  ["review-", { icon: Star, label: "Review" }],
];

const DEFAULT_META: SuggestionMeta = { icon: Sparkles, label: "Task" };

export function suggestionMeta(suggestion: Pick<Suggestion, "id">): SuggestionMeta {
  const match = PREFIX_META.find(([prefix]) => suggestion.id.startsWith(prefix));
  return match ? match[1] : DEFAULT_META;
}
