import "server-only";
import { auth } from "@/auth";
import type { WidgetData } from "@/components/dashboard/widgets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getDashboardLayout } from "@/lib/dashboard/layout";
import { availableWidgets, type DashboardScope, type LayoutEntry } from "@/lib/dashboard/widgets";
import { getLatestUnreadEmail } from "@/lib/gmail/queries";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getHostModules } from "@/lib/host/queries";
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
  const modules = await getHostModules(hostId);
  const widgets = new Set(availableWidgets(scope, modules).map((w) => w.id));
  const has = (...ids: string[]) => ids.some((id) => widgets.has(id));

  const fleet = modules.includes("fleet") && has("stats", "board", "messages", "fleet", "occupancy", "priority", "pickups", "returns", "timeline", "unscheduled", "businesses");
  const restaurantsOn = modules.includes("restaurants") && has("restaurants", "restaurantList", "orders", "menusync", "topitems", "lowstock", "businesses");
  const commerceOn = modules.includes("commerce") && has("commerce", "storeList", "sales", "topproducts", "storesync", "lowstock", "businesses");

  const [data, latestUnread, guestMessages, setup, layout, tasks, notifications, activity, board, restaurants, comparisons, restaurantOrders, stores, commerceOrders, productCounts, canEdit] =
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
  };

  return { scope, firstName, signedIn: Boolean(email), modules, layout, setup, data: widgetData };
}
