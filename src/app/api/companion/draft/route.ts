import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getServerEnv } from "@/lib/env";
import { analyzeFleetMessage } from "@/lib/butler";

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
    // One brain for every surface: the same grounding (knowledge base,
    // templates, relevant Turo policy) the dashboard and the restaurant
    // pages use — see lib/butler.
    const analysis = await analyzeFleetMessage(host.id, {
      guestName: payload.guestName?.trim() || "This guest",
      vehicle: payload.vehicle?.trim() || "their vehicle",
      subject: payload.subject?.trim() || "",
      body: message,
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      draft: analysis.draftReply,
      summary: analysis.summary,
      // Surfaced so the extension can refuse to auto-paste and make the
      // person read it first. A draft about an injury or a legal threat is
      // exactly the one that must not be sent on a keyboard shortcut.
      escalate: analysis.escalate ?? false,
      escalateReason: analysis.escalateReason ?? null,
      // Cited so a host can check the claim rather than trust it.
      sources: analysis.sources.filter((s) => s.kind === "policy").map((p) => ({ title: p.title, url: p.url })),
    });
  } catch (err) {
    /**
     * Not ingestFailureResponse. That helper is for the routes that STORE a
     * payload, and it says so — "Failed to store the payload" is what this
     * route returned when the model 404'd, which told the person at the
     * keyboard nothing true about what went wrong.
     *
     * The distinction that matters to a client here is whether trying again
     * could work. A model that has been retired, or a key that was rejected,
     * will fail identically forever; a timeout or a dropped connection will
     * not.
     */
    const message = err instanceof Error ? err.message : String(err);
    const transient = /fetch failed|network|socket|timeout|ECONN|ENOTFOUND|EAI_AGAIN|50[234]/i.test(message);

    console.error(`[companion/draft] ${transient ? "upstream unavailable" : "failed"}: ${message}`);

    if (transient) {
      return NextResponse.json(
        { error: "Couldn't reach the AI service just now. Try again in a moment.", retryable: true },
        { status: 503, headers: { "Retry-After": "20" } }
      );
    }

    // Surfaced rather than swallowed: when the cause is a retired model or a
    // rejected key, the operator can only fix it if they are told which.
    return NextResponse.json(
      {
        error: "The AI service refused this request, so no draft was written.",
        detail: message.slice(0, 300),
        retryable: false,
      },
      { status: 502 }
    );
  }
}
