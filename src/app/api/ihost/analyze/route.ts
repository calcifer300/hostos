import { NextRequest, NextResponse } from "next/server";
import { analyzeInboundEmail } from "@/lib/ihost/analyze";
import { defaultKnowledgeBase } from "@/lib/mock/seed-emails";
import type { InboundTuroEmail } from "@/types/ihost";

export async function POST(req: NextRequest) {
  let email: InboundTuroEmail;

  try {
    const body = await req.json();
    if (!body?.body || typeof body.body !== "string") {
      return NextResponse.json(
        { error: "Request must include a non-empty 'body' field." },
        { status: 400 }
      );
    }
    email = {
      guestName: body.guestName || "The guest",
      vehicle: body.vehicle || "their vehicle",
      subject: body.subject || "",
      body: body.body,
      receivedAt: new Date().toISOString(),
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const analysis = await analyzeInboundEmail(email, defaultKnowledgeBase);
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
