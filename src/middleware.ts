import { NextResponse, type NextRequest } from "next/server";
import { APP_BASE, LEGACY_APP_PATHS } from "@/lib/routes";

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

/**
 * The product moved under /app when the root became the public landing page.
 * Bookmarks, the Companion's deep links and a year of shared URLs still spell
 * the old paths, so they are redirected (301) rather than left to 404.
 */
const LEGACY = new Set<string>(LEGACY_APP_PATHS);

function legacyRedirect(req: NextRequest): NextResponse | null {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first || !LEGACY.has(first)) return null;
  // /fleet was the vehicle list and /fleet/<name> a vehicle; /app/fleet is now
  // the Fleet dashboard, so both land under /app/fleet/vehicles.
  const path = first === "fleet" && segments[1] !== "vehicles" ? `/fleet/vehicles${req.nextUrl.pathname.slice("/fleet".length)}` : req.nextUrl.pathname;
  const target = new URL(`${APP_BASE}${path}`, req.url);
  target.search = req.nextUrl.search;
  return NextResponse.redirect(target, 301);
}

function isProductPath(pathname: string): boolean {
  return pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`);
}

/**
 * One canonical host. www.hostoscollective.com is served by the same
 * deployment but redirects to the apex, so cookies, OAuth callbacks and
 * search engines all see a single address. hostos-ten.vercel.app is left
 * alone on purpose: it keeps working as a fallback and the Companion's
 * existing pairings still point at it.
 */
function canonicalRedirect(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  if (!host.startsWith("www.")) return null;
  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host.slice(4)}`);
  return NextResponse.redirect(target, 308);
}

/**
 * Paths that do their own auth (or none) and must never be gated here. They
 * still get the canonical-host redirect above — /login and /api/auth on the
 * www host produced a Google callback URL Google had never been told about
 * ("Error 400: redirect_uri_mismatch") until that redirect covered them.
 *
 *  - /login and Auth.js's own routes, or signing in would loop
 *  - /api/turo/* — the Companion extension authenticates with a bearer
 *    pairing key, not a session cookie, and gating it here would break
 *    ingest for every fleet
 *  - /api/companion/* — same extension, same bearer key; every route under
 *    it calls requireCompanionHost for itself
 *  - /api/cron/*  — Vercel Cron sends a bearer CRON_SECRET; that route
 *    refuses to run at all when the secret is unset
 *
 * EVERY ENTRY HERE IS A ROUTE THAT MUST DO ITS OWN AUTH.
 */
const OWN_AUTH_PREFIXES = ["/login", "/api/auth", "/api/turo", "/api/companion", "/api/cron"];

function doesOwnAuth(pathname: string): boolean {
  return OWN_AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  const canonical = canonicalRedirect(req);
  if (canonical) return canonical;

  // The landing page lives on the site project. The app's bare root (hostos-ten.vercel.app/) sends visitors there instead of
  // showing an older marketing page; localhost keeps its own root for development.
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  if (req.nextUrl.pathname === "/" && host.endsWith(".vercel.app")) return NextResponse.redirect(new URL("https://hostoscollective.com/"), 308);

  if (doesOwnAuth(req.nextUrl.pathname)) return NextResponse.next();

  const legacy = legacyRedirect(req);
  if (legacy) return legacy;

  // Only the product is gated. The landing page, /login and the public assets
  // are meant to be seen signed-out — that is what they are for.
  if (!isProductPath(req.nextUrl.pathname)) return NextResponse.next();

  if (!requiresAuth()) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();

  const login = new URL("/login", req.url);
  // So a shared deep link still lands where it was aimed after signing in.
  login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Every request except Next's static assets and the favicon, so the
   * canonical-host redirect applies to /login, /api/auth and the public
   * files too. Which routes are gated — and which do their own auth — is
   * decided in middleware() above (see OWN_AUTH_PREFIXES), not here.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
