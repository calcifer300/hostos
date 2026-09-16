import { parseBulkPaste } from "../src/lib/board/bulk-paste.ts";
import { computeTimer, summarize, formatDuration } from "../src/lib/board/countdown.ts";
import { wallTime } from "../src/lib/timezones/index.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

/**
 * Real Turo list text, from Karl's data.js SAMPLE_PASTED_TEXT — including the
 * curly apostrophe Turo actually emits, and the doubled guest display name.
 */
const SAMPLE = `Ending at 6:30 AM
(Limitless Rentals LLC’s vehicle)

Toyota Corolla Cross 2026

11540 South Street, Cerritos, CA 90703

Juan
Juan #60136314

Toyota Corolla Cross 2026
4AA9978

Starting at 9:00 AM
(Ethan’s vehicle)

Nissan Kicks 2026

112 W Boden St, Milwaukee, WI 53207

Marcus #60229871

Child seat
Nissan Kicks 2026
ABC1234

In progress
(Baker Ohana’s vehicle)

Jeep Wrangler 2024

OGG – Kahului, HI

Priya #60301122

Jeep Wrangler 2024
HI55XZ

Swap pending
Starting at 11:15 PM
(WhipSimply’s vehicle)

Kia Telluride 2025

258 Westshore Plaza, Tampa, FL 33609

Dana #60455000

Kia Telluride 2025
FL9090`;

console.log("=== parseBulkPaste against a real Turo list ===");
const drafts = parseBulkPaste(SAMPLE, "2026-09-10");
eq("found 4 trips", drafts.length, 4);

const [juan, marcus, priya, dana] = drafts;

eq("host with LLC + curly apostrophe", juan.hostLabel, "Limitless Rentals LLC");
eq("doubled guest name collapsed", juan.guest, "Juan");
eq("reservation id", juan.reservationId, "60136314");
eq("plate is the last line, not the year", juan.plate, "4AA9978");
eq("vehicle", juan.vehicle, "Toyota Corolla Cross 2026");
eq("CA detected confidently", juan.timezoneUncertain, false);
eq("'Ending at' anchors the return side", juan.startsAt === null && juan.endsAt !== null, true);
eq("6:30 AM reads back as 6:30 AM in LA", wallTime(juan.endsAt!, juan.timezone), "6:30 AM");
eq("status for a pending return", juan.status, "Not Checked-Out");

eq("simple host", marcus.hostLabel, "Ethan");
eq("undoubled guest survives", marcus.guest, "Marcus");
eq("extra line becomes a tag", marcus.tags, ["Child seat"]);
eq("'Starting at' anchors the start", marcus.endsAt === null && marcus.startsAt !== null, true);
eq("9:00 AM reads back in Milwaukee", wallTime(marcus.startsAt!, marcus.timezone), "9:00 AM");
eq("WI is Central", marcus.timezone, "America/Chicago");

eq("'In progress' means checked in", priya.status, "Checked-In");
eq("'In progress' carries no time at all", priya.startsAt === null && priya.endsAt === null, true);
eq("airport code beats everything", priya.timezone, "Pacific/Honolulu");
eq("missing-time warning is raised", priya.warnings.some(w => /only carries one time/.test(w)), true);

eq("swap-pending line did not eat the next block", dana.hostLabel, "WhipSimply");
eq("swap pending became a tag", dana.tags.includes("Swap pending"), true);
eq("FL flagged as a split state", dana.timezoneUncertain, true);
eq("split-state warning explains why", dana.warnings.some(w => /spans two zones/.test(w)), true);
eq("11:15 PM reads back in Tampa", wallTime(dana.startsAt!, dana.timezone), "11:15 PM");

console.log("\n=== computeTimer: the two different overdues ===");
const T = Date.parse("2026-09-10T18:00:00Z");
const at = (h: number) => new Date(T + h * 3600_000).toISOString();

eq("upcoming pickup",
  computeTimer({ startsAt: at(5), endsAt: at(50), status: "Not Checked-In" }, T).windowKey, "upcoming");
eq("pickup within 2h is 'starting'",
  computeTimer({ startsAt: at(1), endsAt: at(50), status: "Not Checked-In" }, T).windowKey, "starting");

const checkinLate = computeTimer({ startsAt: at(-3), endsAt: at(40), status: "Not Checked-In" }, T);
eq("pickup passed, never checked in -> check-in overdue", checkinLate.windowKey, "checkin_overdue");
eq("check-in overdue is critical", checkinLate.tone, "critical");
eq("check-in overdue reads 3h", checkinLate.text, "3h 0m");

const returnLate = computeTimer({ startsAt: at(-40), endsAt: at(-2), status: "Checked-In" }, T);
eq("return passed while checked in -> return overdue", returnLate.windowKey, "overdue");
eq("the two overdues are different windows", checkinLate.windowKey !== returnLate.windowKey, true);

eq("running trip", computeTimer({ startsAt: at(-5), endsAt: at(30), status: "Checked-In" }, T).windowKey, "active");
eq("return within 2h is 'ending'", computeTimer({ startsAt: at(-5), endsAt: at(1), status: "Checked-In" }, T).windowKey, "ending");
eq("returned stops counting", computeTimer({ startsAt: at(-40), endsAt: at(-2), status: "Returned" }, T).windowKey, "done");
eq("canceled", computeTimer({ startsAt: at(5), endsAt: at(50), status: "Canceled" }, T).windowKey, "canceled");
eq("no times at all", computeTimer({ startsAt: null, endsAt: null, status: "Not Checked-In" }, T).windowKey, "unset");

console.log("\n=== sorting: worst first ===");
const rows = [
  { name: "upcoming",       t: computeTimer({ startsAt: at(5),   endsAt: at(50), status: "Not Checked-In" }, T) },
  { name: "return 6h late", t: computeTimer({ startsAt: at(-40), endsAt: at(-6), status: "Checked-In" }, T) },
  { name: "checkin 1h late",t: computeTimer({ startsAt: at(-1),  endsAt: at(40), status: "Not Checked-In" }, T) },
  { name: "returned",       t: computeTimer({ startsAt: at(-40), endsAt: at(-2), status: "Returned" }, T) },
];
rows.sort((a, b) => a.t.sortWeight - b.t.sortWeight);
eq("most-overdue first, settled last",
  rows.map(r => r.name),
  ["return 6h late", "checkin 1h late", "upcoming", "returned"]);

console.log("\n=== summarize ===");
const counts = summarize(rows.map(r => r.t));
eq("counts split the two overdues", [counts.checkinOverdue, counts.returnOverdue], [1, 1]);
eq("total", counts.total, 4);

console.log("\n=== formatDuration ===");
eq("days", formatDuration(3 * 86400_000 + 4 * 3600_000), "3d 4h");
eq("hours", formatDuration(2 * 3600_000 + 14 * 60_000), "2h 14m");
eq("minutes", formatDuration(45 * 60_000), "45m");
eq("seconds", formatDuration(30_000), "30s");

// exitCode, never process.exit(). The runner imports every test file into ONE
// process, so a file that calls exit takes the whole suite down with it — this
// line ended the run before two other files had even loaded, and printed
// "ALL PASSED" on its way out. A crashing test file therefore reported green,
// which is how a broken merge test stayed invisible. The runner owns the
// verdict now; a file reports only itself.
if (fail > 0) {
  console.error(`\n${fail} assertion(s) failed`);
  process.exitCode = 1;
}
