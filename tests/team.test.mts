import { DEFAULT_TEAM, DEPARTMENTS, asDepartment, hueOf, initials, isFounderProfile, shortName } from "../src/lib/team/profiles.ts";
import { isOptimizableSrc, PORTRAIT_H, PORTRAIT_W } from "../src/lib/team/photo-look.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${String(got)}\n        want ${String(want)}`}`);
};

console.log("=== the built-in roster ===");
eq("twelve members", DEFAULT_TEAM.length, 12);
eq("the Founder comes first", DEFAULT_TEAM[0].slug, "john");
eq("technology second", DEFAULT_TEAM[1].slug, "karl");
eq("positions are 0..n-1 in order", DEFAULT_TEAM.every((m, i) => m.position === i), true);
eq("every slug is unique", new Set(DEFAULT_TEAM.map((m) => m.slug)).size, DEFAULT_TEAM.length);
eq("every colour is unique", new Set(DEFAULT_TEAM.map((m) => m.hue)).size, DEFAULT_TEAM.length);
eq("every colour is a hex triplet", DEFAULT_TEAM.every((m) => /^#[0-9a-f]{6}$/i.test(m.hue ?? "")), true);
eq("every member has a photo path under /team", DEFAULT_TEAM.every((m) => m.photoUrl === `/team/${m.slug}.jpg`), true);
eq("every department is known", DEFAULT_TEAM.every((m) => m.department in DEPARTMENTS), true);
eq("every member has six responsibilities", DEFAULT_TEAM.every((m) => m.responsibilities.length === 6), true);
eq("titles are Title Case words", DEFAULT_TEAM.every((m) => /^[A-Z]/.test(m.title)), true);
eq("every member has a full name (two or more words)", DEFAULT_TEAM.every((m) => m.name.trim().split(/\s+/).length >= 2), true);
eq("every member has a nickname", DEFAULT_TEAM.every((m) => !!m.nickname), true);
eq("nicknames are unique", new Set(DEFAULT_TEAM.map((m) => m.nickname)).size, DEFAULT_TEAM.length);
eq("the Founder is Founder & CEO", DEFAULT_TEAM[0].title, "Founder & CEO");
eq("exactly one Founder", DEFAULT_TEAM.filter(isFounderProfile).length, 1);
eq("Karl is not the Founder", isFounderProfile(DEFAULT_TEAM[1]), false);

console.log("\n=== colours: the person's, else the department's ===");
const belle = DEFAULT_TEAM.find((m) => m.slug === "belle")!;
eq("Belle wears her own colour", hueOf(belle), "#f5b301");
eq("without one, the department's", hueOf({ ...belle, hue: null }), DEPARTMENTS.finance.hue);

console.log("\n=== what to call someone ===");
eq("the nickname when there is one", shortName({ name: "Maribel Magbual", nickname: "Belle" }), "Belle");
eq("the first name otherwise", shortName({ name: "Maribel Magbual", nickname: null }), "Maribel");
eq("a blank nickname counts as none", shortName({ name: "Maribel Magbual", nickname: "  " }), "Maribel");

console.log("\n=== small helpers ===");
eq("asDepartment keeps a known id", asDepartment("marketing"), "marketing");
eq("asDepartment falls back to operations", asDepartment("pirates"), "operations");
eq("initials of one name", initials("John"), "J");
eq("initials of two names", initials("John Briones"), "JB");
eq("initials cap at two", initials("Ana Maria Cruz"), "AM");

console.log("\n=== which photos next/image may optimise ===");
eq("a path on this site", isOptimizableSrc("/team/john.jpg"), true);
eq("an upload in the team bucket", isOptimizableSrc("https://abcdefghijkl.supabase.co/storage/v1/object/public/team/john-abc.jpg"), true);
eq("a private storage URL is not", isOptimizableSrc("https://abcdefghijkl.supabase.co/storage/v1/object/sign/team/john.jpg"), false);
eq("an arbitrary link is not", isOptimizableSrc("https://example.com/john.jpg"), false);
eq("a javascript: link is not", isOptimizableSrc("javascript:alert(1)"), false);
eq("the portrait is 4:5", PORTRAIT_W / PORTRAIT_H, 0.8);

if (fail > 0) process.exitCode = 1;
