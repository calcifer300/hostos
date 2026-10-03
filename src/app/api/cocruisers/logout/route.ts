import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/pulse/access";

export const dynamic = "force-dynamic";

/** Locks this browser again. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
