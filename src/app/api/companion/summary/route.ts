import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getRiskQueues } from "@/lib/risk/queries";
import { runQueryOr } from "@/lib/supabase/server";

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

interface CompanionAlert {
  /** Stable per trip AND per kind, so re-notifying is suppressed but a trip that develops a second problem still says so. */
  key: string;
  kind: "licence" | "profit" | "premier";
  title: string;
  body: string;
  severity: "critical" | "high" | "medium";
  tripId: string;
}

/** Turns the risk queues into the alerts a person should actually see. */
function buildAlerts(queues: Awaited<ReturnType<typeof getRiskQueues>>): CompanionAlert[] {
  const alerts: CompanionAlert[] = [];
  const who = (t: { guestName: string; vehicle: string }) => `${t.guestName} · ${t.vehicle}`;

  for (const trip of queues.licenses) {
    alerts.push({
      key: `licence:${trip.id}`,
      kind: "licence",
      title: "Licence still unverified",
      // The window matters: a guest cannot upload until 24h before pickup, so
      // this is the point where it stops being early and starts being late.
      body: `${who(trip)} — pickup is within 24 hours and the licence isn't confirmed.`,
      severity: "critical",
      tripId: trip.id,
    });
  }

  for (const trip of queues.profitRisk) {
    // Premier is its own alert, not a flavour of profit risk: the action is
    // different. A thin margin is a pricing decision; a $0 deductible means
    // damage cannot be billed to the guest at all.
    if (trip.risk.premierProtection) {
      alerts.push({
        key: `premier:${trip.id}`,
        kind: "premier",
        title: "Zero-deductible booking",
        body: `${who(trip)} — the guest's plan leaves you unable to bill them for damage.`,
        severity: "critical",
        tripId: trip.id,
      });
    }

    if (trip.risk.earningsBelowFloor) {
      const perMile = trip.earnings?.perMile;
      alerts.push({
        key: `profit:${trip.id}`,
        kind: "profit",
        title: "Below $0.20 per mile",
        body: `${who(trip)}${perMile != null ? ` — earns ${perMile.toFixed(2)}/mile` : ""}.`,
        severity: "high",
        tripId: trip.id,
      });
    }
  }

  return alerts;
}

export async function GET(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  try {
    const queues = await getRiskQueues(host.id, host.timezone);

    /**
     * Which reservations the extension should go and read a licence status for.
     *
     * DECIDED HERE, NOT IN THE EXTENSION. isLicenseCheckEligible required the
     * extension to have computed a numeric startTs, which it only manages for
     * cards that printed a clock time — so the sweep listed nine trips as
     * "starting within 24h" and then checked none of them, every cycle.
     *
     * The server has the real start times now, resolved in the fleet's own
     * zone, so the window is computed against something true.
     */
    const now = Date.now();
    const in24h = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    const { data: pending } = await runQueryOr<{ id: string }[]>(
      "trips.license_queue",
      [],
      (client) =>
        client
          .from("trips")
          .select("id")
          .eq("host_id", host.id)
          .eq("action", "checkin")
          .gte("start_ts", new Date(now).toISOString())
          .lte("start_ts", in24h)
          // Already-confirmed licences need no second look; null means never
          // checked, false means checked and still outstanding.
          .or("license_confirmed.is.null,license_confirmed.eq.false")
          .order("start_ts", { ascending: true })
          .limit(40)
          .returns<{ id: string }[]>()
    );

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
      // Reservation ids for the extension's licence sweep to open.
      licenseQueue: pending.map((r) => r.id),
      /**
       * The actual things worth interrupting someone about.
       *
       * The extension used to derive its alerts from trip_events, whose kinds
       * are only created / rescheduled / cancelled / plate_changed — so its
       * "licence" and "Premier" tests matched nothing and those two alerts
       * could never fire, however the toggles were set. Profit risk had no
       * test at all.
       *
       * The risk engine already knows all three. It says so here, and the
       * extension only decides whether to show them.
       */
      alerts: buildAlerts(queues),
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
