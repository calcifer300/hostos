"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Plus, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ConnectStoreDialog } from "@/components/commerce/connect-store-dialog";
import type { CommerceStore } from "@/lib/commerce/queries";
import { formatMoney } from "@/lib/restaurants/analytics";
import { routes } from "@/lib/routes";
import { formatRelativeTime } from "@/lib/utils";

export interface StoreListEntry {
  store: CommerceStore;
  products: number;
  orders14d: number;
  revenue14d: number;
  lowStock: number;
}

const PROVIDER_LABEL: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", square: "Square", other: "Store" };

/**
 * Every store as a card. Rendered with its own page heading, or — with
 * `heading` off — as the full-width "Stores" widget on the Commerce
 * dashboard, where the dashboard header already names the page.
 */
export function StoreList({ entries, canEdit, heading = true }: { entries: StoreListEntry[]; canEdit: boolean; heading?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className={heading ? "mb-8 flex flex-wrap items-start justify-between gap-4" : "mb-4 flex flex-wrap items-center justify-between gap-3"}>
        {heading ? (
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Commerce</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Your online stores: products, inventory, orders and fulfilment, synced from Shopify or imported from exports.</p>
          </div>
        ) : (
          <p className="text-[13.5px] font-semibold tracking-tight">
            {entries.length} store{entries.length === 1 ? "" : "s"}
          </p>
        )}
        {canEdit && (
          <Button variant="primary" size={heading ? "default" : "sm"} onClick={() => setOpen(true)}>
            <Plus /> Add store
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-dashed border-border p-8">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Store className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No stores yet</h2>
          <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Connect a Shopify store with a custom-app token and HostOS pulls products, inventory and orders on its own — or create a store and import CSV exports.
          </p>
          {canEdit && (
            <Button variant="primary" className="mt-6" onClick={() => setOpen(true)}>
              <Plus /> Add your first store
            </Button>
          )}
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" inView={false}>
          {entries.map(({ store, products, orders14d, revenue14d, lowStock }) => (
            <StaggerItem key={store.id}>
              <Link href={routes.store(store.id)} className="block h-full">
                <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
                        <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight">{store.name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{PROVIDER_LABEL[store.provider] ?? "Store"}{store.domain ? ` · ${store.domain}` : ""}</p>
                      </div>
                    </div>
                    <Badge variant={store.status === "active" ? "success" : store.status === "paused" ? "warning" : "neutral"} className="capitalize">
                      {store.status}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      ["Products", String(products)],
                      ["Orders · 14d", String(orders14d)],
                      ["Revenue · 14d", formatMoney(revenue14d, store.currency)],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                        <p className="mt-1 truncate text-[18px] font-semibold leading-none tracking-tight">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lowStock > 0 ? <Badge variant="warning">{lowStock} low stock</Badge> : <Badge variant="success">Stock healthy</Badge>}
                      <span className="text-[11px] text-muted-foreground">{store.lastSyncedAt ? `synced ${formatRelativeTime(store.lastSyncedAt)}` : "not synced yet"}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <ConnectStoreDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
