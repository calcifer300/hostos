import "server-only";
import { getHost } from "@/lib/host/queries";
import { getRiskQueues } from "@/lib/risk/queries";
import { buildAlerts } from "@/lib/alerts/build";
import { getCompanionTrips } from "@/lib/trips/queries";
import { getRestaurants, getInventory, getLatestComparisonSummaries } from "@/lib/restaurants/queries";
import { createTask } from "@/lib/tasks/queries";
import { notify } from "@/lib/notifications/queries";
import { getDashboardData } from "@/lib/dashboard/queries";
import { routes } from "@/lib/routes";

/**
 * The Butler's rule-based hands: turns what the workspace already knows into
 * tasks and notifications. No model call — these are deterministic rules
 * over synced data, which is what makes them safe to run every few minutes
 * and cheap enough to run for every workspace.
 *
 * Every task and notification carries a dedupe key, so this can run as often
 * as it likes and each fact lands once. When the underlying fact resolves
 * (license verified, store reopened) the open task stays for a person to
 * close — the Butler never deletes work it didn't do.
 */

export interface ButlerRunSummary {
  tasksCreated: number;
  notificationsCreated: number;
  signals: string[];
}

export async function runButlerRules(hostId: string, options: { userEmail?: string | null } = {}): Promise<ButlerRunSummary> {
  const host = await getHost(hostId);
  const timezone = host?.timezone ?? "America/Denver";
  const summary: ButlerRunSummary = { tasksCreated: 0, notificationsCreated: 0, signals: [] };

  const [risk, trips, restaurants, comparisons, dashboard] = await Promise.all([
    getRiskQueues(hostId, timezone),
    getCompanionTrips(hostId),
    getRestaurants(hostId),
    getLatestComparisonSummaries(hostId),
    getDashboardData(options.userEmail ?? null),
  ]);

  const track = async (task: Parameters<typeof createTask>[0], note?: Parameters<typeof notify>[0]) => {
    const { created } = await createTask(task);
    if (created) summary.tasksCreated += 1;
    if (note) {
      const wrote = await notify(note);
      if (wrote) summary.notificationsCreated += 1;
    }
  };

  /* ---------------------------------------------------------- fleet risk */

  for (const alert of buildAlerts(risk)) {
    summary.signals.push(alert.body);
    const priority = alert.severity === "critical" ? "critical" : "high";
    await track(
      {
        hostId,
        title: alert.title,
        description: alert.body,
        priority,
        source: "butler",
        relatedKind: "trip",
        relatedId: alert.tripId,
        href: routes.risk,
        dedupeKey: `butler:${alert.key}`,
      },
      {
        hostId,
        kind: "alert",
        severity: alert.severity === "critical" ? "critical" : "warning",
        title: alert.title,
        body: alert.body,
        href: routes.risk,
        dedupeKey: `alert:${alert.key}`,
      }
    );
  }

  /* ------------------------------------------------------ overdue returns */

  for (const entry of dashboard.overdueReturns) {
    summary.signals.push(`${entry.guestName} · ${entry.vehicle} was due back ${entry.time}`);
    await track(
      {
        hostId,
        title: `Chase the overdue return: ${entry.guestName}`,
        description: `${entry.vehicle} was due back ${entry.time}. Message the guest and, if there's no reply, report a late return on Turo.`,
        priority: "high",
        source: "butler",
        relatedKind: "trip",
        relatedId: entry.tripId,
        href: routes.message(entry.tripId),
        dedupeKey: `butler:overdue:${entry.tripId}`,
      },
      {
        hostId,
        kind: "trip",
        severity: "warning",
        title: `Overdue return: ${entry.guestName}`,
        body: `${entry.vehicle} was due back ${entry.time}.`,
        href: routes.message(entry.tripId),
        dedupeKey: `overdue:${entry.tripId}:${entry.time}`,
      }
    );
  }

  /* ------------------------------------------------- unanswered messages */

  const waiting = dashboard.messages.filter((m) => m.urgency === "high");
  if (waiting.length > 0) {
    summary.signals.push(`${waiting.length} guest message(s) waiting more than two hours`);
    await track({
      hostId,
      title: `Reply to ${waiting.length} waiting guest${waiting.length === 1 ? "" : "s"}`,
      description: waiting.map((m) => `${m.guestName} (${m.vehicle}): ${m.preview}`).join("\n").slice(0, 3000),
      priority: "high",
      source: "butler",
      relatedKind: "messages",
      href: routes.messages,
      dedupeKey: `butler:messages:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  /* --------------------------------------------------------- restaurants */

  const now = Date.now();
  for (const r of restaurants) {
    if (r.status === "paused" || r.status === "deactivated") {
      const since = r.statusObservedAt ? Math.round((now - Date.parse(r.statusObservedAt)) / 60_000) : null;
      summary.signals.push(`${r.name} is ${r.status}${since !== null ? ` (${since} min)` : ""}`);
      await track(
        {
          hostId,
          title: `${r.name} is ${r.status} — bring it back online`,
          description: `The store has been ${r.status}${since !== null ? ` for ${since} minutes` : ""}. Check the Merchant Portal and the kitchen before reopening.`,
          priority: r.status === "deactivated" ? "critical" : "high",
          source: "butler",
          relatedKind: "restaurant",
          relatedId: r.id,
          href: routes.restaurant(r.id),
          dedupeKey: `butler:store:${r.id}:${r.status}:${r.statusObservedAt ?? "unknown"}`,
        },
        {
          hostId,
          kind: "restaurant",
          severity: r.status === "deactivated" ? "critical" : "warning",
          title: `${r.name} is ${r.status}`,
          body: since !== null ? `For ${since} minutes.` : null,
          href: routes.restaurant(r.id),
          dedupeKey: `store:${r.id}:${r.status}:${r.statusObservedAt ?? "unknown"}`,
        }
      );
    }

    const latest = comparisons.get(r.id);
    if (latest && latest.summary.needsUpdate + latest.summary.missingOnDoordash > 0) {
      summary.signals.push(`${r.name}: ${latest.summary.needsUpdate + latest.summary.missingOnDoordash} menu changes pending on DoorDash`);
    }

    const inventory = await getInventory(hostId, r.id);
    const low = inventory.filter((i) => i.quantity !== null && i.quantity <= (i.lowStockThreshold ?? r.lowStockThreshold));
    if (low.length > 0) {
      summary.signals.push(`${r.name}: ${low.length} tracked item(s) low on stock`);
      await track(
        {
          hostId,
          title: `Restock ${low.length} item${low.length === 1 ? "" : "s"} at ${r.name}`,
          description: low.map((i) => `${i.name}: ${i.quantity} left`).join(", ").slice(0, 3000),
          priority: "medium",
          source: "butler",
          relatedKind: "restaurant",
          relatedId: r.id,
          href: routes.restaurantTab(r.id, "inventory"),
          dedupeKey: `butler:lowstock:${r.id}:${low.map((i) => i.id).sort().join(",").slice(0, 120)}`,
        },
        {
          hostId,
          kind: "restaurant",
          severity: "warning",
          title: `${r.name}: ${low.length} item${low.length === 1 ? "" : "s"} low on stock`,
          body: low
            .slice(0, 4)
            .map((i) => `${i.name} (${i.quantity})`)
            .join(", "),
          href: routes.restaurantTab(r.id, "inventory"),
          dedupeKey: `lowstock:${r.id}:${new Date().toISOString().slice(0, 10)}`,
        }
      );
    }
  }

  /* -------------------------------------------------- upcoming pickups */

  const soon = trips.filter((t) => t.action === "checkin" && t.startsAt && Date.parse(t.startsAt) - now < 3 * 3600_000 && Date.parse(t.startsAt) > now);
  for (const t of soon) {
    summary.signals.push(`${t.guestName ?? "A guest"} picks up ${t.vehicleMake ?? ""} ${t.vehicleModel ?? ""} within 3 hours`);
  }

  return summary;
}
