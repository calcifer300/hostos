import { NextRequest, NextResponse } from "next/server";
import { analyzeInboundEmail } from "@/lib/ihost/analyze";
import { getKnowledgeBase } from "@/lib/knowledge/queries";
import { getCurrentHostId } from "@/lib/host/context";
import { findRelevantPolicy } from "@/lib/library/queries";
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
    // Ground the reply in this fleet's own saved knowledge base when it has
    // one; the shipped defaults are only a starting point. Fleet-scoped since
    // migration 0013 — a Companion-only operator has no Google session, and
    // used to silently get the generic defaults on every draft.
    const hostId = await getCurrentHostId();

    // The two grounding sources, fetched together. Knowledge is how this host
    // operates; the policy hits are what Turo actually allows.
    // findRelevantPolicy returns nothing rather than something weak — an
    // irrelevant article in the prompt is worse than none, because the model
    // will try to use it.
    const [kb, policy] = await Promise.all([
      getKnowledgeBase(hostId),
      findRelevantPolicy(email.subject + " " + email.body),
    ]);

    const analysis = await analyzeInboundEmail(email, kb, policy);
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
