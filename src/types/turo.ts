/**
 * Normalized events derived from synced Gmail messages.
 *
 * Turo's outbound email formats are not a published contract, so parsing is
 * deliberately best-effort: every extracted field is nullable and the parser
 * degrades to `other` rather than guessing. Nothing downstream may assume a
 * field is present.
 */

export type TuroEventKind =
  | "booking"
  | "pickup"
  | "return"
  | "message"
  | "cancellation"
  | "review"
  | "payment"
  | "verification"
  | "other";

export interface TuroEvent {
  /** The synced Gmail message id this was derived from. */
  id: string;
  kind: TuroEventKind;
  guestName: string | null;
  vehicle: string | null;
  subject: string | null;
  snippet: string | null;
  /** When the email arrived — always known. */
  occurredAt: string;
  /** Trip start parsed out of the body, when the email stated one. */
  tripStartsAt: string | null;
  /** Trip end parsed out of the body, when the email stated one. */
  tripEndsAt: string | null;
  isUnread: boolean;
}

/** A trip reconstructed from one or more related events. */
export interface TuroReservation {
  /** Stable key: thread id when available, else the earliest event id. */
  id: string;
  guestName: string | null;
  vehicle: string | null;
  status: "upcoming" | "active" | "completed" | "cancelled";
  bookedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Every event that contributed, newest first. */
  events: TuroEvent[];
}
