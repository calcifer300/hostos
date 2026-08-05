import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeInboundEmail } from "@/lib/ihost/analyze";
import { getKnowledgeBase } from "@/lib/knowledge/queries";
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
    // Ground the reply in the host's own saved knowledge base when they have
    // one; the shipped defaults are only a starting point.
    const session = await auth();
    const kb = session?.user?.email
      ? await getKnowledgeBase(session.user.email)
      : defaultKnowledgeBase;

    const analysis = await analyzeInboundEmail(email, kb);
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
