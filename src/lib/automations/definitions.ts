import type { TuroEventKind } from "@/types/turo";

/**
 * The automation catalog.
 *
 * Rules live in code (not the database) because each one needs an executor
 * to mean anything — a row a host can toggle but that nothing reads would be
 * a lie. Supabase stores only the on/off state per host.
 *
 * Execution is NOT wired up yet: nothing in HostOS currently runs these on a
 * trigger. The UI says so plainly rather than implying automatic behavior
 * that doesn't happen.
 */

export type AutomationCategory = "messaging" | "operations" | "monitoring";

export interface AutomationDefinition {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  /** The synced-mail event that would fire this rule. */
  trigger: TuroEventKind;
  triggerLabel: string;
  action: string;
  /** True once an executor exists for this rule. All false in v0.1. */
  implemented: boolean;
  /** Whether the rule would act on a guest's behalf without review. */
  requiresReview: boolean;
  /** The host's own message this rule would send, from src/lib/host/templates.ts. */
  templateId?: string;
}

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    id: "auto_ack_message",
    name: "Acknowledge new guest messages",
    description:
      "Sends a short holding reply so a guest isn't left waiting while you're driving or asleep.",
    category: "messaging",
    trigger: "message",
    triggerLabel: "A guest message arrives",
    action: "Send an acknowledgement drafted from your knowledge base",
    implemented: false,
    requiresReview: true,
  },
  {
    id: "draft_reply",
    name: "Draft replies for review",
    description:
      "Prepares a grounded reply for every inbound guest message and holds it for your approval. Never sends on its own.",
    category: "messaging",
    trigger: "message",
    triggerLabel: "A guest message arrives",
    action: "Draft a reply and queue it for review",
    implemented: false,
    requiresReview: false,
  },
  {
    id: "checkin_instructions",
    name: "Send check-in instructions",
    description:
      "Delivers lockbox and parking details ahead of pickup, using the check-in process from your Knowledge page.",
    category: "operations",
    trigger: "pickup",
    triggerLabel: "A trip is about to start",
    action: "Send your check-in instructions to the guest",
    implemented: false,
    requiresReview: true,
  },
  {
    id: "turnaround_reminder",
    name: "Flag turnaround windows",
    description:
      "Warns you when a return and the next pickup are close enough together that cleaning may not fit.",
    category: "operations",
    trigger: "return",
    triggerLabel: "A trip ends",
    action: "Raise a turnaround warning on your dashboard",
    implemented: false,
    requiresReview: false,
  },
  {
    id: "review_nudge",
    name: "Request a review",
    description: "Nudges guests who finished a trip without leaving a review.",
    category: "messaging",
    trigger: "return",
    triggerLabel: "A trip completes with no review",
    action: "Send a short review request",
    implemented: false,
    requiresReview: true,
  },
  {
    id: "escalation_watch",
    name: "Escalate urgent messages",
    description:
      "Watches for safety, accident, or lockout language and surfaces those messages above everything else.",
    category: "monitoring",
    trigger: "message",
    triggerLabel: "An urgent keyword is detected",
    action: "Pin the message and notify you immediately",
    implemented: false,
    requiresReview: false,
  },
];

export const CATEGORY_LABELS: Record<AutomationCategory, string> = {
  messaging: "Messaging",
  operations: "Operations",
  monitoring: "Monitoring",
};
