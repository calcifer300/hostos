import "server-only";
import { auth } from "@/auth";
import type { WidgetData } from "@/components/dashboard/widgets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getDashboardLayout } from "@/lib/dashboard/layout";
import { availableWidgets, type DashboardScope, type LayoutEntry } from "@/lib/dashboard/widgets";
import { getLatestUnreadEmail } from "@/lib/gmail/queries";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getAccessibleModules } from "@/lib/host/context";
import type { WorkspaceModule } from "@/lib/modules";
import { getGuestConversations } from "@/lib/messages/queries";
import { getSetupStatus, type SetupStatus } from "@/lib/onboarding/status";
import { getTasks } from "@/lib/tasks/queries";
import { getNotifications } from "@/lib/notifications/queries";
import { getActivity } from "@/lib/activity/queries";
import { getBoardData } from "@/lib/board/queries";
import { needsAttention } from "@/lib/board/countdown";
import { getRestaurants, getLatestComparisonSummaries, getOrders, getInventory } from "@/lib/restaurants/queries";
import { computeOrderAnalytics } from "@/lib/restaurants/analytics";
import { getStores, getCommerceOrders, getProducts, getProductCounts, getSyncRuns } from "@/lib/commerce/queries";
import { computeStoreAnalytics } from "@/lib/commerce/analytics";
import { getProperties } from "@/lib/web/queries";
import { clientsDueForRebooking, getAppointments, getChecklists, getClients, getLocations, getSales, getShifts, getStock, summarizeSales } from "@/lib/local/queries";
import { getBuildRequests, getMetrics } from "@/lib/custom/queries";
import { todayInZone } from "@/lib/timezones";
import type { InboundTuroEmail } from "@/types/butler";

export interface DashboardPageData {
  scope: DashboardScope;
  firstName: string | null;
  signedIn: boolean;
  modules: WorkspaceModule[];
  layout: LayoutEntry[] | null;
  setup: SetupStatus;
  data: WidgetData;
}

const EMPTY_LOCAL: WidgetData["cafe"] = { locations: [], sales: [], stock: [], shifts: [], appointments: [], clients: [], rebookingDue: [], checklists: [], summary: summarizeSales([]) };

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Everything one dashboard needs, read once. Which sources are consulted
 * follows from the widgets that can appear on this dashboard, so the Fleet
 * dashboard never touches restaurant tables and Home reads only what its
 * summary cards show. Every read is cached per request and total — a module
 * with nothing in it simply contributes empty widgets.
 */
