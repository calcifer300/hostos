import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE_S, accessConfigured, checkPin, clearFailures, lockedFor, makeToken, recordFailure } from "@/lib/pulse/access";

export const dynamic = "force-dynamic";

function addressOf(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** The 4-digit key. A wrong key is slowed down, and five wrong keys from one address lock it out for 15 minutes. */
export async function POST(req: NextRequest) {
  if (!accessConfigured()) return NextResponse.json({ error: "This page is not set up yet." }, { status: 503 });
  const address = addressOf(req);
  const locked = lockedFor(address);
  if (locked > 0) {
    return NextResponse.json({ error: "Too many wrong tries. Try again later.", retryAfter: locked }, { status: 429, headers: { "Retry-After": String(locked) } });
  }
  let pin: unknown;
  try {
    pin = (await req.json())?.pin;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!checkPin(pin)) {
    const left = recordFailure(address);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: left ? "That key is not right." : "Too many wrong tries. Try again in 15 minutes.", attemptsLeft: left }, { status: 401 });
  }
  clearFailures(address);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, makeToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE_S });
  return response;
}
