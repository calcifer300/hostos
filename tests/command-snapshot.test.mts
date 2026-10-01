import { freshness, normalizeSnapshot, MAX_SNAPSHOT_BYTES } from "../src/lib/command/snapshot.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

console.log("=== the Command Center snapshot from the extension is made safe to draw ===");
eq("not an object is refused", normalizeSnapshot("hello"), null);
eq("an object without the model is refused", normalizeSnapshot({ version: 1 }), null);

const raw = {
  version: 1, builtAt: 1_000, zone: "America/Denver", brand: "Colorado Cruisers", operator: "John", owner: "Matt", scannedAt: "2026-09-30T18:00:00Z",
  counts: { trips: 5, vehicles: 2 }, evil: "<script>",
  model: {
    greeting: "Good evening, John", kpis: { vehicles: 2, activeTrips: 1, pickups: 0, returns: 1, earningsNext30: 4200.4, earningsLast30: 100, tripsNext30: 3 },
    fleet: { total: 2, onTrip: 1, scheduled: 0, available: 1, unlisted: 0, needsAttention: 0 },
    attention: [{ kind: "license", tone: "amber", label: "License not verified", guest: "Dean", tripUrl: "javascript:alert(1)", when: 5 }, "junk"],
    schedule: [{ type: "Return", at: 9, done: true, time: "9:00 PM", vehicle: "Taos", guest: "Robin", tripUrl: "https://turo.com/us/en/reservation/1" }],
    earnings: [{ from: 1, cents: 100, trips: 1, future: true }],
  },
  fleet: [{ name: "Tesla", plate: "ABC123", state: "ontrip", status: "listed", now: { guest: "Ann", until: "Fri 5 PM" }, next: null, issues: ["Inspection required"] }, { name: "Odd", state: "weird" }],
  photos: { ABC123: ["https://images.turo.com/a.jpg", "https://images.turo.com/b.jpg"] },
  tolls: { at: "2026-09-30T18:00:00Z", trips: 2, cents: 1000, running: 1, runningCents: 500, billedWeekTrips: 1, billedWeekCents: 700,
    weekRows: [{ tripId: "1", guest: "A", vehicle: "V", cents: 700, state: "paid", submitted: "2026-09-29" }], runningRows: [] },
  earnings: { unpriced: [{ vehicle: "Car", plate: "X", reason: "r", guess: 10 }], calendar: { fleet: 5, fresh: 2, needed: 3, neededDone: 1, complete: false } },
};
const snap = normalizeSnapshot(raw)!;
eq("a whole snapshot is accepted", Boolean(snap), true);
eq("unknown fields are dropped", Object.keys(snap).includes("evil"), false);
eq("a javascript: link is never kept", snap.attention[0].tripUrl, null);
eq("junk rows are dropped", snap.attention.length, 1);
eq("a real https link is kept", snap.schedule[0].tripUrl, "https://turo.com/us/en/reservation/1");
eq("a car's picture comes from its plate", snap.fleet[0].photo, "https://images.turo.com/a.jpg");
eq("an unknown state becomes available, not a crash", snap.fleet[1].state, "available");
eq("the toll rows keep names, amounts and dates", snap.tolls?.weekRows[0], { tripId: "1", guest: "A", vehicle: "V", cents: 700, state: "paid", submitted: "2026-09-29", endsAt: null });
eq("the calendar progress is carried", snap.calendar?.neededDone, 1);
eq("a stored snapshot normalises to itself", JSON.stringify(normalizeSnapshot(snap)), JSON.stringify(snap));
eq("the size limit is a few megabytes, not unlimited", MAX_SNAPSHOT_BYTES > 100_000 && MAX_SNAPSHOT_BYTES < 10_000_000, true);

console.log("=== how old the data is ===");
const NOW = 10_000_000;
eq("a minute-old snapshot is fresh", freshness(NOW - 60_000, NOW), { label: "1 min ago", stale: false });
eq("three hours old is stale", freshness(NOW - 3 * 3_600_000, NOW).stale, true);
eq("never sent is stale", freshness(0, NOW), { label: "never", stale: true });

if (fail) process.exitCode = 1;
