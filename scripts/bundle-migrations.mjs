// Concatenates a range of migrations into one file for the Supabase SQL
// editor, which takes one script at a time. Every migration is additive and
// idempotent, so the bundle is safe to paste more than once.
//
//   node scripts/bundle-migrations.mjs 0017 0024
//
// Writes supabase/bundles/<from>-<to>.sql and prints its path.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const [from = "0001", to = "9999"] = process.argv.slice(2);

const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .filter((f) => f.slice(0, 4) >= from && f.slice(0, 4) <= to)
  .sort();

if (files.length === 0) {
  console.error(`No migrations between ${from} and ${to}.`);
  process.exit(1);
}

const parts = [
  `-- HostOS — migrations ${files[0].slice(0, 4)} to ${files[files.length - 1].slice(0, 4)}, bundled ${new Date().toISOString().slice(0, 10)}`,
  `-- Paste into the Supabase SQL editor and run once. Every migration below is`,
  `-- additive and idempotent, so running the bundle twice is harmless.`,
  ``,
];
for (const f of files) {
  parts.push(`-- ${"=".repeat(70)}`, `-- ${f}`, `-- ${"=".repeat(70)}`, readFileSync(join(dir, f), "utf8").trimEnd(), ``);
}

const outDir = join(root, "supabase", "bundles");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${files[0].slice(0, 4)}-${files[files.length - 1].slice(0, 4)}.sql`);
writeFileSync(out, parts.join("\n"));
console.log(`${files.length} migrations → ${out}`);
