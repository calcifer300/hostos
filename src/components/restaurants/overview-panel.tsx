"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, Clock3, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkline } from "@/components/charts/charts";
import { AnimatedNumber } from "@/components/motion/reveal";
import { RestaurantDialog } from "@/components/restaurants/restaurant-dialog";
import { StatusPill, STATUS_LABELS } from "@/components/restaurants/status-pill";
import { deleteRestaurant, setRestaurantStatus } from "@/lib/actions/restaurants";
import type { Restaurant, RestaurantStatus, StatusEvent } from "@/lib/restaurants/types";
import { formatMoney, type OrderAnalytics } from "@/lib/restaurants/analytics";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";

const STATUS_OPTIONS: RestaurantStatus[] = ["open", "paused", "closed", "deactivated"];

export function OverviewPanel({
  restaurant,
  events,
  analytics,
  canEdit,
}: {
  restaurant: Restaurant;
  events: StatusEvent[];
  analytics: OrderAnalytics;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const now = useNow();

  function setStatus(status: RestaurantStatus) {
    startTransition(async () => {
      const result = await setRestaurantStatus(restaurant.id, status);
      if (!result.ok) toast.error(result.error ?? "Couldn't update the status.");
      else router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteRestaurant(restaurant.id);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't delete the restaurant.");
        return;
      }
      toast.success("Restaurant removed");
      router.push(routes.restaurants);
    });
  }

  const pausedFor =
    restaurant.status === "paused" && restaurant.statusObservedAt
      ? Math.max(1, Math.round((now - Date.parse(restaurant.statusObservedAt)) / 60_000))
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card padding="md">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orders · 14d</p>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight">
              <AnimatedNumber value={analytics.totalOrders} />
            </p>
            <Sparkline values={analytics.daily.map((d) => d.orders)} width={140} height={36} className="mt-3" />
          </Card>
          <Card padding="md">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue · 14d</p>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-success">{formatMoney(analytics.revenue)}</p>
            <Sparkline values={analytics.daily.map((d) => d.revenue)} width={140} height={36} className="mt-3" tone="success" />
          </Card>
          <Card padding="md">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Avg order</p>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight">{formatMoney(analytics.averageOrderValue)}</p>
            <p className="mt-3 text-[12px] text-muted-foreground">
              {analytics.cancelledRate === null ? "No cancellations recorded" : `${Math.round(analytics.cancelledRate * 100)}% cancelled`}
            </p>
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold">Status timeline</p>
          </div>
          {events.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              No status changes yet. Set the store ID and the Companion will record every open, pause and close it sees on the Merchant Portal.
            </p>
          ) : (
            <ol className="relative ml-6 border-l border-border py-2 pr-5">
              {events.map((e) => (
                <li key={e.id} className="relative py-2.5 pl-6">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-card",
                      e.status === "open" ? "bg-success" : e.status === "paused" ? "bg-warning" : e.status === "deactivated" ? "bg-danger" : "bg-muted-foreground"
                    )}
                  />
                  <p className="text-[13px]">
                    <span className="font-medium">{STATUS_LABELS[e.status]}</span>
                    <span className="text-muted-foreground"> · {e.source}</span>
                    {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">{new Date(e.observedAt).toLocaleString()} · {formatRelativeTime(e.observedAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Store status</p>
            <StatusPill status={restaurant.status} />
          </div>
          {pausedFor !== null && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warning">
              <Clock3 className="h-3.5 w-3.5" /> Paused for {pausedFor} min
            </p>
          )}
          <p className="mt-2 text-[12px] text-muted-foreground">
            {restaurant.statusObservedAt ? `Last observed ${formatRelativeTime(restaurant.statusObservedAt)}` : "Not observed yet"}
          </p>
          {canEdit && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Button key={s} size="sm" variant={restaurant.status === s ? "primary" : "secondary"} disabled={pending} onClick={() => setStatus(s)}>
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          )}
        </Card>

        <Card padding="md">
          <p className="text-[13px] font-semibold">Details</p>
          <dl className="mt-3 space-y-2.5 text-[12.5px]">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <dd className="text-foreground/85">{restaurant.address ?? "No address"}</dd>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <dd className="text-foreground/85">
                {restaurant.contactName ?? "No contact"}
                {restaurant.phone ? ` · ${restaurant.phone}` : ""}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">POS</dt>
                <dd className="mt-0.5 font-medium">{restaurant.posSystem ?? "—"}</dd>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Store ID</dt>
                <dd className="mt-0.5 truncate font-mono text-[11.5px]">{restaurant.doordashStoreId ?? "—"}</dd>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Low stock at</dt>
                <dd className="mt-0.5 font-medium">{restaurant.lowStockThreshold} units</dd>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Price tolerance</dt>
                <dd className="mt-0.5 font-medium">${restaurant.priceTolerance.toFixed(2)}</dd>
              </div>
            </div>
            {restaurant.notes && <p className="whitespace-pre-wrap pt-1 text-[12px] leading-relaxed text-muted-foreground">{restaurant.notes}</p>}
          </dl>
          {canEdit && (
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete
              </Button>
            </div>
          )}
        </Card>
      </div>

      <RestaurantDialog open={editOpen} onOpenChange={setEditOpen} restaurant={restaurant} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {restaurant.name}?</DialogTitle>
            <DialogDescription>
              Removes the restaurant with every upload, comparison, order, message and inventory item. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} onClick={remove}>
              Delete restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
