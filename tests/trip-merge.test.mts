import { mergeReservationCards, mergeIncomingTrips, type IncomingTrip } from "../src/lib/trips/sync.ts";

/**
 * The fleet in these cases is Matthew's, listed at "DEN — Denver, CO", so
 * Turo prints its trip times in Mountain. Passing the zone explicitly is the
 * point: the resolver used to assume Pacific for everyone, which stored every
 * one of these an hour late.
 */
const DENVER = "America/Denver";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${got}\n        want ${want}`}`);
};

/** A trip card as the extension sends it. */
function card(over: Partial<IncomingTrip>): IncomingTrip {
  return {
    reservation: "1",
    action: null,
    skipReason: null,
    guestName: null,
    plate: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleYear: null,
    extras: [],
    dateLabel: null,
    startTs: null,
    endTs: null,
    time: null,
    ...over,
  };
}

/**
 * The live failure this was written for.
 *
 * Reservation #61077775 on 2026-09-10: Turo's Booked list showed it under
 * Today as "Starting at 9:30 AM", and again under Sept 14 as "Ending at
 * 2:00 PM". The old last-wins dedupe kept the second, so the row became a
 * check-out dated 9/14 with a null start — and a day with eight pickups
 * reported zero.
 */
console.log("=== the two halves of one reservation ===");
{
  const NOW = new Date("2026-09-10T07:00:00Z"); // 01:00 MDT, before any pickup

  const merged = mergeReservationCards(
    [
      card({ reservation: "61077775", action: "checkin", dateLabel: "9/10", time: "9:30 AM", guestName: "Miracle", plate: "EIVT36" }),
      card({ reservation: "61077775", action: "checkout", dateLabel: "9/14", time: "2:00 PM", guestName: "Miracle", plate: "EIVT36" }),
    ],
    NOW,
    DENVER
  );

  eq("action is the pickup, not the return", merged.action, "checkin");
  eq("date label is today, not the return date", merged.dateLabel, "9/10");
  eq("start survives", merged.resolvedStartTs, "2026-09-10T15:30:00.000Z");
  eq("end is kept too", merged.resolvedEndTs, "2026-09-14T20:00:00.000Z");
  eq("identity preserved", merged.plate, "EIVT36");
}

console.log("\n=== card order must not matter ===");
{
  const NOW = new Date("2026-09-10T07:00:00Z");
  const forward = mergeReservationCards(
    [
      card({ reservation: "1", action: "checkin", dateLabel: "9/10", time: "9:30 AM" }),
      card({ reservation: "1", action: "checkout", dateLabel: "9/14", time: "2:00 PM" }),
    ],
    NOW,
    DENVER
  );
  const reversed = mergeReservationCards(
    [
      card({ reservation: "1", action: "checkout", dateLabel: "9/14", time: "2:00 PM" }),
      card({ reservation: "1", action: "checkin", dateLabel: "9/10", time: "9:30 AM" }),
    ],
    NOW,
    DENVER
  );
  eq("same action either way", forward.action, reversed.action);
  eq("same start either way", forward.resolvedStartTs, reversed.resolvedStartTs);
  eq("same end either way", forward.resolvedEndTs, reversed.resolvedEndTs);
}

console.log("\n=== once the pickup has passed, the return is what's next ===");
{
  // 6pm MDT on the 10th: the 9:30 AM pickup is done, the 14th is ahead.
  const NOW = new Date("2026-09-11T00:00:00Z");
  const merged = mergeReservationCards(
    [
      card({ reservation: "1", action: "checkin", dateLabel: "9/10", time: "9:30 AM" }),
      card({ reservation: "1", action: "checkout", dateLabel: "9/14", time: "2:00 PM" }),
    ],
    NOW,
    DENVER
  );
  eq("action flips to the return", merged.action, "checkout");
  eq("label follows the action", merged.dateLabel, "9/14");
  eq("start is still recorded", merged.resolvedStartTs, "2026-09-10T15:30:00.000Z");
}

console.log("\n=== a lone check-out card still works ===");
{
  const NOW = new Date("2026-09-10T07:00:00Z");
  const merged = mergeReservationCards(
    [card({ reservation: "1", action: "checkout", dateLabel: "9/10", time: "7:00 AM" })],
    NOW,
    DENVER
  );
  eq("action is checkout", merged.action, "checkout");
  eq("end resolved", merged.resolvedEndTs, "2026-09-10T13:00:00.000Z");
  eq("start stays null, not invented", merged.resolvedStartTs, null);
}

