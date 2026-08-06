import "server-only";

/**
 * Server-side port of the extension's tripWatch.js (detectTripChanges /
 * describeTripChange). Change detection moved from the browser (comparing
 * local chrome.storage snapshots) to here, comparing each incoming trip
 * against its existing DB row. This is more robust than the original: it
 * survives an extension reinstall and works the same whether the host syncs
 * from one browser or five, since the source of truth is now the database
 * row, not a per-install snapshot.
 *
 * Same two change types as the original, with the same guards:
 *  - a trip newly showing as cancelled that wasn't before
 *  - a reschedule (date, time, or plate changed) — but only compared when
 *    BOTH the existing and incoming records have a "reliable" date, exactly
 *    like the original's hasReliableDate() guard. An inherited/unreliable
 *    date (e.g. an "Upcoming"/"Completed" skip whose date comes from a page
 *    section header, not its own line) must never trigger a false
 *    "rescheduled" event.
 * A trip with no existing row is a first sighting and is never reported as
 * a change, matching the original's behavior of not flooding alerts right
 * after the first-ever sync.
 */

export interface IncomingTrip {
  reservation: string;
  action: "checkin" | "checkout" | "skip" | null;
  skipReason: string | null;
  guestName: string | null;
  plate: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  extras: { label: string; quantity: number }[];
  dateLabel: string | null;
  startTs: number | null;
  endTs: number | null;
}

export interface ExistingTripRow {
  id: string;
  action: string | null;
  skip_reason: string | null;
  plate: string | null;
  date_label: string | null;
  start_ts: string | null;
  end_ts: string | null;
}

export type TripEventKind = "created" | "rescheduled" | "cancelled" | "plate_changed";

export interface TripEventCandidate {
  kind: TripEventKind;
  description: string;
  payload: { before: ExistingTripRow | null; after: IncomingTrip };
}

function isCancelledTrip(action: string | null, skipReason: string | null): boolean {
  return action === "skip" && !!skipReason && /cancell?ed/i.test(skipReason);
}

/** True only if the record's date can be trusted: an actual checkin/checkout, or a skip whose status line itself carries a live date ("Started", "In progress"). */
function isReliable(action: string | null, skipReason: string | null): boolean {
  if (action === "checkin" || action === "checkout") return true;
  if (action === "skip" && skipReason && /^(started|in progress)/i.test(skipReason)) return true;
  return false;
}

function describeAction(action: string | null): string {
  if (action === "checkin") return "Check-in";
  if (action === "checkout") return "Check-out";
  return "Trip";
}

/**
 * Compares one incoming trip against its existing DB row (null if this
 * reservation has never been synced before) and returns a trip_events
 * candidate, or null if nothing worth recording changed.
 */
export function diffTrip(existing: ExistingTripRow | null, incoming: IncomingTrip): TripEventCandidate | null {
  if (!existing) return null;

  const wasCancelled = isCancelledTrip(existing.action, existing.skip_reason);
  const nowCancelled = isCancelledTrip(incoming.action, incoming.skipReason);

  if (nowCancelled && !wasCancelled) {
    return {
      kind: "cancelled",
      description: `Trip was cancelled (was ${describeAction(existing.action)}${
        existing.date_label ? `, ${existing.date_label}` : ""
      })`,
      payload: { before: existing, after: incoming },
    };
  }

  if (!isReliable(existing.action, existing.skip_reason) || !isReliable(incoming.action, incoming.skipReason)) {
    return null;
  }

  const plateChanged = (existing.plate ?? null) !== (incoming.plate ?? null);

  if (plateChanged) {
    return {
      kind: "plate_changed",
      description: `Vehicle changed from ${existing.plate ?? "unknown"} to ${incoming.plate ?? "unknown"}`,
      payload: { before: existing, after: incoming },
    };
  }

  const dateChanged = (existing.date_label ?? null) !== (incoming.dateLabel ?? null);

  const existingTs = incoming.action === "checkout" ? existing.end_ts : existing.start_ts;
  const incomingTsMs = incoming.action === "checkout" ? incoming.endTs : incoming.startTs;
  const incomingTs = incomingTsMs ? new Date(incomingTsMs).toISOString() : null;
  const timeChanged = (existingTs ?? null) !== (incomingTs ?? null);

  if (!dateChanged && !timeChanged) return null;

  return {
    kind: "rescheduled",
    description: `${describeAction(incoming.action)} moved ${existing.date_label ?? "?"} → ${
      incoming.dateLabel ?? "?"
    }`,
    payload: { before: existing, after: incoming },
  };
}
