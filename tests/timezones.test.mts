import {
  instantFromWallTime,
  detectTimezone,
  wallTime,
  zoneAbbr,
  resolveScheduleWallTime,
} from "../src/lib/timezones/index.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${got}\n        want ${want}`}`);
};

console.log("=== instantFromWallTime: does 7:30 PM local mean 7:30 PM local? ===");
// Round-trip is the real test: whatever instant we compute, rendering it back
// in the same zone must give the wall time we started from.
for (const [zone, date, time] of [
  ["Pacific/Honolulu", "2026-09-09", "19:30"],
  ["America/New_York", "2026-09-09", "19:30"],
  ["America/Phoenix",  "2026-09-09", "08:00"],
  ["America/Chicago",  "2026-01-15", "23:45"],   // winter, CST
  ["America/Chicago",  "2026-07-15", "23:45"],   // summer, CDT
  ["America/Denver",   "2026-03-08", "01:30"],   // DST spring-forward day
  ["America/New_York", "2026-11-01", "01:30"],   // DST fall-back day (ambiguous)
] as const) {
  const iso = instantFromWallTime(date, time, zone)!;
  const back = wallTime(iso, zone);
  const [h, m] = time.split(":").map(Number);
  const want = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  eq(`${zone} ${date} ${time}`, back, want);
}

console.log("\n=== the five-hour bug: Honolulu vs Chicago are not the same instant ===");
const hnl = instantFromWallTime("2026-09-09", "19:30", "Pacific/Honolulu")!;
const chi = instantFromWallTime("2026-09-09", "19:30", "America/Chicago")!;
const gapH = (new Date(hnl).getTime() - new Date(chi).getTime()) / 3600000;
eq("Honolulu 7:30 PM is 5h after Chicago 7:30 PM", gapH, 5);

console.log("\n=== detectTimezone ===");
eq("airport IAH",      detectTimezone("IAH – Houston, TX").zone, "America/Chicago");
eq("airport OGG",      detectTimezone("OGG – Kahului, HI").zone, "Pacific/Honolulu");
eq("airport confident", detectTimezone("OGG – Kahului, HI").confident, true);
eq("state CA",         detectTimezone("11540 South Street, Cerritos, CA 90703").zone, "America/Los_Angeles");
eq("state CA confident", detectTimezone("11540 South Street, Cerritos, CA 90703").confident, true);
eq("split state FL",   detectTimezone("258 Westshore Plaza, Tampa, FL 33609").zone, "America/New_York");
eq("split state flagged", detectTimezone("258 Westshore Plaza, Tampa, FL 33609").confident, false);
eq("split state TX",   detectTimezone("15850 John F Kennedy Blvd, Houston, TX 77032").confident, false);
eq("city fallback",    detectTimezone("553 Haleakala Highway, Kahului").zone, "Pacific/Honolulu");
eq("city not confident", detectTimezone("553 Haleakala Highway, Kahului").confident, false);
eq("empty is flagged", detectTimezone("").confident, false);
eq("zoneAbbr HST",     zoneAbbr("Pacific/Honolulu"), "HST");

console.log("\n=== resolveScheduleWallTime: the reservation page's own format ===");
{
  // "6:00 PM" on a Denver fleet is 00:00Z the next day. Resolved as Pacific —
  // which the extension did, and then wrote over the correct value — it
  // becomes 01:00Z and a 6:00 PM pickup reads 7:00 PM. That was a real row.
  eq(
    "Denver 6:00 PM",
    resolveScheduleWallTime("Thu, Sep 10, 2026", "6:00 PM", "America/Denver"),
    "2026-09-11T00:00:00.000Z"
  );
  eq(
    "the same wall time in Pacific is an hour later in UTC",
    resolveScheduleWallTime("Thu, Sep 10, 2026", "6:00 PM", "America/Los_Angeles"),
    "2026-09-11T01:00:00.000Z"
  );
  eq(
    "12:30 AM is after midnight, not after noon",
    resolveScheduleWallTime("Fri, Sep 11, 2026", "12:30 AM", "America/Denver"),
    "2026-09-11T06:30:00.000Z"
  );
  eq(
    "12:00 PM is noon",
    resolveScheduleWallTime("Thu, Sep 10, 2026", "12:00 PM", "America/Denver"),
    "2026-09-10T18:00:00.000Z"
  );
  eq(
    "the weekday is optional",
    resolveScheduleWallTime("Sep 10, 2026", "9:30 AM", "America/Denver"),
    "2026-09-10T15:30:00.000Z"
  );
  // Null, not a guess: this value OVERWRITES one the board already got right.
  eq("an unreadable date yields null", resolveScheduleWallTime("sometime next week", "6:00 PM", "America/Denver"), null);
  eq("an unreadable time yields null", resolveScheduleWallTime("Thu, Sep 10, 2026", "evening", "America/Denver"), null);
}

// LAST LINE OF THE FILE, deliberately. Assertions added after this guard are
// not counted by it — the run would stay green while they failed, which is
// the same class of bug as board.test.mts calling process.exit().
// exitCode, never process.exit() — see the note at the end of board.test.mts.
if (fail > 0) {
  console.error(`\n${fail} assertion(s) failed`);
  process.exitCode = 1;
}
