import { NextResponse, type NextRequest } from "next/server";
import { ingestFailureResponse, requireCompanionHost } from "@/lib/api/companion-auth";
import { getKnowledgeBase } from "@/lib/knowledge/queries";
import { findRelevantPolicy } from "@/lib/library/queries";
import { analyzeInboundEmail } from "@/lib/ihost/analyze";
import { getServerEnv } from "@/lib/env";

/**
 * Drafts a reply for the Companion extension.
 *
 * This route is the reason Karl's AI-reply extension was worth merging rather
 * than shipping alongside. His version called Gemini directly with its own API
 * key and no context, so it wrote fluent, confident replies that knew nothing
 * about the host — not their check-in process, not their tone, not Turo's
 * policy. Same model, no grounding.
 *
 * Going through HostOS means one credential instead of two (the pairing key
 * the extension already holds), the host's own knowledge base, and the
 * relevant Turo help-centre articles. The key also scopes the draft: a
 * Companion paired to one fleet cannot pull another fleet's house rules.
 */

interface DraftRequest {
  message?: string;
  guestName?: string;
  vehicle?: string;
  subject?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  let payload: DraftRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = (payload.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Nothing to reply to." }, { status: 400 });
  }

  // Bounded before it reaches a model. A content script scrapes whatever the
  // page holds, and an unbounded paste is someone else's token bill.
  if (message.length > 8000) {
    return NextResponse.json(
      { error: "That message is too long to draft from — trim it and try again." },
      { status: 413 }
    );
  }

  if (!getServerEnv().geminiApiKey) {
    // Said plainly rather than as a 500: the extension shows this to a person,
    // and "AI isn't configured" is a setup step, not a fault they can retry.
    return NextResponse.json(
      {
        error: "AI drafting isn't turned on for this HostOS deployment.",
        retryable: false,
      },
      { status: 503 }
    );
  }

  try {
    const [kb, policy] = await Promise.all([
      getKnowledgeBase(host.id),
      findRelevantPolicy(message),
    ]);

    const analysis = await analyzeInboundEmail(
      {
        guestName: payload.guestName?.trim() || "This guest",
        vehicle: payload.vehicle?.trim() || "their vehicle",
        subject: payload.subject?.trim() || "",
        body: message,
        receivedAt: new Date().toISOString(),
      },
      kb,
      policy
    );

    return NextResponse.json({
      draft: analysis.draftReply,
      summary: analysis.summary,
      // Surfaced so the extension can refuse to auto-paste and make the
      // person read it first. A draft about an injury or a legal threat is
      // exactly the one that must not be sent on a keyboard shortcut.
      escalate: analysis.escalate ?? false,
      escalateReason: analysis.escalateReason ?? null,
      // Cited so a host can check the claim rather than trust it.
      sources: policy.map((p) => ({ title: p.title, url: p.url })),
    });
  } catch (err) {
    return ingestFailureResponse("companion/draft", err);
  }
}
