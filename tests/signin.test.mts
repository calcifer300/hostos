import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware.ts";
import { routes } from "../src/lib/routes.ts";
import { VERTICAL_COOKIE, VERTICAL_ROUTES } from "../src/lib/verticals.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${String(got)}\n        want ${String(want)}`}`);
};

/**
 * The sign-in path, exercised with the real middleware and the real service
 * worker script. Signing in is a chain — Google, then /api/auth/callback, then
 * /app — and every link has failed before in a way that surfaced as Next's
 * full-page "This page couldn't load" and could not be seen from inside the
 * code that caused it.
 */
process.env.HOSTOS_REQUIRE_AUTH = "true";

const HOST = "https://hostos-ten.vercel.app";

function run(path: string, cookie?: string) {
  const res = middleware(new NextRequest(`${HOST}${path}`, { headers: cookie ? { cookie } : {} }));
  const location = res.headers.get("location");
  return {
    status: res.status,
    location: location ? new URL(location).pathname + new URL(location).search : null,
    passedThrough: res.headers.get("x-middleware-next") === "1",
  };
}

console.log("=== signed out ===");
{
  const r = run("/app/board");
  eq("a product page redirects to /login", r.status, 307);
  eq("and remembers where it was headed", r.location, "/login?callbackUrl=%2Fapp%2Fboard");
  eq("the sign-in page is reachable", run("/login").passedThrough, true);
  eq("Auth.js's callback is never gated, or sign-in could not complete", run("/api/auth/callback/google").passedThrough, true);
  eq("an empty session cookie is signed out", run("/app/board", "authjs.session-token=").status, 307);
  eq("an unrelated cookie is signed out", run("/app/board", "foo=bar").status, 307);
  eq("a lookalike cookie name is signed out", run("/app/board", "authjs.session-token-evil=x").status, 307);
}

/**
 * Auth.js splits a session too big for one cookie into `.0`, `.1`, … A check
 * for the unsuffixed name saw that person as signed out, so /app and /login
 * redirected to each other until the browser gave up.
 */
console.log("\n=== signed in, however the cookie is stored ===");
{
  eq("one cookie", run("/app/board", "authjs.session-token=abc").passedThrough, true);
  eq("one cookie over HTTPS", run("/app/board", "__Secure-authjs.session-token=abc").passedThrough, true);
  eq(
    "a session split into chunks",
    run("/app/board", "__Secure-authjs.session-token.0=aaa; __Secure-authjs.session-token.1=bbb").passedThrough,
    true
  );
  eq("a v4 cookie from before the upgrade", run("/app/board", "next-auth.session-token=abc").passedThrough, true);
}

/**
 * /app only ever chooses a dashboard. Doing that with redirect() inside the
 * page came back as "This page couldn't load" after sign-in; an HTTP redirect
 * from middleware happens before anything renders.
 */
console.log("\n=== /app, where sign-in lands ===");
{
  const session = "__Secure-authjs.session-token=abc";
  const first = Object.entries(VERTICAL_ROUTES)[0];

  eq("with no business chosen, the chooser", run("/app", session).location, routes.start);
  eq("a trailing slash is the same", run("/app/", session).location, routes.start);
  eq("a chosen business, its dashboard", run("/app", `${session}; ${VERTICAL_COOKIE}=${first[0]}`).location, first[1]);
  eq("a junk business cookie falls back to the chooser", run("/app", `${session}; ${VERTICAL_COOKIE}=nonsense`).location, routes.start);
  eq("the query string survives", run("/app?welcome=1", session).location, `${routes.start}?welcome=1`);
  eq("it is a redirect, not a render", run("/app", session).status, 307);
  eq("other product pages are not redirected", run("/app/board", session).passedThrough, true);
}

/**
 * The previous worker answered every navigation, including the redirects in
 * the sign-in chain, and the browser painted an error instead of the workspace.
 */
console.log("\n=== the service worker stays out of sign-in ===");
{
  type Handler = (event: unknown) => void;
  const handlers: Record<string, Handler> = {};
  const fakeSelf = {
    location: { origin: HOST },
    addEventListener: (type: string, handler: Handler) => void (handlers[type] = handler),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const caches = { open: async () => ({ addAll: async () => {}, match: async () => undefined, put: async () => {} }), keys: async () => [], delete: async () => true, match: async () => undefined };
  new Function("self", "caches", "fetch", readFileSync("public/sw.js", "utf8"))(fakeSelf, caches, async () => new Response("ok"));

  /** Whether the worker took the request over. */
  const handled = (path: string, mode = "navigate", method = "GET") => {
    let responded = false;
    handlers.fetch({ request: { method, url: `${HOST}${path}`, mode }, respondWith: () => void (responded = true) });
    return responded;
  };

  eq("it never answers /login", handled("/login"), false);
  eq("nor the Auth.js callback", handled("/api/auth/callback/google"), false);
  eq("nor the session endpoint", handled("/api/auth/session"), false);
  eq("nor /app itself", handled("/app"), false);
  eq("nor any page inside the product", handled("/app/board"), false);
  eq("nor a deep link", handled("/app/restaurants/abc/menu"), false);
  eq("a path that merely starts with 'app' is not the product", handled("/apps"), true);
  eq("it still serves immutable build assets", handled("/_next/static/chunks/a.js", "no-cors"), true);
  eq("it still gives other pages the offline fallback", handled("/offline"), true);
  eq("it ignores anything that is not a GET", handled("/app/board", "navigate", "POST"), false);
  eq("and it replaces the old worker's cache", /hostos-shell-v2/.test(readFileSync("public/sw.js", "utf8")), true);
}

// LAST LINE OF THE FILE, so the guard counts every assertion above it.
if (fail > 0) process.exitCode = 1;
