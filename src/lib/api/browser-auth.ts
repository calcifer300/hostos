import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { requiresAuth } from "@/lib/access";

/**
 * Gate for the browser-facing GET endpoints under /api/turo.
 *
 * Middleware deliberately skips /api/turo, because the Companion extension
 * authenticates its POSTs with a bearer pairing key and has no session cookie.
 * That exemption left the two GET endpoints — which return full guest
 * conversations — reachable by anyone.
 *
 * Their only previous protection was `Sec-Fetch-Site: same-origin`. That stops
 * a browser on another site, which is what it was written for, but it is a
 * request header: `curl -H "Sec-Fetch-Site: same-origin"` walks straight
 * through it. Verified against a gated production build — the endpoint
 * returned every guest name and message body while every page correctly
 * redirected.
 *
 * So on a deployment that requires auth, these also require a real session.
 * The same-origin check stays as the CSRF-shaped defence it always was.
 */
export async function denyUnauthenticatedBrowserRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!requiresAuth()) return null;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to view this." }, { status: 401 });
  }

  return null;
}
