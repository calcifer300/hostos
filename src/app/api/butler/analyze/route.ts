import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requiresAuth } from "@/lib/access";
import { getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { analyzeFleetMessage } from "@/lib/butler";
import type { InboundTuroEmail } from "@/types/butler";

/**
 * Single-message analysis for the dashboard's briefing card. Session-gated
 * on a hosted deployment (it reads the workspace's knowledge base), open
 * locally like every other page.
 */
export async function POST(req: NextRequest) {
  if (requiresAuth()) {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Sign in to use the Butler." }, { status: 401 });
  }
  if (await hasNoFleetAccess()) return NextResponse.json({ error: "Your workspace isn't ready yet." }, { status: 409 });

  let email: InboundTuroEmail;
  try {
    const body = await req.json();
    if (!body?.body || typeof body.body !== "string") {
      return NextResponse.json({ error: "Request must include a non-empty 'body' field." }, { status: 400 });
    }
    email = {
      guestName: typeof body.guestName === "string" && body.guestName.trim() ? body.guestName.trim() : "The guest",
      vehicle: typeof body.vehicle === "string" && body.vehicle.trim() ? body.vehicle.trim() : "their vehicle",
      subject: typeof body.subject === "string" ? body.subject : "",
      body: String(body.body).slice(0, 8000),
      receivedAt: new Date().toISOString(),
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const hostId = await getCurrentHostId();
    const analysis = await analyzeFleetMessage(hostId, email);
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
