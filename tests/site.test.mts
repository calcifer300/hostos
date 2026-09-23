import { DEFAULT_INTRO, isIntroImageSrc, normalizeIntro } from "../src/lib/site/intro.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${String(got)}\n        want ${String(want)}`}`);
};

console.log("=== the built-in intro ===");
eq("four systems", DEFAULT_INTRO.panels.length, 4);
eq("one of each interaction", new Set(DEFAULT_INTRO.panels.map((p) => p.layout)).size, 4);
eq("the opener comes first", DEFAULT_INTRO.panels[0].layout, "hero");
eq("every photograph is one next/image may fetch", DEFAULT_INTRO.panels.every((p) => isIntroImageSrc(p.image)), true);
eq("every system has a caption and a readout", DEFAULT_INTRO.panels.every((p) => p.caption && p.marker), true);
eq("the opener has three stats", DEFAULT_INTRO.panels[0].stats.length, 3);
eq("the other systems have lines, cards or channels", DEFAULT_INTRO.panels.slice(1).every((p) => p.items.length >= 3), true);
eq("the defaults survive normalising", JSON.stringify(normalizeIntro(DEFAULT_INTRO)), JSON.stringify(DEFAULT_INTRO));

console.log("\n=== whatever was stored is made whole ===");
const n1 = normalizeIntro(null);
eq("nothing stored → the defaults", JSON.stringify(n1), JSON.stringify(DEFAULT_INTRO));
const n2 = normalizeIntro({ enabled: false, panels: [{ title: "FLEET //", accent: "OPS", items: "nope", markerX: 140 }] });
eq("enabled is kept", n2.enabled, false);
eq("an edited field is kept", n2.panels[0].accent, "OPS");
eq("a missing field falls back", n2.panels[0].body, DEFAULT_INTRO.panels[0].body);
eq("a wrong-typed list falls back", n2.panels[0].items.length, DEFAULT_INTRO.panels[0].items.length);
eq("the crosshair stays on the photograph", n2.panels[0].markerX, 100);
eq("missing systems fall back to the defaults", n2.panels[3].layout, "readout");
const n3 = normalizeIntro({ panels: [{}, { layout: "pirate" }, { items: [{ title: "ONE", tags: ["a", 3, "b"] }] }] });
eq("an unknown interaction falls back", n3.panels[1].layout, "blueprint");
eq("tags keep only strings", n3.panels[2].items[0].tags.join(","), "a,b");
eq("an item's missing text falls back to the default line", n3.panels[2].items[0].body, DEFAULT_INTRO.panels[2].items[0].body);

console.log("\n=== photographs next/image may fetch ===");
eq("a path on this site", isIntroImageSrc("/intro/fleet.jpg"), true);
eq("an upload in our storage", isIntroImageSrc("https://abcdefghijkl.supabase.co/storage/v1/object/public/site/fleet-x.jpg"), true);
eq("an Unsplash photograph", isIntroImageSrc("https://images.unsplash.com/photo-1?auto=format"), true);
eq("any other host is not", isIntroImageSrc("https://example.com/a.jpg"), false);
eq("javascript: is not", isIntroImageSrc("javascript:alert(1)"), false);

if (fail > 0) process.exitCode = 1;
