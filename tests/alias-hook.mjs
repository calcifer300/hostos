/**
 * Teaches `node --experimental-strip-types` the "@/..." path alias.
 *
 * The alias is declared in tsconfig.json and understood by Next's bundler and
 * by tsc, but Node resolves modules on its own and sees "@/lib/timezones" as a
 * bare package specifier — so a test importing anything under src/ fails with
 * ERR_MODULE_NOT_FOUND before a single assertion runs.
 *
 * The alternative was relative imports in the modules under test, which would
 * make library code look different depending on whether it happens to be
 * covered by a test. Twelve lines here is the cheaper price.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import { statSync } from "node:fs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function resolve(specifier, context, nextResolve) {
  // `server-only` throws on import by design — it is a build-time guard that
  // Next's bundler recognises and strips. Node does not, so any test touching a
  // module that imports it dies before its first assertion. Stubbing it here
  // keeps the guard real in the app and out of the way in tests; the
  // alternative is library code shaped around what happens to be covered.
  if (specifier === "server-only") {
    return nextResolve(pathToFileURL(resolvePath(projectRoot, "tests", "server-only-stub.mjs")).href, context);
  }

  if (specifier.startsWith("@/")) {
    const base = resolvePath(projectRoot, "src", specifier.slice(2));

    // Existence is checked here rather than by handing each candidate to
    // nextResolve and catching: a bare directory RESOLVES fine and only fails
    // later at load time, so the first candidate would always win and
    // "@/lib/timezones" would never reach its index.ts.
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base]) {
      if (isFile(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
