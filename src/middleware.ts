import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate for hosted deployments.
 *
 * THIS MUST BE MIDDLEWARE, NOT A LAYOUT CHECK.
 *
 * The first two attempts at this gate both looked correct in a browser and
 * both leaked. In the App Router a layout and its child page render in
 * PARALLEL, so a layout that refuses to render `{children}` does not stop the
 * page beneath it from executing its queries — and the result is serialised
 * into the RSC flight payload carried by the very same HTTP response.
 *
 * Measured against a production build with the gate in the layout:
 *   - returning <SignInRequired /> : 200, and guest names, plates and vehicle
 *     models all present in the HTML source
 *   - calling redirect("/login")  : 307, and the SAME data still present in
 *     the 307's body
 *
 * Middleware runs before routing, so nothing downstream executes at all. The
 * layout check is gone; this is the gate.
 *
 * Cookie presence is the test here rather than a full JWT verification:
 * middleware runs on the edge runtime, and pulling the NextAuth config in
 * would drag `server-only` modules and the Supabase client along with it. A
 * forged cookie therefore gets past middleware — and lands on a page whose
 * queries are all host-scoped through getCurrentHostId(), which resolves
 * membership from a properly verified session and falls back to the default
 * fleet. So a forged cookie buys the same view a signed-out local visitor
 * already has, never another operator's fleet.
 */

// Auth.js v5 names its session cookie `authjs.session-token`, prefixed with
// `__Secure-` over HTTPS. v4's `next-auth.*` names are accepted too so an
// in-place upgrade doesn't lock everyone out.
const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => {
    const value = req.cookies.get(name)?.value;
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Mirrors lib/access.ts. Duplicated rather than imported because that module
 * is `server-only` and this runs on the edge; the two are three lines and are
 * kept in sync deliberately.
 */
function requiresAuth(): boolean {
  const raw = process.env.HOSTOS_REQUIRE_AUTH?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function middleware(req: NextRequest) {
  if (!requiresAuth()) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();

  const login = new URL("/login", req.url);
  // So a shared deep link still lands where it was aimed after signing in.
  login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except:
   *  - /login and Auth.js's own routes, or signing in would loop
   *  - /api/turo/* — the Companion extension authenticates with a bearer
   *    pairing key, not a session cookie, and gating it here would break
   *    ingest for every fleet
   *  - /api/companion/* — same extension, same bearer key. Drafting a reply
   *    happens from a content script on turo.com or a mail tab, which carries
   *    no HostOS session cookie; every route under it calls
   *    requireCompanionHost for itself
   *  - /api/cron/*  — Vercel Cron sends a bearer CRON_SECRET, also not a
   *    session; that route refuses to run at all when the secret is unset
   *  - Next's static assets and the favicon
   *
   * EVERY EXEMPTION HERE IS A ROUTE THAT MUST DO ITS OWN AUTH. The two under
   * /api/turo that a browser can GET were reachable by anyone for exactly this
   * reason until lib/api/browser-auth.ts was added — an exemption is a promise
   * the route keeps, not one this file keeps for it.
   */
  matcher: [
    "/((?!login|api/auth|api/turo|api/companion|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