console.log("\n=== an undatable card is left exactly as it arrived ===");
{
  const merged = mergeReservationCards(
    [card({ reservation: "1", action: "skip", skipReason: "In progress" })],
    new Date("2026-09-10T07:00:00Z"),
    DENVER
  );
  eq("action untouched", merged.action, "skip");
  eq("reason kept", merged.skipReason, "In progress");
  eq("no start invented", merged.resolvedStartTs, null);
  eq("no end invented", merged.resolvedEndTs, null);
}

console.log("\n=== grouping: one row per reservation, order preserved ===");
{
  const NOW = new Date("2026-09-10T07:00:00Z");
  const out = mergeIncomingTrips(
    [
      card({ reservation: "A", action: "checkin", dateLabel: "9/10", time: "9:30 AM" }),
      card({ reservation: "B", action: "checkin", dateLabel: "9/10", time: "10:00 AM" }),
      card({ reservation: "A", action: "checkout", dateLabel: "9/14", time: "2:00 PM" }),
    ],
    NOW,
    DENVER
  );
  eq("two rows out of three cards", out.length, 2);
  eq("first is A", out[0].reservation, "A");
  eq("A kept its pickup", out[0].action, "checkin");
  eq("second is B", out[1].reservation, "B");
}

console.log("\n=== the whole of today's real board ===");
{
  // Every reservation from the 2026-09-10 screenshots, each appearing twice
  // exactly as Turo lists it. Eight pickups and one return.
  const NOW = new Date("2026-09-10T07:00:00Z");
  const board: IncomingTrip[] = [
    card({ reservation: "60556099", action: "checkout", dateLabel: "9/10", time: "7:00 AM" }),
    card({ reservation: "61077775", action: "checkin", dateLabel: "9/10", time: "9:30 AM" }),
    card({ reservation: "60830198", action: "checkin", dateLabel: "9/10", time: "10:00 AM" }),
    card({ reservation: "60918747", action: "checkin", dateLabel: "9/10", time: "11:00 AM" }),
    card({ reservation: "60845771", action: "checkin", dateLabel: "9/10", time: "12:30 PM" }),
    card({ reservation: "60690368", action: "checkin", dateLabel: "9/10", time: "2:00 PM" }),
    card({ reservation: "60765620", action: "checkin", dateLabel: "9/10", time: "2:30 PM" }),
    card({ reservation: "61065205", action: "checkin", dateLabel: "9/10", time: "3:00 PM" }),
    card({ reservation: "60040925", action: "checkin", dateLabel: "9/10", time: "6:00 PM" }),
    // Each one's return, further down the same board.
    card({ reservation: "61077775", action: "checkout", dateLabel: "9/14", time: "2:00 PM" }),
    card({ reservation: "60830198", action: "checkout", dateLabel: "9/20", time: "10:00 AM" }),
    card({ reservation: "60918747", action: "checkout", dateLabel: "9/21", time: "10:30 AM" }),
    card({ reservation: "60845771", action: "checkout", dateLabel: "9/15", time: "2:00 PM" }),
    card({ reservation: "60690368", action: "checkout", dateLabel: "9/17", time: "2:00 PM" }),
    card({ reservation: "60765620", action: "checkout", dateLabel: "9/20", time: "2:30 PM" }),
    card({ reservation: "61065205", action: "checkout", dateLabel: "9/14", time: "10:00 AM" }),
    card({ reservation: "60040925", action: "checkout", dateLabel: "10/10", time: "10:00 AM" }),
  ];

  const merged = mergeIncomingTrips(board, NOW, DENVER);
  const denverDay = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-CA", { timeZone: DENVER, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
      : null;

  const pickupsToday = merged.filter(
    (t) => t.action === "checkin" && denverDay(t.resolvedStartTs) === "2026-09-10"
  );
  const returnsToday = merged.filter(
    (t) => t.action === "checkout" && denverDay(t.resolvedEndTs) === "2026-09-10"
  );

  eq("nine reservations, not seventeen rows", merged.length, 9);
  eq("eight pickups today", pickupsToday.length, 8);
  eq("one return today", returnsToday.length, 1);
  eq("every pickup has a start", pickupsToday.every((t) => t.resolvedStartTs !== null), true);
}

if (fail > 0) {
  console.error(`\n${fail} assertion(s) failed`);
  process.exitCode = 1;
}
