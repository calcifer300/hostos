import { DEFAULT_FILM, LAUREL_LABEL_MAX, normalizeFilm } from "../src/lib/site/film.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${String(got)}\n        want ${String(want)}`}`);
};

/**
 * The live landing page once read "5+ yrs · VA & BPO experience per operator ·
 * train". The default label was 57 characters, the sanitiser silently cut every
 * label to 40, and the editor accepted any length — so saving the page stored
 * the cut version and nothing anywhere complained.
 */
console.log("=== laurel labels are never silently cut ===");
eq("the limit is enforced in one place", LAUREL_LABEL_MAX, 64);
eq(
  "every built-in laurel label fits the limit",
  DEFAULT_FILM.laurels.every((l) => l.label.length <= LAUREL_LABEL_MAX),
  true
);
eq(
  "the built-in laurels survive normalising unchanged",
  JSON.stringify(normalizeFilm(DEFAULT_FILM).laurels),
  JSON.stringify(DEFAULT_FILM.laurels)
);

const long = "VA & BPO experience per operator · trained by the Founder"; // 57 characters
eq("that sentence is longer than the old 40-character clamp", long.length > 40, true);
eq(
  "a label that fits is stored whole",
  normalizeFilm({ laurels: [{ value: "5+ yrs", label: long }] }).laurels[0].label,
  long
);
eq(
  "a label over the limit is cut at the limit, and only then",
  normalizeFilm({ laurels: [{ value: "1", label: "x".repeat(LAUREL_LABEL_MAX + 20) }] }).laurels[0].label.length,
  LAUREL_LABEL_MAX
);

console.log("\n=== the testimonials the page ships with ===");
eq("three of them", DEFAULT_FILM.testimonials.length, 3);
eq(
  "the Turo host is Matthew Collins",
  DEFAULT_FILM.testimonials.some((t) => t.name === "Matthew Collins" && t.role === "Turo host"),
  true
);
eq("the old name is gone", DEFAULT_FILM.testimonials.some((t) => t.name === "Matt Tolley"), false);

// LAST LINE OF THE FILE, so it counts every assertion above it.
if (fail > 0) process.exitCode = 1;
