import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSyncedEmails } from "@/lib/gmail/queries";
import { generateBriefing } from "@/lib/ihost/briefing";
import { AiNotConfiguredError, isAiConfigured } from "@/lib/ai";

/** How many of the newest synced messages the briefing considers. */
const BRIEFING_WINDOW = 12;

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Not signed in.", reason: "unauthenticated" }, { status: 401 });
  }

  // Checked before doing any work so an unconfigured install gets a calm
  // "not set up yet" state instead of a red failure.
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Gemini API key is missing.", reason: "not_configured" },
      { status: 200 }
    );
  }

  const emails = await getSyncedEmails(email, BRIEFING_WINDOW);

  if (emails.length === 0) {
    return NextResponse.json({ reason: "no_messages" }, { status: 200 });
  }

  try {
    const briefing = await generateBriefing(emails);
    return NextResponse.json({ briefing });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message, reason: "not_configured" }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : "iHost could not generate a briefing.";
    return NextResponse.json({ error: message, reason: "failed" }, { status: 502 });
  }
}
