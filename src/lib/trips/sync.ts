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
  /** Raw "10:00 AM"-style clock reading straight off the trip card — see resolvePacificTimestamp. */
  time?: string | null;
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

/**
 * The extension computes its own numeric startTs/endTs (pacificDateTimeToTimestamp
 * in its formatter.js) for the sync payload, but that path has proven
 * unreliable for check-outs specifically — its own popup UI shows correct
 * times because that display is built from the raw "10:00 AM" string
 * directly, never from the numeric field. Rather than keep chasing that bug
 * client-side, the raw dateLabel ("8/6") + time ("10:00 AM") strings are
 * sent alongside it and resolved into a timestamp here, server-side, where
 * it's actually testable. Mirrors the extension's own Pacific-offset trick
 * (guess UTC, measure the real Los Angeles offset via Intl, correct) so
 * both sides agree on what a bare wall-clock reading means.
 */
export function resolveTripTimestamp(
  dateLabel: string | null | undefined,
  time: string | null | undefined,
  timezone: string = "America/Los_Angeles",
  referenceDate: Date = new Date()
): string | null {
  if (!dateLabel || !time) return null;

  const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const isPM = /PM/i.test(timeMatch[3]);
  if (hour === 12) hour = 0;
  if (isPM) hour += 12;

  const dateParts = dateLabel.split("/");
  const month = parseInt(dateParts[0], 10);
  const day = parseInt(dateParts[1], 10);
  if (!month || !day) return null;

  // dateLabel carries no year — pick whichever of last/this/next year lands
  // closest to now, so a trip from a few months back and one a few weeks
  // out both resolve sensibly without hardcoding a cutover point.
  const refYear = referenceDate.getFullYear();
  let bestYear = refYear;
  let bestDiff = Infinity;
  for (const year of [refYear - 1, refYear, refYear + 1]) {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const diff = Math.abs(guess - referenceDate.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestYear = year;
    }
  }

  const guessUtc = Date.UTC(bestYear, month - 1, day, hour, minute);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(new Date(guessUtc)).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10)
  );

  const offset = asUtc - guessUtc;
  return new Date(guessUtc - offset).toISOString();
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
/**
 * Compares a stored timestamp against an incoming one AS INSTANTS, not as
 * strings.
 *
 * This was a string comparison, and the two sides are never formatted the same
 * way: PostgREST returns "2026-12-29T23:00:00+00:00" while the incoming value
 * is built with `new Date(ms).toISOString()`, which yields
 * "2026-12-29T23:00:00.000Z". Same instant, different text, so `timeChanged`
 * was true on every sync for every trip that had a timestamp at all.
 *
 * The sync runs once a minute, so that wrote a bogus "rescheduled" event per
 * trip per cycle — 10,180 of them across 49 trips before this was found, at
 * ~600/hour and growing, every one of them reading "Check-out moved 9/8 -> 9/8".
 * The activity feed was pure noise and the table grew ~14k rows a day.
 *
 * An unparseable stored value is treated as "changed" rather than silently
 * equal, so genuinely corrupt data still surfaces instead of being swallowed.
 */
function sameInstant(storedIso: string | null, incomingMs: number | null): boolean {
  if (storedIso === null && incomingMs === null) return true;
  if (storedIso === null || incomingMs === null) return false;

  const stored = new Date(storedIso).getTime();
  if (!Number.isFinite(stored)) return false;

  return stored === incomingMs;
}

/**
 * The timestamp this trip will actually be STORED with, in ms.
 *
 * Must mirror the write path in api/turo/sync/route.ts exactly: it takes the
 * extension's numeric startTs/endTs when present and otherwise derives one
 * from the raw dateLabel + time strings. Comparing against the raw numeric
 * alone made every trip whose numeric came back null (which is the documented
 * norm for check-outs — see resolvePacificTimestamp's comment) look like it
 * had changed, because the row on disk held the derived value instead.
 */
