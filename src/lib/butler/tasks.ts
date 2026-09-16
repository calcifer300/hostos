import "server-only";
import { getHost } from "@/lib/host/queries";
import { getRiskQueues } from "@/lib/risk/queries";
import { buildAlerts } from "@/lib/alerts/build";
import { getCompanionTrips } from "@/lib/trips/queries";
import { getRestaurants, getInventory, getLatestComparisonSummaries } from "@/lib/restaurants/queries";
import { createTask } from "@/lib/tasks/queries";
import { notify } from "@/lib/notifications/queries";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHostModules } from "@/lib/host/queries";
import { getEstimates, getJobs, getServiceSettings, getStaff } from "@/lib/services/queries";
import { isOpen as jobIsOpen, isOverdue, missingPhotos, needsFollowUp, onDay } from "@/lib/services/analytics";
import { todayInZone } from "@/lib/timezones";
import { daysUntil, getProperties } from "@/lib/web/queries";
import { clientsDueForRebooking, getClients, getLocations, getStock } from "@/lib/local/queries";
import { getMetrics } from "@/lib/custom/queries";
import { metricStatus } from "@/lib/custom/analytics";
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

  /* ------------------------------------------- web, cafés, barbershops, custom */

  const modules = await getHostModules(hostId);

  if (modules.includes("web")) {
    for (const p of await getProperties(hostId)) {
      const dom = daysUntil(p.domainExpiresAt);
      const ssl = daysUntil(p.sslExpiresAt);
      if (p.status === "down") summary.signals.push(`${p.domain} is down`);
      if (dom !== null && dom <= 30) {
        summary.signals.push(`${p.domain} renews in ${dom} days`);
        await track({ hostId, title: `Renew ${p.domain} — ${dom <= 0 ? "expired" : `${dom} day${dom === 1 ? "" : "s"} left`}`, description: p.autoRenew ? "Auto-renew is on; confirm the card on file still works." : "Auto-renew is off. Renew before it lapses.", priority: dom <= 7 ? "critical" : "high", source: "butler", relatedKind: "web_property", relatedId: p.id, href: routes.web, dedupeKey: `web-renew:${p.id}:${p.domainExpiresAt}` });
      }
      if (ssl !== null && ssl <= 14) summary.signals.push(`${p.domain}: SSL expires in ${ssl} days`);
    }
  }

  for (const kind of ["cafe", "salon"] as const) {
    if (!modules.includes(kind)) continue;
    const [locations, stock] = await Promise.all([getLocations(hostId, kind), getStock(hostId, kind)]);
    const href = kind === "cafe" ? routes.cafe : routes.salon;
    for (const l of locations) {
      const low = stock.filter((s) => s.locationId === l.id && s.quantity <= (s.lowStockThreshold ?? l.lowStockThreshold));
      if (low.length === 0) continue;
      summary.signals.push(`${l.name}: ${low.length} item(s) low on stock`);
      await track(
        { hostId, title: `Restock ${low.length} item${low.length === 1 ? "" : "s"} at ${l.name}`, description: low.map((i) => `${i.name}: ${i.quantity} ${i.unit}`).join(", ").slice(0, 3000), priority: "medium", source: "butler", relatedKind: `${kind}_stock`, relatedId: l.id, href, dedupeKey: `butler:lowstock:${l.id}:${low.map((i) => i.id).sort().join(",").slice(0, 120)}` },
        { hostId, kind, severity: "warning", title: `${l.name}: ${low.length} item${low.length === 1 ? "" : "s"} low on stock`, body: low.slice(0, 4).map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", "), href, dedupeKey: `lowstock:${l.id}:${new Date().toISOString().slice(0, 10)}` }
      );
    }
    if (kind === "salon") {
      const due = clientsDueForRebooking(await getClients(hostId), locations);
      if (due.length > 0) {
        summary.signals.push(`${due.length} client(s) due for a rebooking reminder`);
        await track({ hostId, title: `Send rebooking reminders to ${due.length} client${due.length === 1 ? "" : "s"}`, description: due.slice(0, 12).map((c) => `${c.name} (${c.daysSince}d${c.phone ? `, ${c.phone}` : ""})`).join(", "), priority: "medium", source: "butler", relatedKind: "salon_client", relatedId: null, href: routes.salon, dedupeKey: `butler:rebook:${new Date().toISOString().slice(0, 10)}` });
      }
    }
  }

  if (modules.includes("services")) {
    // The operations manager's morning: what is unassigned, what is late,
    // which estimates went quiet, which finished jobs have no proof.
    const [jobs, estimates, staff, settings] = await Promise.all([getJobs(hostId), getEstimates(hostId), getStaff(hostId), getServiceSettings(hostId)]);
    // "Today" is the business's day, not the server's.
    const zone = settings?.timezone ?? "America/Denver";
    const day = todayInZone(zone);
    const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "unassigned";
    const unassignedToday = jobs.filter((j) => jobIsOpen(j.status) && !j.staffId && onDay(j.scheduledStart, day, zone));
    if (unassignedToday.length > 0) {
      summary.signals.push(`${unassignedToday.length} job(s) today have no technician`);
      await track({ hostId, title: `Assign ${unassignedToday.length} job${unassignedToday.length === 1 ? "" : "s"} scheduled today`, description: unassignedToday.slice(0, 10).map((j) => `#${j.number} ${j.title}`).join(", "), priority: "critical", source: "butler", relatedKind: "service_job", relatedId: null, href: routes.servicesDispatch, dedupeKey: `services:unassigned:${day}` });
    }
    const overdue = jobs.filter((j) => isOverdue(j));
    for (const j of overdue.slice(0, 20)) {
      summary.signals.push(`#${j.number} ${j.title} is overdue (${nameOf(j.staffId)})`);
      await track({ hostId, title: `Overdue: #${j.number} ${j.title}`, description: `Scheduled to finish ${j.scheduledEnd ? new Date(j.scheduledEnd).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""}; still ${j.status.replace("_", " ")} with ${nameOf(j.staffId)}. Check in and update the status.`, priority: "high", source: "butler", relatedKind: "service_job", relatedId: j.id, href: routes.serviceJob(j.id), dedupeKey: `services:overdue:${j.id}` });
    }
    const quiet = estimates.filter((e) => needsFollowUp(e));
    if (quiet.length > 0) {
      summary.signals.push(`${quiet.length} estimate(s) sent 2+ days ago with no answer`);
      await track({ hostId, title: `Follow up ${quiet.length} estimate${quiet.length === 1 ? "" : "s"}`, description: quiet.slice(0, 10).map((e) => `#${e.number} ${e.title} (${e.total.toFixed(0)})`).join(", "), priority: "medium", source: "butler", relatedKind: "service_estimate", relatedId: null, href: routes.servicesEstimates, dedupeKey: `services:followup:${day}` });
    }
    const noProof = jobs.filter((j) => missingPhotos(j) && j.completedAt && Date.now() - Date.parse(j.completedAt) < 7 * 86_400_000);
    if (noProof.length > 0) {
      summary.signals.push(`${noProof.length} completed job(s) have no after photos`);
      await track({ hostId, title: `Add after photos to ${noProof.length} completed job${noProof.length === 1 ? "" : "s"}`, description: noProof.slice(0, 10).map((j) => `#${j.number} ${j.title} (${nameOf(j.staffId)})`).join(", "), priority: "low", source: "butler", relatedKind: "service_job", relatedId: null, href: routes.servicesDispatch, dedupeKey: `services:photos:${day}` });
    }
    const expired = estimates.filter((e) => e.status === "sent" && e.expiresAt && Date.parse(e.expiresAt) < Date.now());
    if (expired.length > 0) summary.signals.push(`${expired.length} estimate(s) past their valid-until date`);
  }

  if (modules.includes("custom")) {
    const metrics = await getMetrics(hostId, new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10));
    for (const m of metrics) {
      const s = metricStatus(m);
      if (s.onTarget === false) summary.signals.push(`${m.name} is below target (${s.latest} vs ${m.target})`);
    }
  }

  /* -------------------------------------------------- upcoming pickups */

  const soon = trips.filter((t) => t.action === "checkin" && t.startsAt && Date.parse(t.startsAt) - now < 3 * 3600_000 && Date.parse(t.startsAt) > now);
  for (const t of soon) {
    summary.signals.push(`${t.guestName ?? "A guest"} picks up ${t.vehicleMake ?? ""} ${t.vehicleModel ?? ""} within 3 hours`);
  }

  return summary;
}
