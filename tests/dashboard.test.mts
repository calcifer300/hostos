import { availableWidgets, DASHBOARDS, resolveLayout, storedLayoutFor, WIDGETS } from "../src/lib/dashboard/widgets.ts";
import { activityScope, inScope, notificationScope, scopeFromHref, taskScope } from "../src/lib/dashboard/scope.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

console.log("\n=== catalogue ===");
eq("home plus one dashboard per vertical", DASHBOARDS.map((d) => d.scope), ["home", "fleet", "restaurants", "commerce", "web", "cafe", "salon", "custom"]);
eq("every vertical dashboard needs its module", DASHBOARDS.filter((d) => d.scope !== "home").every((d) => d.module === d.scope), true);
eq("a salon widget never lands on the café dashboard", availableWidgets("cafe", ["cafe", "salon"]).some((w) => w.module === "salon"), false);
eq("the web dashboard has its own widgets", availableWidgets("web", ["web"]).map((w) => w.id).includes("webProperties"), true);
eq("widget ids are unique", new Set(WIDGETS.map((w) => w.id)).size, WIDGETS.length);
eq("every widget names at least one dashboard", WIDGETS.every((w) => w.scopes.length > 0), true);
eq("a fleet-only widget never lands on the commerce dashboard", availableWidgets("commerce", ["fleet", "commerce"]).some((w) => w.module === "fleet"), false);
eq("the fleet dashboard is empty of widgets without the fleet module", availableWidgets("fleet", ["restaurants"]).filter((w) => w.module === "fleet").length, 0);
eq("home shows one card per line of business", availableWidgets("home", ["fleet"]).some((w) => w.id === "businesses"), true);
eq("the restaurant list only exists on the restaurant dashboard", availableWidgets("home", ["restaurants"]).some((w) => w.id === "restaurantList"), false);

console.log("\n=== resolveLayout ===");
const fresh = resolveLayout(null, ["fleet"], "fleet");
eq("fresh fleet layout starts with key numbers", fresh[0]?.id, "stats");
eq("fresh layout hides widgets that default off", fresh.find((e) => e.id === "unscheduled")?.visible, false);
eq("fresh layout shows the rest", fresh.filter((e) => e.visible).length, fresh.length - 1);
eq("no restaurant widgets when the module is off", fresh.some((e) => e.id === "orders"), false);

const stored = [
  { id: "board", visible: true },
  { id: "stats", visible: false },
  { id: "ghost", visible: true },
  { id: "board", visible: false },
];
const merged = resolveLayout(stored, ["fleet"], "fleet");
eq("stored order wins", merged.slice(0, 2).map((e) => e.id), ["board", "stats"]);
eq("stored visibility wins", merged.find((e) => e.id === "stats")?.visible, false);
eq("unknown ids drop", merged.some((e) => e.id === "ghost"), false);
eq("duplicates collapse to the first", merged.filter((e) => e.id === "board").length, 1);
eq("new widgets append in catalogue order", merged[merged.length - 1]?.id, availableWidgets("fleet", ["fleet"]).at(-1)?.id);
eq("a stored id from another dashboard drops", resolveLayout([{ id: "restaurantList", visible: true }], ["fleet", "restaurants"], "fleet").some((e) => e.id === "restaurantList"), false);

console.log("\n=== storedLayoutFor ===");
const legacy = [{ id: "stats", visible: true }];
eq("a bare array is the Home layout", storedLayoutFor(legacy, "home"), legacy);
eq("a bare array is nothing for the fleet dashboard", storedLayoutFor(legacy, "fleet"), null);
eq("keyed object returns its scope", storedLayoutFor({ fleet: legacy, home: [] }, "fleet"), legacy);
eq("missing scope is null", storedLayoutFor({ home: legacy }, "commerce"), null);
eq("garbage entries are filtered", storedLayoutFor({ home: [1, "x", { id: "stats", visible: true }] }, "home"), legacy);
eq("null is null", storedLayoutFor(null, "home"), null);

console.log("\n=== scope classifiers ===");
eq("trip task → fleet", taskScope({ relatedKind: "trip" }), "fleet");
eq("restaurant task → restaurants", taskScope({ relatedKind: "restaurant" }), "restaurants");
eq("store task → commerce", taskScope({ relatedKind: "store" }), "commerce");
eq("manual task with a commerce link → commerce", taskScope({ relatedKind: null, href: "/app/commerce/abc?tab=products" }), "commerce");
eq("manual task with no link → shared", taskScope({ relatedKind: null, href: null }), null);
eq("alert notification → fleet", notificationScope({ kind: "alert" }), "fleet");
eq("store notification → commerce", notificationScope({ kind: "store" }), "commerce");
eq("system notification → shared", notificationScope({ kind: "system" }), null);
eq("system notification linking to a restaurant → restaurants", notificationScope({ kind: "system", href: "/app/restaurants/x" }), "restaurants");
eq("commerce activity → commerce", activityScope({ module: "commerce" }), "commerce");
eq("team activity → shared", activityScope({ module: "team" }), null);
eq("absolute href is understood", scopeFromHref("https://hostos-ten.vercel.app/app/board"), "fleet");
eq("/app/fleet/vehicles → fleet", scopeFromHref("/app/fleet/vehicles/X"), "fleet");
eq("/app/tasks → shared", scopeFromHref("/app/tasks"), null);

console.log("\n=== inScope ===");
eq("home shows everything", inScope("home", "commerce"), true);
eq("fleet shows fleet", inScope("fleet", "fleet"), true);
eq("fleet shows shared", inScope("fleet", null), true);
eq("fleet hides commerce", inScope("fleet", "commerce"), false);

if (fail > 0) process.exitCode = 1;