function effectiveIncomingMs(incoming: IncomingTrip): number | null {
  // A MergedTrip already carries both halves, resolved against the fleet's own
  // timezone. Preferring them keeps event detection on the same instants the
  // write path stores — otherwise a Denver trip would diff its Mountain start
  // against a Pacific re-derivation and report a reschedule on every sync.
  const merged = incoming as Partial<MergedTrip>;
  const resolved = incoming.action === "checkout" ? merged.resolvedEndTs : merged.resolvedStartTs;
  if (resolved) {
    const resolvedMs = new Date(resolved).getTime();
    if (Number.isFinite(resolvedMs)) return resolvedMs;
  }

  const raw = incoming.action === "checkout" ? incoming.endTs : incoming.startTs;
  if (raw !== null && raw !== undefined) return raw;

  // Only the field matching this trip's own action gets the derived fallback,
  // exactly as the write path does it.
  if (incoming.action !== "checkin" && incoming.action !== "checkout") return null;

  const derived = resolveTripTimestamp(incoming.dateLabel, incoming.time);
  if (!derived) return null;

  const ms = new Date(derived).getTime();
  return Number.isFinite(ms) ? ms : null;
}

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

  // Both sides must actually name a vehicle. A stored plate arriving as null is
  // a scrape that failed to read it, not a swap — reported live as "Vehicle
  // changed from DNIBOO to unknown", which would have a host chasing a vehicle
  // reassignment that never happened. Same rule as the timestamp check below:
  // losing information is not a change.
  const plateChanged =
    existing.plate !== null &&
    incoming.plate !== null &&
    existing.plate !== incoming.plate;

  if (plateChanged) {
    return {
      kind: "plate_changed",
      description: `Vehicle changed from ${existing.plate ?? "unknown"} to ${incoming.plate ?? "unknown"}`,
      payload: { before: existing, after: incoming },
    };
  }

  // A trip that flips between its check-in and check-out card is describing two
  // DIFFERENT moments of the same unchanged booking — pickup vs return — so its
  // date_label and timestamp are not comparable across that flip.
  //
  // Turo's board shows a reservation as "picking up" as pickup nears and as
  // "returning" later on, and the row keeps whichever card was seen last.
  // Without this guard every one of those normal transitions reported a
  // reschedule: an 8-day rental surfaced as "Check-out moved 12/21 → 12/29",
  // which is just its pickup date sitting next to its return date. Observed
  // live — 4 trips flipped in a single sync and produced exactly 4 such events.
  //
  // The trade is deliberate: a genuine reschedule landing in the same sync as an
  // action flip goes unreported, which is far better than firing one every time
  // a trip advances through its ordinary lifecycle.
  if ((existing.action ?? null) !== (incoming.action ?? null)) return null;

  const dateChanged = (existing.date_label ?? null) !== (incoming.dateLabel ?? null);

  const existingTs = incoming.action === "checkout" ? existing.end_ts : existing.start_ts;
  // Learning a timestamp we never held is enrichment, not a move. Only a known
  // value becoming a different known value counts as rescheduled.
  const timeChanged = existingTs !== null && !sameInstant(existingTs, effectiveIncomingMs(incoming));

  if (!dateChanged && !timeChanged) return null;

  return {
    kind: "rescheduled",
    description: `${describeAction(incoming.action)} moved ${existing.date_label ?? "?"} → ${
      incoming.dateLabel ?? "?"
    }`,
    payload: { before: existing, after: incoming },
  };
}

/** One reservation, after its check-in and check-out cards have been combined. */
export interface MergedTrip extends IncomingTrip {
  /** ISO instant of the pickup, from whichever card carried the check-in half. */
  resolvedStartTs: string | null;
  /** ISO instant of the return, from whichever card carried the check-out half. */
  resolvedEndTs: string | null;
}

