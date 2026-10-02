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
    billedRows: [{ tripId: "1", guest: "A", vehicle: "V", cents: 700, billedAt: "2026-09-29 18:10", invoiceNumber: "115000111" }],
    notBilledRows: [{ tripId: "2", guest: "B", vehicle: "W", cents: 500, group: "running", why: "The trip is still on the road.", endsAt: 1790000000000 }] },
  tripLists: { active: [{ tripId: "7", guest: "Ann", vehicle: "Tesla", plate: "ABC123", tripUrl: "javascript:x", pickupAt: 1, returnAt: 2, pickup: { day: "Fri, Oct 2", time: "9:00 AM", rel: "Today", soon: true, past: false }, ret: null, days: 2, earnings: 120.5, flags: [{ tone: "red", text: "Premier Plan: $0 Excess" }, { tone: "x" }], guestRating: 4.9, guestTrips: 5 }], pickups: [], returns: "junk" },
  unread: [{ tripId: "9", tripUrl: "https://turo.com/us/en/reservation/9", guest: "Dee", vehicle: "Taos", text: "Where do I park?", sentAt: 5, waitMs: 90000000, sent: "Oct 1, 9:00 AM", wait: "Waiting 1 day", urgency: "high", draft: "Hi Dee!" }, { guest: "X", urgency: "weird" }],
  topCar: { name: "Mazda CX-50 2024", plate: "DJIL68", total: 910, trips: 1, perTrip: 910, photo: "https://images.turo.com/a.jpg", photos: ["https://images.turo.com/a.jpg", "javascript:x"], runnersUp: [{ name: "Tesla", plate: "B", total: 400 }] },
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
eq("the billed rows keep the IDs, the vehicle and when it was billed", snap.tolls?.billedRows[0], { tripId: "1", guest: "A", vehicle: "V", cents: 700, billedAt: "2026-09-29 18:10", invoiceNumber: "115000111" });
eq("the not-yet-billed rows keep their reason", snap.tolls?.notBilledRows[0], { tripId: "2", guest: "B", vehicle: "W", cents: 500, group: "running", why: "The trip is still on the road.", endsAt: 1790000000000 });
eq("the trip lists keep their rows, legs and flags", [snap.tripLists.active.length, snap.tripLists.active[0].pickup?.time, snap.tripLists.active[0].flags.length, snap.tripLists.active[0].earnings], [1, "9:00 AM", 1, 120.5]);
eq("a bad trip link is dropped and a bad list becomes empty", [snap.tripLists.active[0].tripUrl, snap.tripLists.returns.length], [null, 0]);
eq("unread messages keep who, what and how long, and never a draft", [snap.unread.length, snap.unread[0].urgency, snap.unread[0].text, "draft" in snap.unread[0]], [2, "high", "Where do I park?", false]);
eq("an unknown urgency becomes unknown, not a crash", snap.unread[1].urgency, "unknown");
eq("the top car keeps its picture, drops a bad one, and lists runners-up", [snap.topCar?.photos.length, snap.topCar?.total, snap.topCar?.runnersUp.length], [1, 910, 1]);
eq("the calendar progress is carried", snap.calendar?.neededDone, 1);
eq("a stored snapshot normalises to itself", JSON.stringify(normalizeSnapshot(snap)), JSON.stringify(snap));
eq("the size limit is a few megabytes, not unlimited", MAX_SNAPSHOT_BYTES > 100_000 && MAX_SNAPSHOT_BYTES < 10_000_000, true);

console.log("=== labels and confidence ===");
const labelled = normalizeSnapshot({ ...raw, unread: [{ tripId: "9", text: "what's the lockbox code?", tone: "urgent", labels: [{ key: "access", label: "Can't Get In / Access", level: "urgent" }, { key: "", label: "x" }] }, { tripId: "8", text: "thanks", tone: "bogus" }], quality: { tripsAt: "2026-09-30T18:00:00Z", fleetLive: true, unpricedTrips: 2, invoicesMissing: 1, invoicesTotal: 3 } })!;
eq("an urgent label is kept and an empty one dropped", [labelled.unread[0].tone, labelled.unread[0].labels], ["urgent", [{ key: "access", label: "Can't Get In / Access", level: "urgent" }]]);
eq("an unknown tone becomes reply", labelled.unread[1].tone, "reply");
eq("quality is carried field by field", [labelled.quality.fleetLive, labelled.quality.unpricedTrips, labelled.quality.invoicesMissing, labelled.quality.tripsAt], [true, 2, 1, "2026-09-30T18:00:00Z"]);
eq("a snapshot without quality gets safe defaults", [snap.quality.fleetLive, snap.quality.tripsAt, snap.quality.unpricedTrips], [false, null, 0]);

console.log("=== how old the data is ===");
const NOW = 10_000_000;
eq("a minute-old snapshot is fresh", freshness(NOW - 60_000, NOW), { label: "1 min ago", stale: false });
eq("three hours old is stale", freshness(NOW - 3 * 3_600_000, NOW).stale, true);
eq("never sent is stale", freshness(0, NOW), { label: "never", stale: true });

if (fail) process.exitCode = 1;