export async function assembleDashboard(scope: DashboardScope): Promise<DashboardPageData> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const hostId = await getCurrentHostId();
  // What this person may open here — the workspace's verticals narrowed by
  // their membership — so Home's business cards and every widget follow suit.
  const modules = await getAccessibleModules();
  const widgets = new Set(availableWidgets(scope, modules).map((w) => w.id));
  const has = (...ids: string[]) => ids.some((id) => widgets.has(id));

  const fleet = modules.includes("fleet") && has("stats", "board", "messages", "fleet", "occupancy", "priority", "pickups", "returns", "timeline", "unscheduled", "businesses");
  const restaurantsOn = modules.includes("restaurants") && has("restaurants", "restaurantList", "orders", "menusync", "topitems", "lowstock", "businesses");
  const commerceOn = modules.includes("commerce") && has("commerce", "storeList", "sales", "topproducts", "storesync", "lowstock", "businesses");
  const webOn = modules.includes("web") && has("webProperties", "webExpiring", "webStatus", "businesses");
  const cafeOn = modules.includes("cafe") && has("cafeSales", "cafeStock", "cafeShifts", "cafeChecklists", "cafeLocations", "businesses");
  const salonOn = modules.includes("salon") && has("salonSchedule", "salonRebooking", "salonRevenue", "salonShifts", "salonChecklists", "salonLocations", "businesses");
  const customOn = modules.includes("custom") && has("customMetrics", "customChecklists", "buildRequests", "businesses");

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const windowFrom = new Date(dayStart.getTime() - 14 * 86_400_000).toISOString();
  const windowTo = new Date(dayStart.getTime() + 2 * 86_400_000).toISOString();

  const [data, latestUnread, guestMessages, setup, layout, tasks, notifications, activity, board, restaurants, comparisons, restaurantOrders, stores, commerceOrders, productCounts, canEdit, properties, metrics, buildRequests, customChecklists] =
    await Promise.all([
      getDashboardData(email),
      email && has("briefing") ? getLatestUnreadEmail(email) : Promise.resolve(null),
      fleet && has("messages") ? getGuestConversations(hostId) : Promise.resolve([]),
      getSetupStatus(hostId),
      getDashboardLayout(hostId, email, scope),
      getTasks(hostId),
      getNotifications(hostId, email, 30),
      getActivity(hostId, 30),
      fleet && has("board") ? getBoardData() : Promise.resolve({ trips: [], fleets: [], degraded: false }),
      restaurantsOn ? getRestaurants(hostId) : Promise.resolve([]),
      restaurantsOn ? getLatestComparisonSummaries(hostId) : Promise.resolve(new Map()),
      restaurantsOn ? getOrders(hostId, null, 3000) : Promise.resolve([]),
      commerceOn ? getStores(hostId) : Promise.resolve([]),
      commerceOn ? getCommerceOrders(hostId, null, 3000) : Promise.resolve([]),
      commerceOn ? getProductCounts(hostId) : Promise.resolve(new Map<string, number>()),
      canEditCurrentFleet(),
      webOn ? getProperties(hostId) : Promise.resolve([]),
      customOn ? getMetrics(hostId, daysAgoIso(30).slice(0, 10)) : Promise.resolve([]),
      customOn ? getBuildRequests(hostId) : Promise.resolve([]),
      customOn ? getChecklists(hostId, "custom") : Promise.resolve([]),
    ]);

  const initialEmail: InboundTuroEmail | null = latestUnread
    ? {
        guestName: latestUnread.guestName || latestUnread.fromName || "This guest",
        vehicle: latestUnread.vehicle || "their vehicle",
        subject: latestUnread.subject || "",
        body: latestUnread.body || latestUnread.snippet || "",
        receivedAt: latestUnread.receivedAt,
      }
    : null;

  // Restaurants: per-store cards, order analytics, stock.
  const restaurantEntries = restaurants.map((r) => {
    const today = todayInZone(r.timezone);
    const todays = restaurantOrders.filter((o) => o.restaurantId === r.id && o.placedAt && o.status !== "cancelled" && todayInZone(r.timezone, new Date(o.placedAt)) === today);
    return {
      restaurant: r,
      latest: comparisons.get(r.id) ?? null,
      ordersToday: todays.length,
      revenueToday: todays.reduce((sum, o) => sum + (o.total ?? o.subtotal ?? 0), 0),
    };
  });
  const primaryZone = restaurants[0]?.timezone ?? "America/Denver";
  const restaurantAnalytics = computeOrderAnalytics(restaurantOrders, primaryZone);

  const restaurantLowStock: WidgetData["restaurantLowStock"] = [];
  if (restaurantsOn && has("lowstock")) {
    const inventories = await Promise.all(restaurants.slice(0, 10).map((r) => getInventory(hostId, r.id)));
    restaurants.slice(0, 10).forEach((r, idx) => {
      for (const i of inventories[idx]) {
        if (i.quantity !== null && i.quantity <= (i.lowStockThreshold ?? r.lowStockThreshold)) restaurantLowStock.push({ restaurant: r.name, name: i.name, quantity: i.quantity });
      }
    });
  }

  // Commerce: per-store analytics and sync history.
  const storeEntries = await Promise.all(
    stores.map(async (store) => {
      const [products, runs] = await Promise.all([getProducts(hostId, store.id, 3000), has("storesync") ? getSyncRuns(hostId, store.id, 1) : Promise.resolve([])]);
      const a = computeStoreAnalytics(commerceOrders.filter((o) => o.storeId === store.id), products, store.timezone, store.lowStockThreshold);
      return {
        store,
        products: productCounts.get(store.id) ?? products.length,
        revenue14d: a.revenue14d,
        orders14d: a.orders14d,
        revenueChangePct: a.revenueChangePct,
        unfulfilled: a.unfulfilled,
        lowStock: a.lowStock.slice(0, 6).map((p) => ({ title: p.title, quantity: p.inventoryQuantity ?? 0 })),
        lowStockCount: a.lowStock.length,
        daily: a.daily.map((d) => ({ label: d.label, orders: d.orders, revenue: d.revenue })),
        topProducts: a.topProducts.slice(0, 5),
        lastRun: runs[0] ? { ok: runs[0].ok, at: runs[0].finishedAt ?? runs[0].startedAt, error: runs[0].error } : null,
      };
    })
  );

  // Cafés and barbershops share the local-business tables.
  async function local(kind: "cafe" | "salon"): Promise<WidgetData["cafe"]> {
    const [locations, sales, stock, shifts, appointments, clients, checklists] = await Promise.all([
      getLocations(hostId, kind),
      getSales(hostId, windowFrom.slice(0, 10)),
      getStock(hostId, kind),
      getShifts(hostId, kind, dayStart.toISOString(), windowTo),
      kind === "salon" ? getAppointments(hostId, windowFrom, windowTo) : Promise.resolve([]),
      kind === "salon" ? getClients(hostId) : Promise.resolve([]),
      getChecklists(hostId, kind),
    ]);
    const ids = new Set(locations.map((l) => l.id));
    const ownSales = sales.filter((s) => ids.has(s.locationId));
    const ownAppointments = appointments.filter((a) => ids.has(a.locationId));
    const ownClients = clients.filter((c) => ids.has(c.locationId));
    return {
      locations,
      sales: ownSales,
      stock,
      shifts,
      appointments: ownAppointments,
      clients: ownClients,
      rebookingDue: clientsDueForRebooking(ownClients, locations).slice(0, 12),
      checklists,
      summary: summarizeSales(ownSales, 14, now),
    };
  }

  const [cafe, salon] = await Promise.all([cafeOn ? local("cafe") : Promise.resolve(EMPTY_LOCAL), salonOn ? local("salon") : Promise.resolve(EMPTY_LOCAL)]);

  const widgetData: WidgetData = {
    scope,
    modules,
    canEdit,
    data,
    guestMessages,
    initialEmail,
    tasks,
    notifications,
    activity,
    boardTrips: board.trips.filter((t) => needsAttention(t.timer) || t.timer.windowKey === "starting" || t.timer.windowKey === "ending").slice(0, 8),
    restaurants: restaurantEntries,
    restaurantOrdersDaily: restaurantAnalytics.daily.map((d) => ({ label: d.label, orders: d.orders, revenue: d.revenue })),
    restaurantTopItems: restaurantAnalytics.topItems.slice(0, 6),
    restaurantLowStock,
    stores: storeEntries,
    properties,
    cafe,
    salon,
    custom: { metrics, buildRequests, checklists: customChecklists },
  };

  return { scope, firstName, signedIn: Boolean(email), modules, layout, setup, data: widgetData };
}
