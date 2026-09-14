import "server-only";
import type { RiskQueues } from "@/lib/risk/queries";

/**
 * Turns the risk queues into the alerts a person should actually see.
 *
 * Shared by /api/companion/summary (what to SHOW) and the dispatch route
 * (what to SEND). Two copies would drift, and the drift would be silent:
 * a desktop notification and an email disagreeing about whether a trip is a
 * problem is worse than either one being wrong on its own.
 */
export interface CompanionAlert {
  /** Stable per trip AND per kind, so re-notifying is suppressed but a trip that develops a second problem still says so. */
  key: string;
  kind: "licence" | "profit" | "premier";
  title: string;
  body: string;
  severity: "critical" | "high" | "medium";
  tripId: string;
}

export function buildAlerts(queues: RiskQueues): CompanionAlert[] {
  const alerts: CompanionAlert[] = [];
  const who = (t: { guestName: string; vehicle: string }) => `${t.guestName} · ${t.vehicle}`;

  for (const trip of queues.licenses) {
    alerts.push({
      key: `licence:${trip.id}`,
      kind: "licence",
      title: "License still unverified",
      // The window matters: a guest cannot upload until 24h before pickup, so
      // this is the point where it stops being early and starts being late.
      body: `${who(trip)} — pickup is within 24 hours and the license isn't confirmed.`,
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
