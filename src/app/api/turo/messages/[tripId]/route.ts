import { NextRequest, NextResponse } from "next/server";
import { denyUnauthenticatedBrowserRequest } from "@/lib/api/browser-auth";
import { getCurrentHostId } from "@/lib/host/context";
import { getTripMessageThread } from "@/lib/messages/queries";
import { getBackendHealth } from "@/lib/supabase/server";

/**
 * Polled client-side by the conversation detail page so a guest's new
 * message appears without a manual refresh — same same-origin gate as
 * GET /api/turo/messages (see that file's comment for why: this app is an
 * intentionally public shell, so the gate can't be "must be signed in").
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  // Same-origin check plus a real session on hosted deployments — see
  // lib/api/browser-auth.ts for why the header alone was not a gate.
  const denied = await denyUnauthenticatedBrowserRequest(req);
  if (denied) return denied;

  const { tripId: encodedTripId } = await params;
  const tripId = decodeURIComponent(encodedTripId);

  const thread = await getTripMessageThread(await getCurrentHostId(), tripId);

  // A null thread means "no such trip" or "couldn't read it". The poller uses
  // this flag to keep the messages already on screen rather than treating an
  // outage as a thread that just emptied out.
  const degraded = getBackendHealth().state === "degraded";

  return NextResponse.json({ thread, degraded });
}
