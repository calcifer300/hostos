import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import type { BackendStatusView } from "@/components/shell/backend-status-banner";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHost } from "@/lib/host/queries";
import { getUserRoles } from "@/lib/roles/queries";
import { getBackendHealth } from "@/lib/supabase/server";
import { canUseQuickNotes, getAccessibleModules, getCurrentHostId, getFleetsForUser } from "@/lib/host/context";
import { getQuickNotes } from "@/lib/notes/queries";
import { getNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { getTasks, summarizeTasks } from "@/lib/tasks/queries";
import { getRestaurants } from "@/lib/restaurants/queries";
import { getStores } from "@/lib/commerce/queries";
import { getBoardData } from "@/lib/board/queries";
import { getRiskQueues } from "@/lib/risk/queries";
import { needsAttention } from "@/lib/board/countdown";
import { getChosenVertical } from "@/lib/host/context";
import { getProperties } from "@/lib/web/queries";
import { getLocations, getStock } from "@/lib/local/queries";
import { getMetrics } from "@/lib/custom/queries";
import { metricStatus } from "@/lib/custom/analytics";

/**
 * The product shell. Middleware has already gated this tree (see
 * src/middleware.ts for why the gate cannot live here), so this layout only
 * assembles what the chrome needs: workspace list, module flags, badge
 * counts, the bell's contents and the command palette's search sources.
 *
 * Every read is total — it resolves to an empty value rather than rejecting —
 * so Promise.all cannot turn one degraded source into a failed shell. And
 * every read is React.cache()'d, so a page that needs the same data pays for
 * it once per request, not twice.
 */
/** The custom vertical's badge counts metrics against the last week; the cutoff is computed once per request. */
function weekAgoDay(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const hostId = await getCurrentHostId();
  // The host row first: the risk queues need its timezone, and getHost is
  // React.cache()'d so the pages beneath pay nothing extra for it.
  const host = await getHost(hostId);
  // What this person may open — the workspace's verticals narrowed by their
  // membership — drives the sidebar, the badge counts and the chosen focus.
  const modulesEarly = await getAccessibleModules();
  const notesAllowed = await canUseQuickNotes();
  const [data, modules, roles, fleets, notifications, unread, tasks, restaurants, stores, board, risk, focus, properties, cafeLocations, cafeStock, metrics, notes] = await Promise.all([
    getDashboardData(email),
    getAccessibleModules(),
    getUserRoles(email),
    getFleetsForUser(email),
    getNotifications(hostId, email, 12),
    getUnreadNotificationCount(hostId, email),
    getTasks(hostId),
    getRestaurants(hostId),
    getStores(hostId),
    getBoardData(),
    getRiskQueues(hostId, host?.timezone ?? "America/Denver"),
    getChosenVertical(modulesEarly),
    modulesEarly.includes("web") ? getProperties(hostId) : Promise.resolve([]),
    modulesEarly.includes("cafe") ? getLocations(hostId, "cafe") : Promise.resolve([]),
    modulesEarly.includes("cafe") ? getStock(hostId, "cafe") : Promise.resolve([]),
    modulesEarly.includes("custom") ? getMetrics(hostId, weekAgoDay()) : Promise.resolve([]),
    notesAllowed ? getQuickNotes(email) : Promise.resolve([]),
  ]);

  // Read *after* the queries above, so it reflects this render's outcomes.
  // Only the two fields the banner needs cross to the client — a failure's
  // reason/hint stays in the server log where it belongs.
  const health = getBackendHealth();
  const backendStatus: BackendStatusView = { state: health.state, kind: health.failure?.kind ?? null };

  const taskCounts = summarizeTasks(tasks);
  const navCounts: Record<string, number> = {
    operations: data.pickups.length + data.returns.length + data.overdueReturns.length,
    board: board.trips.filter((t) => needsAttention(t.timer)).length,
    tasks: taskCounts.open + taskCounts.inProgress,
    messages: data.messages.length,
    notifications: unread,
    risk: risk.licenses.length + risk.profitRisk.length,
    restaurants: restaurants.filter((r) => r.status === "paused" || r.status === "closed").length,
    commerce: stores.filter((s) => s.status === "paused").length,
    web: properties.filter((p) => p.status === "down").length,
    cafe: cafeStock.filter((s) => s.quantity <= (s.lowStockThreshold ?? cafeLocations.find((l) => l.id === s.locationId)?.lowStockThreshold ?? 5)).length,
    custom: metrics.map(metricStatus).filter((m) => m.onTarget === false).length,
    butler: data.suggestions.length,
  };

  const workspaceName = host?.name ?? fleets.find((f) => f.hostId === hostId)?.name ?? "Workspace";

  return (
    <AppShell
      user={session?.user ?? null}
      roles={roles}
      backendStatus={backendStatus}
      currentHostId={hostId}
      workspaceName={workspaceName}
      modules={modules}
      focus={focus}
      quickNotes={notesAllowed ? notes : null}
      navCounts={navCounts}
      notifications={notifications}
      unreadNotifications={unread}
      workspaces={fleets.map((f) => ({
        hostId: f.hostId,
        // The switcher needs something to render for every row; fall back
        // through name, then slug, then a short id rather than showing blank.
        name: f.name ?? f.slug ?? `Workspace ${f.hostId.slice(0, 8)}`,
        role: f.role,
      }))}
      palette={{
        vehicles: data.vehicles.map((v) => ({ id: v.id, name: v.name, subtitle: v.nextEventLabel })),
        conversations: data.messages.map((m) => ({ tripId: m.id, guestName: m.guestName, vehicle: m.vehicle })),
        restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, subtitle: r.posSystem })),
        stores: stores.map((st) => ({ id: st.id, name: st.name, subtitle: st.domain })),
      }}
    >
      {children}
    </AppShell>
  );
}
