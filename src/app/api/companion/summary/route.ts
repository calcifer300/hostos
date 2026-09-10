import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getRiskQueues } from "@/lib/risk/queries";

/**
 * The counts behind the in-page widget.
 *
 * The widget could compute these itself from the scraped page — the CC build
 * it is ported from did exactly that. It doesn't, because then the floating
 * card and the dashboard would each have their own idea of how many trips need
 * attention, and would disagree the moment either one's rules changed. The
 * risk engine already runs server-side for /risk; this is the same call.
 *
 * Authenticated by the pairing key the Companion already holds, so the numbers
 * are scoped to that fleet and nobody else's.
 */

export async function GET(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  try {
    const queues = await getRiskQueues(host.id, host.timezone);

    const licenses = queues.licenses.length;
    const profitRisk = queues.profitRisk.length;
    const returningToday = queues.returningToday.length;

    const estimatedToday = queues.returningToday.reduce(
      (sum, trip) => sum + (trip.earnings?.earnings ?? 0),
      0
    );

    return NextResponse.json({
      // The fleet's own name, so the widget says whose board this is. The CC
      // build hardcoded one client's name into the markup, which stopped being
      // an option the moment one deployment served many fleets.
      fleetName: host.name ?? "HostOS",
      // What the header number counts. Licences and profit risk are the two
      // queues a person actually acts on; the earnings estimate is reference,
      // not a task, so it is deliberately excluded from the total.
      actionRequired: licenses + profitRisk,
      licenses,
      profitRisk,
      returningToday,
      estimatedToday: Math.round(estimatedToday),
      // Says "we can't price these" rather than showing a confident $0.
      pricingUnavailable: queues.pricingUnavailable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[companion/summary] ${message}`);
    return NextResponse.json(
      { error: "Couldn't load the summary.", retryable: true },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
}
