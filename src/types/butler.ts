/**
 * Domain types for the HostOS AI Butler — the one AI system behind fleet
 * messaging, restaurant support, briefings, search, suggestions and task
 * generation. These deliberately mirror the platform-agnostic vocabulary of
 * the HostOS architecture (Guest, Reservation, Conversation, Message) at the
 * scope the product needs — no Turo- or DoorDash-specific shapes leaking
 * past the connector boundary.
 */

/** The kinds of Turo-originated email an inbound message can represent. */
export type TuroEventType =
  | "guest_message"
  | "id_verification"
  | "reservation_time_change"
  | "new_booking"
  | "cancellation"
  | "other";

/** Raw input to the pipeline — the smallest useful shape of "a message arrived." */
export interface InboundTuroEmail {
  guestName: string;
  vehicle: string;
  subject: string;
  body: string;
  receivedAt: string;
}

/** The Butler's structured output for a single inbound message. */
export interface ButlerAnalysis {
  eventType: TuroEventType;
  summary: string;
  actionRequired: boolean;
  actionReason: string;
  draftReply: string | null;
  /** Set when a human must see this before anything else happens. */
  escalate: boolean;
  escalateReason: string | null;
}

/**
 * The Butler's "start my day" digest. Structured rather than one prose blob
 * so the dashboard can lay it out instead of rendering a wall of model text.
 */
export interface ButlerBriefing {
  /** One sentence covering the whole day, e.g. "Eight pickups, one license still unverified, two stores paused overnight." */
  headline: string;
  /** One short line per noteworthy item. */
  highlights: string[];
  /** What the operator should actually do, most important first. */
  priorities: string[];
  /** How many signals the briefing was generated from. */
  signalCount: number;
}

/** The host's operating context. Small on purpose. */
export interface HostKnowledgeBase {
  checkInProcess: string;
  houseRules: string;
  policy: string;
  tone: string;
}

/** A cited source shown next to a draft or an answer. */
export interface ButlerSource {
  title: string;
  url: string | null;
  kind: "knowledge" | "policy" | "template";
}

export interface ButlerDraft {
  draft: string;
  summary: string;
  escalate: boolean;
  escalateReason: string | null;
  sources: ButlerSource[];
}

export interface ButlerAnswer {
  answer: string;
  sources: ButlerSource[];
  /** True when the Butler found nothing authoritative and is saying so. */
  uncertain: boolean;
}
