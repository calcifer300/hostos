import "server-only";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHost } from "@/lib/host/queries";
import { getRiskQueues } from "@/lib/risk/queries";
import { getRestaurants, getLatestComparisonSummaries, getOrders } from "@/lib/restaurants/queries";
import { getTasks, summarizeTasks } from "@/lib/tasks/queries";
import { getSyncedEmails } from "@/lib/gmail/queries";
import { computeOrderAnalytics, formatMoney } from "@/lib/restaurants/analytics";
import type { BriefingSignal } from "@/lib/butler";

/**
 * Everything the morning briefing is allowed to talk about, as short factual
 * lines. Collected from the same queries the pages use, so the Butler cannot
 * describe a state the dashboard would not show.
 */
export async function collectBriefingSignals(hostId: string, userEmail: string | null): Promise<BriefingSignal[]> {
  const host = await getHost(hostId);
  const timezone = host?.timezone ?? "America/Denver";

  const [dashboard, risk, restaurants, comparisons, orders, tasks, emails] = await Promise.all([
    getDashboardData(userEmail),
    getRiskQueues(hostId, timezone),
    getRestaurants(hostId),
    getLatestComparisonSummaries(hostId),
    getOrders(hostId, null, 1000),
    getTasks(hostId),
    userEmail ? getSyncedEmails(userEmail, 8) : Promise.resolve([]),
  ]);

  const signals: BriefingSignal[] = [];

  if (dashboard.pickups.length) {
    signals.push({ kind: "pickups", text: `${dashboard.pickups.length} pickups today: ${dashboard.pickups.slice(0, 6).map((p) => `${p.guestName} (${p.vehicle}) at ${p.time}${p.licenseConfirmed === false ? " — license unverified" : ""}`).join("; ")}` });
  }
  if (dashboard.returns.length) {
    signals.push({ kind: "returns", text: `${dashboard.returns.length} returns today: ${dashboard.returns.slice(0, 6).map((r) => `${r.guestName} (${r.vehicle}) at ${r.time}`).join("; ")}` });
  }
  for (const o of dashboard.overdueReturns.slice(0, 5)) {
    signals.push({ kind: "overdue", text: `Overdue return: ${o.guestName} in ${o.vehicle}, was due ${o.time}${o.needsResponse ? " (guest waiting on a reply)" : ""}` });
  }
  for (const m of dashboard.messages.slice(0, 5)) {
    signals.push({ kind: "message", text: `Guest message from ${m.guestName} (${m.vehicle}), ${m.receivedAgo}, urgency ${m.urgency}: "${m.preview}"` });
  }
  for (const t of risk.licenses.slice(0, 5)) {
    signals.push({ kind: "risk", text: `License unverified: ${t.guestName} picks up ${t.vehicle}${t.hoursUntilPickup !== null ? ` in ${Math.round(t.hoursUntilPickup)}h` : ""}` });
  }
  for (const t of risk.profitRisk.slice(0, 5)) {
    signals.push({ kind: "risk", text: `${t.risk.premierProtection ? "Zero-deductible booking" : "Thin margin"}: ${t.guestName} in ${t.vehicle}${t.earnings?.perMile != null ? ` at $${t.earnings.perMile.toFixed(2)}/mile` : ""}` });
  }
  if (dashboard.vehicles.length) {
    const onTrip = dashboard.vehicles.filter((v) => v.status === "on_trip").length;
    signals.push({ kind: "fleet", text: `${onTrip} of ${dashboard.vehicles.length} vehicles are on a trip; fleet health score ${dashboard.fleetHealth.score}/100` });
  }

  for (const r of restaurants) {
    const analytics = computeOrderAnalytics(orders.filter((o) => o.restaurantId === r.id), r.timezone);
    const latest = comparisons.get(r.id);
    const pending = latest ? latest.summary.needsUpdate + latest.summary.missingOnDoordash : 0;
    signals.push({
      kind: "store",
      text: `${r.name} is ${r.status}; ${analytics.totalOrders} orders and ${formatMoney(analytics.revenue)} in the last 14 days${analytics.ordersChangePct !== null ? ` (${analytics.ordersChangePct >= 0 ? "+" : ""}${analytics.ordersChangePct}% vs prior)` : ""}${pending ? `; ${pending} menu changes pending on DoorDash` : ""}`,
    });
  }

  const counts = summarizeTasks(tasks);
  if (counts.open + counts.inProgress > 0) {
    const top = tasks.filter((t) => t.status === "open" || t.status === "in_progress").slice(0, 5);
    signals.push({ kind: "tasks", text: `${counts.open + counts.inProgress} open tasks (${counts.overdue} overdue, ${counts.critical} critical): ${top.map((t) => t.title).join("; ")}` });
  }

  for (const e of emails.slice(0, 5)) {
    signals.push({ kind: "email", text: `Email from ${e.fromName ?? e.fromEmail ?? "unknown"}: ${e.subject ?? "(no subject)"}${e.isUnread ? " (unread)" : ""}` });
  }

  return signals;
}
