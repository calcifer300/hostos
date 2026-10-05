import { INDUSTRIES, INDUSTRY_GROUPS, SHARED_SOPS, industryById } from "../src/lib/services/industries.ts";
let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fail++;
  console.log(` ${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `
        got  ${JSON.stringify(got)}
        want ${JSON.stringify(want)}`}`);
};
const ok = (label: string, got: boolean) => eq(label, got, true);
const section = (title: string) => console.log(`
=== ${title} ===`);

import { conflicts, dayIn, estimateTotals, isOverdue, leadConversion, missingPhotos, needsFollowUp, onDay, revenueSummary, staffStats } from "../src/lib/services/analytics.ts";

section("industry templates: every business in the brief, each complete");
eq("29 industries", INDUSTRIES.length, 29);
eq("ids are unique", new Set(INDUSTRIES.map((i) => i.id)).size, INDUSTRIES.length);
ok("every industry has a catalogue", INDUSTRIES.every((i) => i.catalog.length >= 3));
ok("every catalogue item has a duration", INDUSTRIES.every((i) => i.catalog.every((c) => c.durationMin >= 0 && c.name)));
ok("every industry has a job checklist", INDUSTRIES.every((i) => i.jobChecklist.length >= 9));
ok("every industry belongs to a known group", INDUSTRIES.every((i) => i.group in INDUSTRY_GROUPS));
eq("shared SOPs cover the lead-to-review loop", SHARED_SOPS[0].steps.length, 11);
eq("lookup by id", industryById("towing")?.label, "Towing Companies");
eq("unknown id is undefined", industryById("nope"), undefined);
ok("the brief's examples are all present", ["auto_glass", "mobile_mechanic", "auto_detailing", "mobile_tire", "towing", "roadside", "dumpster", "junk_removal", "portable_toilet", "pressure_washing", "hvac", "plumbing", "electrical", "roofing", "pest_control", "cleaning", "lawn_care", "landscaping", "tree", "locksmith", "appliance_repair", "handyman", "pool", "window_tint", "mobile_car_wash", "construction", "renovation", "painting", "moving"].every((id) => industryById(id)));

section("estimates");
eq("totals with tax", estimateTotals([{ name: "a", quantity: 2, unitPrice: 100 }, { name: "b", quantity: 1, unitPrice: 49.99 }], 8), { subtotal: 249.99, tax: 20, total: 269.99 });
eq("no tax", estimateTotals([{ name: "a", quantity: 1, unitPrice: 10 }], 0).total, 10);
const day = 86_400_000;
const now = Date.parse("2026-09-15T12:00:00Z");
ok("sent 3 days ago needs a follow-up", needsFollowUp({ status: "sent", sentAt: new Date(now - 3 * day).toISOString() }, 2, now));
ok("sent yesterday does not", !needsFollowUp({ status: "sent", sentAt: new Date(now - 1 * day).toISOString() }, 2, now));
ok("accepted never does", !needsFollowUp({ status: "accepted", sentAt: new Date(now - 9 * day).toISOString() }, 2, now));

section("jobs");
ok("open past its end is overdue", isOverdue({ status: "assigned", scheduledEnd: new Date(now - 3600_000).toISOString() }, now));
ok("completed is never overdue", !isOverdue({ status: "completed", scheduledEnd: new Date(now - 3600_000).toISOString() }, now));
ok("future end is not overdue", !isOverdue({ status: "in_progress", scheduledEnd: new Date(now + 3600_000).toISOString() }, now));
const a = { staffId: "t1", scheduledStart: "2026-09-15T09:00:00Z", scheduledEnd: "2026-09-15T11:00:00Z" };
ok("same tech, overlapping windows conflict", conflicts(a, { staffId: "t1", scheduledStart: "2026-09-15T10:00:00Z", scheduledEnd: "2026-09-15T12:00:00Z" }));
ok("back-to-back does not conflict", !conflicts(a, { staffId: "t1", scheduledStart: "2026-09-15T11:00:00Z", scheduledEnd: "2026-09-15T12:00:00Z" }));
ok("different tech does not conflict", !conflicts(a, { staffId: "t2", scheduledStart: "2026-09-15T10:00:00Z", scheduledEnd: "2026-09-15T12:00:00Z" }));
ok("completed without an after photo is missing proof", missingPhotos({ status: "completed", photos: [{ url: "https://x/1.jpg", caption: null, phase: "before" }] }));
ok("completed with an after photo is fine", !missingPhotos({ status: "completed", photos: [{ url: "https://x/2.jpg", caption: null, phase: "after" }] }));

section("days in the workspace's zone");
eq("6 pm in Denver is still that day, not the next UTC day", dayIn("2026-09-16T00:00:00Z", "America/Denver"), "2026-09-15");
ok("onDay uses the zone", onDay("2026-09-16T00:00:00Z", "2026-09-15", "America/Denver"));
eq("null stays null", dayIn(null, "America/Denver"), null);
eq("revenue today follows the zone", revenueSummary([{ staffId: "t1", status: "completed", price: 50, completedAt: "2026-09-16T01:00:00Z", createdAt: "" }], new Date("2026-09-15T23:00:00Z"), "America/Denver").today, 50);

section("reporting");
const jobs = [
  { staffId: "t1", status: "completed" as const, price: 300, completedAt: new Date(now).toISOString(), createdAt: "" },
  { staffId: "t1", status: "completed" as const, price: 100, completedAt: new Date(now - 10 * day).toISOString(), createdAt: "" },
  { staffId: "t1", status: "cancelled" as const, price: 50, completedAt: null, createdAt: "" },
  { staffId: "t2", status: "completed" as const, price: 700, completedAt: new Date(now - 40 * day).toISOString(), createdAt: "" },
];
const stats = staffStats(jobs);
eq("revenue per technician, best first", stats.map((s) => [s.staffId, s.revenue]), [["t2", 700], ["t1", 400]]);
eq("completion rate counts cancellations", stats.find((s) => s.staffId === "t1")?.completionRate, 67);
const rev = revenueSummary(jobs, new Date(now));
eq("today's revenue", rev.today, 300);
eq("this month's revenue", rev.month, 400);
eq("average job value this month", rev.averageJobValue, 200);
eq("cancellation rate", rev.cancellationRate, 25);
eq("lead conversion", leadConversion([{ stage: "lead" }, { stage: "customer" }, { stage: "customer" }, { stage: "inactive" }]), 67);

if (fail > 0) process.exitCode = 1;