/**
 * Combines every card a single reservation produced in one scan.
 *
 * THIS REPLACED A LAST-WINS DEDUPE, AND THE DIFFERENCE IS THE WHOLE BUG.
 *
 * Turo's Booked list is grouped by day and runs weeks ahead, so one
 * reservation appears TWICE: under its start date as "Starting at 9:30 AM",
 * and again under its end date as "Ending at 2:00 PM". Two cards, one trip.
 *
 * The previous code collapsed them with `new Map(...)`, keeping the last —
 * reasoning that a check-out card is the more current state. That is true
 * only when both cards are for today. Across a multi-day board the check-out
 * is the FUTURE half, so it overwrote today's pickup: `action` became
 * "checkout", `date_label` jumped to the return date, and because
 * entryToTripPayload only fills startTs for a check-in card, `start_ts` was
 * nulled outright.
 *
 * Measured against the live fleet: 201 trips, 44 with a start_ts, and a
 * dashboard reporting "0 pickups" on a day with eight of them.
 *
 * A reservation has one start and one end. Both are kept, and `action` is
 * derived from which of them is still ahead rather than from card order.
 */
export function mergeReservationCards(
  cards: IncomingTrip[],
  now: Date = new Date(),
  timezone: string = "America/Los_Angeles"
): MergedTrip {
  // Later cards win for identity fields — same trip either way, and a later
  // scrape is marginally fresher.
  const base = cards[cards.length - 1];

  let startTs: string | null = null;
  let endTs: string | null = null;
  let startLabel: string | null = null;
  let endLabel: string | null = null;

  for (const card of cards) {
    // The card's own numeric instant when the extension computed one,
    // otherwise derived from the strings it scraped. Each card must be
    // resolved with ITS OWN dateLabel — that is precisely what is lost once
    // the two are collapsed into one row.
    const own =
      card.action === "checkin"
        ? card.startTs
        : card.action === "checkout"
          ? card.endTs
          : null;

    // Turo prints a trip's time in the CAR's local zone, not the viewer's, so
    // "9:30 AM" on a Denver listing is 9:30 Mountain. Resolving it as Pacific
    // — which this did unconditionally — stored every Denver trip an hour
    // late, and pushed a 6pm pickup past midnight UTC onto the wrong day.
    const instant = own
      ? new Date(own).toISOString()
      : resolveTripTimestamp(card.dateLabel, card.time, timezone, now);
    if (!instant) continue;

    if (card.action === "checkin" && !startTs) {
      startTs = instant;
      startLabel = card.dateLabel ?? null;
    } else if (card.action === "checkout" && !endTs) {
      endTs = instant;
      endLabel = card.dateLabel ?? null;
    }
  }

  // Nothing datable — an "In progress" or "Started at" card and nothing else.
  // Keep it exactly as it arrived rather than inventing a state for it.
  if (!startTs && !endTs) {
    return { ...base, resolvedStartTs: null, resolvedEndTs: null };
  }

  const nowMs = now.getTime();
  const startAhead = startTs !== null && new Date(startTs).getTime() >= nowMs;
  const endAhead = endTs !== null && new Date(endTs).getTime() >= nowMs;

  // Whichever event is next is what this trip needs from an operator today.
  // A pickup still ahead outranks a return, because the pickup happens first.
  let action: IncomingTrip["action"];
  let dateLabel: string | null;

  if (startAhead) {
    action = "checkin";
    dateLabel = startLabel;
  } else if (endAhead) {
    action = "checkout";
    dateLabel = endLabel;
  } else {
    // Both in the past: the trip is done. The return is the more recent fact.
    action = endTs ? "checkout" : "checkin";
    dateLabel = endTs ? endLabel : startLabel;
  }

  return {
    ...base,
    action,
    dateLabel: dateLabel ?? base.dateLabel ?? null,
    resolvedStartTs: startTs,
    resolvedEndTs: endTs,
  };
}

/**
 * Groups a scan's cards by reservation and merges each group.
 * Order is preserved so the caller's downstream behaviour is unchanged.
 */
export function mergeIncomingTrips(
  trips: IncomingTrip[],
  now: Date = new Date(),
  timezone: string = "America/Los_Angeles"
): MergedTrip[] {
  const groups = new Map<string, IncomingTrip[]>();

  for (const trip of trips) {
    const existing = groups.get(trip.reservation);
    if (existing) existing.push(trip);
    else groups.set(trip.reservation, [trip]);
  }

  return Array.from(groups.values()).map((cards) => mergeReservationCards(cards, now, timezone));
}
