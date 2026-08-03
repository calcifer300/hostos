/**
 * Canonical domain types for the HostOS v0.1 vertical slice.
 *
 * These deliberately mirror the platform-agnostic vocabulary from the
 * HostOS system architecture (Guest, Reservation, Conversation, Message,
 * TimelineEvent) at the scope this MVP actually needs — no Trello
 * concepts, no Turo-specific shapes leaking past the connector boundary.
 */

/** The kinds of Turo-originated email an inbound message can represent. */
export type TuroEventType =
  | "guest_message"
  | "id_verification"
  | "reservation_time_change"
  | "new_booking"
  | "cancellation"
  | "other";

/** Raw input to the pipeline — the smallest useful shape of "an email arrived." */
export interface InboundTuroEmail {
  guestName: string;
  vehicle: string;
  subject: string;
  body: string;
  receivedAt: string;
}

/** iHost's structured output for a single inbound email. */
export interface IHostAnalysis {
  eventType: TuroEventType;
  summary: string;
  actionRequired: boolean;
  actionReason: string;
  draftReply: string | null;
  /** Article VII of the iHost Charter — set when a human must see this before anything else happens. */
  escalate: boolean;
  escalateReason: string | null;
}

/** The host's operating context. Deliberately small for v0.1 — see Knowledge Base article in the roadmap. */
export interface HostKnowledgeBase {
  checkInProcess: string;
  houseRules: string;
  policy: string;
  tone: string;
}
