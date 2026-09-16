"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewPanel } from "@/components/restaurants/overview-panel";
import { MenuSync } from "@/components/restaurants/menu-sync";
import { OrdersPanel } from "@/components/restaurants/orders-panel";
import { MessagesPanel } from "@/components/restaurants/messages-panel";
import { InventoryPanel } from "@/components/restaurants/inventory-panel";
import type { OrderAnalytics } from "@/lib/restaurants/analytics";
import type {
  Comparison,
  InventoryItem,
  MenuUploadSummary,
  Restaurant,
  RestaurantMessage,
  RestaurantOrder,
  StatusEvent,
} from "@/lib/restaurants/types";

const TABS = ["overview", "menu", "orders", "messages", "inventory"] as const;
type Tab = (typeof TABS)[number];

export function RestaurantTabs({
  restaurant,
  initialTab,
  uploads,
  comparisons,
  activeComparison,
  orders,
  analytics,
  messages,
  events,
  inventory,
  canEdit,
}: {
  restaurant: Restaurant;
  initialTab: string;
  uploads: MenuUploadSummary[];
  comparisons: Omit<Comparison, "rows">[];
  activeComparison: Comparison | null;
  orders: RestaurantOrder[];
  analytics: OrderAnalytics;
  messages: RestaurantMessage[];
  events: StatusEvent[];
  inventory: InventoryItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(initialTab) ? (initialTab as Tab) : "overview";

  function setTab(next: string) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    if (next !== "menu") params.delete("comparison");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const pendingMenu = activeComparison ? activeComparison.summary.needsUpdate + activeComparison.summary.missingOnDoordash : 0;

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="menu">
          Menu sync
          {pendingMenu > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-[10.5px] font-semibold text-warning">{pendingMenu}</span>}
        </TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel restaurant={restaurant} events={events} analytics={analytics} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="menu">
        <MenuSync restaurant={restaurant} uploads={uploads} comparisons={comparisons} active={activeComparison} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="orders">
        <OrdersPanel restaurantId={restaurant.id} restaurantName={restaurant.name} orders={orders} analytics={analytics} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="messages">
        <MessagesPanel restaurantId={restaurant.id} messages={messages} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="inventory">
        <InventoryPanel restaurantId={restaurant.id} items={inventory} defaultThreshold={restaurant.lowStockThreshold} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
