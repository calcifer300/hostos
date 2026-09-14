"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChefHat, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { RestaurantDialog } from "@/components/restaurants/restaurant-dialog";
import { StatusPill } from "@/components/restaurants/status-pill";
import type { Restaurant, ComparisonSummary } from "@/lib/restaurants/types";
import { formatMoney } from "@/lib/restaurants/analytics";
import { routes } from "@/lib/routes";
import { formatRelativeTime } from "@/lib/utils";

export interface RestaurantListEntry {
  restaurant: Restaurant;
  latest: { summary: ComparisonSummary; createdAt: string } | null;
  ordersToday: number;
  revenueToday: number;
}

/**
 * Every storefront as a card. Rendered as its own page heading, or — with
 * `heading` off — as the full-width "Restaurants" widget on the Restaurant
 * dashboard, where the dashboard header already names the page.
 */
export function RestaurantList({ entries, canEdit, heading = true }: { entries: RestaurantListEntry[]; canEdit: boolean; heading?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className={heading ? "mb-8 flex flex-wrap items-start justify-between gap-4" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
        {heading ? (
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Restaurants</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
              Every DoorDash storefront you run: live status, menu sync, orders and customer messages.
            </p>
          </div>
        ) : (
          <p className="text-[13.5px] font-semibold tracking-tight">
            {entries.length} restaurant{entries.length === 1 ? "" : "s"}
          </p>
        )}
        {canEdit && (
          <Button variant="primary" size={heading ? "default" : "sm"} onClick={() => setOpen(true)}>
            <Plus /> Add restaurant
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-dashed border-border p-8">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Store className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No restaurants yet</h2>
          <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Add a storefront, then upload its POS export and DoorDash menu export to see exactly what needs updating.
            The Companion can watch its status on the Merchant Portal once the store ID is set.
          </p>
          {canEdit && (
            <Button variant="primary" className="mt-6" onClick={() => setOpen(true)}>
              <Plus /> Add your first restaurant
            </Button>
          )}
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" inView={false}>
          {entries.map(({ restaurant, latest, ordersToday, revenueToday }) => (
            <StaggerItem key={restaurant.id}>
              <Link href={routes.restaurant(restaurant.id)} className="block h-full">
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
                        <ChefHat className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight">{restaurant.name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{restaurant.posSystem ?? "POS not set"}</p>
                      </div>
                    </div>
                    <StatusPill status={restaurant.status} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Orders today</p>
                      <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight">{ordersToday}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue today</p>
                      <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight">{formatMoney(revenueToday)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                    {latest ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {latest.summary.needsUpdate + latest.summary.missingOnDoordash > 0 ? (
                          <Badge variant="warning">{latest.summary.needsUpdate + latest.summary.missingOnDoordash} menu changes</Badge>
                        ) : (
                          <Badge variant="success">Menu in sync</Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatRelativeTime(latest.createdAt)}</span>
                      </div>
                    ) : (
                      <Badge variant="neutral">No comparison yet</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <RestaurantDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
