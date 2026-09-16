/**
 * Runs every *.test.mts under tests/, in one Node process.
 *
 * No test framework: these are pure functions with no I/O, no DOM and no
 * React, so a runner would be more setup than the tests themselves. Each file
 * prints its own PASS/FAIL lines and exits non-zero on failure; this collects
 * them so `npm test` is one command with one exit code.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".test.mts")).sort();

let failed = 0;
for (const file of files) {
  console.log(`\n${"─".repeat(64)}\n${file}\n${"─".repeat(64)}`);
  try {
    await import(pathToFileURL(join(here, file)).href);
  } catch (err) {
    failed++;
    console.error(`  ${file} threw: ${err instanceof Error ? err.message : err}`);
  }
}

// A test file can fail two ways: an assertion fails (it sets exitCode) or the
// file throws on import (caught above). Both have to reach the summary, or a
// green line prints over a red run — which is exactly what happened when
// board.test.mts called process.exit() and killed the suite mid-way.
if (process.exitCode && process.exitCode !== 0) failed++;

console.log(`\n${"─".repeat(64)}`);
if (failed === 0) {
  console.log(`ALL PASSED — ${files.length} file(s)`);
} else {
  console.error(`FAILED — ${failed} of ${files.length} file(s)`);
}
process.exit(failed === 0 ? 0 : 1);
