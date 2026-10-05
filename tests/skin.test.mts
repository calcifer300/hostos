import { isSkin, SKIN_BOOT_SCRIPT, SKIN_KEY, SKINS } from "../src/lib/skin.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${String(got)}\n        want ${String(want)}`}`);
};

/**
 * SKIN_BOOT_SCRIPT is a string of JavaScript inlined into <head> on every page,
 * with a regex escaped by hand inside a template literal. A slip there fails
 * silently — the look just never applies — so it is executed here against
 * stand-ins for the three globals it touches.
 */
function boot(pathname: string, stored: string | null, throwing = false): string | null {
  const attrs: Record<string, string> = {};
  const doc = { documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) } };
  const loc = { pathname };
  const ls = {
    getItem: (k: string) => {
      if (throwing) throw new Error("storage blocked");
      return k === SKIN_KEY ? stored : null;
    },
  };
  new Function("location", "localStorage", "document", SKIN_BOOT_SCRIPT)(loc, ls, doc);
  return attrs["data-skin"] ?? null;
}

console.log("=== the boot script applies the look inside /app, and only there ===");
eq("the app's own pages", boot("/app/overview", "mac"), "mac");
eq("the app root", boot("/app", "mac"), "mac");
eq("a deep app page", boot("/app/restaurants/abc/menu", "mac"), "mac");
eq("the sign-in page is left alone", boot("/login", "mac"), null);
eq("the marketing page is left alone", boot("/", "mac"), null);
eq("a path that merely starts with 'app' is not /app", boot("/application", "mac"), null);
eq("nor is /apps", boot("/apps/x", "mac"), null);

console.log("\n=== and only when the macOS look was chosen ===");
eq("nothing stored", boot("/app/overview", null), null);
eq("the default look", boot("/app/overview", "default"), null);
eq("an unknown value", boot("/app/overview", "windows95"), null);

console.log("\n=== blocked storage never breaks the page ===");
eq("it swallows the error and applies nothing", boot("/app/overview", "mac", true), null);

console.log("\n=== the looks on offer ===");
eq("two of them", SKINS.length, 2);
eq("the default comes first", SKINS[0].id, "default");
eq("macOS is offered", SKINS.some((s) => s.id === "mac"), true);
eq("every offered id is a valid skin", SKINS.every((s) => isSkin(s.id)), true);
eq("garbage is not a skin", isSkin("blue"), false);
eq("null is not a skin", isSkin(null), false);

// LAST LINE OF THE FILE, so the guard counts every assertion above it.
if (fail > 0) process.exitCode = 1;
