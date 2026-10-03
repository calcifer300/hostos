import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { briefing, isAiConfigured, AiNotConfiguredError } from "@/lib/butler";
import { collectBriefingSignals } from "@/lib/butler/signals";

/**
 * The morning briefing across every module in the workspace. Replaces
 * /api/ihost/briefing, which only ever read Gmail — a Companion-only fleet
 * or a restaurant workspace got nothing from it.
 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "Not signed in.", reason: "unauthenticated" }, { status: 401 });
  }
  if (await hasNoFleetAccess()) {
    return NextResponse.json({ reason: "no_workspace" }, { status: 200 });
  }

  // Checked before doing any work so an unconfigured install gets a calm
  // "not set up yet" state instead of a red failure.
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI isn't configured.", reason: "not_configured" }, { status: 200 });
  }

  const hostId = await getCurrentHostId();
  const signals = await collectBriefingSignals(hostId, email);
  if (signals.length === 0) {
    return NextResponse.json({ reason: "no_signals" }, { status: 200 });
  }

  try {
    const result = await briefing(signals);
    return NextResponse.json({ briefing: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message, reason: "not_configured" }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : "The Butler could not generate a briefing.";
    return NextResponse.json({ error: message, reason: "failed" }, { status: 502 });
  }
}
