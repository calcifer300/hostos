import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChefHat } from "lucide-react";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import {
  getComparison,
  getComparisonSummaries,
  getInventory,
  getOrders,
  getRestaurant,
  getRestaurantMessages,
  getStatusEvents,
  getUploadSummaries,
} from "@/lib/restaurants/queries";
import { computeOrderAnalytics } from "@/lib/restaurants/analytics";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";
import { StatusPill } from "@/components/restaurants/status-pill";
import { routes } from "@/lib/routes";
import { ModuleOff } from "@/components/dashboard/module-off";
import { verticalAccess } from "@/lib/host/context";

export const metadata: Metadata = { title: "Restaurant" };

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; comparison?: string }>;
}) {
  // Belongs to the restaurants vertical: nothing here renders — or queries — unless this person may open it.
  const access = await verticalAccess("restaurants");
  if (access !== "ok") return <ModuleOff module="restaurants" reason={access} />;

  const { id } = await params;
  const { tab, comparison: comparisonId } = await searchParams;
  const hostId = await getCurrentHostId();

  const restaurant = await getRestaurant(hostId, id);
  if (!restaurant) notFound();

  const [uploads, comparisons, orders, messages, events, inventory, canEdit] = await Promise.all([
    getUploadSummaries(hostId, id),
    getComparisonSummaries(hostId, id),
    getOrders(hostId, id),
    getRestaurantMessages(hostId, id),
    getStatusEvents(hostId, id),
    getInventory(hostId, id),
    canEditCurrentFleet(),
  ]);

  const activeId = comparisonId ?? comparisons[0]?.id ?? null;
  const active = activeId ? await getComparison(hostId, activeId) : null;
  const analytics = computeOrderAnalytics(orders, restaurant.timezone);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href={routes.restaurants} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All restaurants
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
          <ChefHat className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-tight">{restaurant.name}</h1>
            <StatusPill status={restaurant.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[restaurant.posSystem, restaurant.address].filter(Boolean).join(" · ") || "Add a POS system and address in Edit"}
          </p>
        </div>
      </div>

      <RestaurantTabs
        restaurant={restaurant}
        initialTab={tab ?? "overview"}
        uploads={uploads}
        comparisons={comparisons}
        activeComparison={active && active.restaurantId === id ? active : null}
        orders={orders}
        analytics={analytics}
        messages={messages}
        events={events}
        inventory={inventory}
        canEdit={canEdit}
      />
    </div>
  );
}
