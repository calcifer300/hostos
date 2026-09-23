"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Boxes, Download, History, PackageCheck, Pencil, Receipt, RefreshCw, ShoppingBag, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, RankBar, Sparkline } from "@/components/charts/charts";
import { AnimatedNumber } from "@/components/motion/reveal";
import { disconnectStore, importCommerceOrders, importProducts, syncStore, updateStore } from "@/lib/actions/commerce";
import { parseFile } from "@/lib/restaurants/parse";
import { parseOrderExport, parseProductExport, type StoreAnalytics } from "@/lib/commerce/analytics";
import { formatMoney } from "@/lib/restaurants/analytics";
import { downloadCsv } from "@/lib/restaurants/export";
import type { CommerceOrder, CommerceProduct, CommerceStore, SyncRun } from "@/lib/commerce/queries";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import Papa from "papaparse";

const TABS = ["overview", "products", "orders", "sync"] as const;

function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className={cn("mt-2 text-[26px] font-semibold leading-none tracking-tight", tone)}>{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function ImportButton({ kind, storeId, canEdit }: { kind: "products" | "orders"; storeId: string; canEdit: boolean }) {
  const router = useRouter();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      if (kind === "products") {
        const products = parseProductExport(parsed);
        if (products.length === 0) return void toast.error("No products found in that file.");
        const result = await importProducts(storeId, products);
        if (!result.ok) return void toast.error(result.error ?? "Import failed.");
        toast.success(`${result.imported} products imported`);
      } else {
        const orders = parseOrderExport(parsed);
        if (orders.length === 0) return void toast.error("No orders found in that file.");
        const result = await importCommerceOrders(storeId, orders);
        if (!result.ok) return void toast.error(result.error ?? "Import failed.");
        toast.success(`${result.imported} orders imported`);
      }
      router.refresh();
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;
  return (
    <>
      <input ref={ref} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handle(f); e.currentTarget.value = ""; }} />
      <Button variant="secondary" size="sm" loading={busy} onClick={() => ref.current?.click()}>
        <UploadCloud /> Import {kind} CSV
      </Button>
    </>
  );
}

export function StoreDetail({
  store,
  initialTab,
  products,
  orders,
  analytics,
  runs,
  canEdit,
}: {
  store: CommerceStore;
  initialTab: string;
  products: CommerceProduct[];
  orders: CommerceOrder[];
  analytics: StoreAnalytics;
  runs: SyncRun[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = (TABS as readonly string[]).includes(initialTab) ? initialTab : "overview";
  const [syncing, startSync] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [productQuery, setProductQuery] = React.useState("");
  const [orderFilter, setOrderFilter] = React.useState<"all" | "unfulfilled" | "fulfilled" | "cancelled">("all");

  function setTab(next: string) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function sync() {
    startSync(async () => {
      const result = await syncStore(store.id);
      if (!result.ok) toast.error(result.error ?? "Sync failed.");
      else toast.success(`Synced ${result.products} products and ${result.orders} orders`);
      router.refresh();
    });
  }

  function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateStore(store.id, { name: String(fd.get("name") ?? ""), lowStockThreshold: Number(fd.get("lowStockThreshold") ?? 5), notes: String(fd.get("notes") ?? ""), timezone: store.timezone });
      if (!result.ok) return void toast.error(result.error ?? "Couldn't save.");
      toast.success("Store updated");
      setEditOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await disconnectStore(store.id);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't remove the store.");
      toast.success("Store removed");
      router.push(routes.commerce);
    });
  }

  const q = productQuery.trim().toLowerCase();
  const visibleProducts = q ? products.filter((p) => [p.title, p.sku, p.vendor, p.productType].some((v) => v?.toLowerCase().includes(q))) : products;
  const visibleOrders = orders.filter((o) =>
    orderFilter === "all" ? true : orderFilter === "cancelled" ? o.status === "cancelled" : orderFilter === "fulfilled" ? o.fulfillmentStatus === "fulfilled" : o.status !== "cancelled" && o.fulfillmentStatus !== "fulfilled"
  );
  const change = (p: number | null) => (p === null ? undefined : `${p >= 0 ? "↑" : "↓"} ${Math.abs(p)}% vs prior 14 days`);
  const money = (v: number | null | undefined) => formatMoney(v, store.currency);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">
            Products
            {analytics.lowStock.length > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-[10.5px] font-semibold text-warning">{analytics.lowStock.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders
            {analytics.unfulfilled > 0 && <span className="rounded-full bg-accent/15 px-1.5 text-[10.5px] font-semibold text-accent">{analytics.unfulfilled}</span>}
          </TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          {store.connectionId && canEdit && (
            <Button variant="primary" size="sm" onClick={sync} loading={syncing}>
              <RefreshCw /> Sync now
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          )}
        </div>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Receipt} label="Revenue · 14d" value={money(analytics.revenue14d)} sub={change(analytics.revenueChangePct)} tone="text-success" />
          <Stat icon={ShoppingBag} label="Orders · 14d" value={<AnimatedNumber value={analytics.orders14d} />} sub={change(analytics.ordersChangePct)} />
          <Stat icon={PackageCheck} label="Unfulfilled" value={analytics.unfulfilled} sub="open orders awaiting shipment" tone={analytics.unfulfilled > 0 ? "text-accent" : undefined} />
          <Stat icon={AlertTriangle} label="Low stock" value={analytics.lowStock.length} sub={`${analytics.outOfStock} out of stock · threshold ${store.lowStockThreshold}`} tone={analytics.lowStock.length > 0 ? "text-warning" : undefined} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card padding="md" className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold">Revenue per day</p>
              <Sparkline values={analytics.daily.map((d) => d.orders)} width={120} height={28} />
            </div>
            <BarChart data={analytics.daily.map((d) => ({ label: d.label, value: Math.round(d.revenue) }))} height={150} format={(v) => money(v)} />
          </Card>
          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold">Best sellers · 14d</p>
            {analytics.topProducts.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">No line items yet.</p>
            ) : (
              <div className="space-y-3">
                {analytics.topProducts.map((p, i) => (
                  <RankBar key={p.title} label={p.title} value={p.quantity} max={analytics.topProducts[0].quantity} index={i} />
                ))}
              </div>
            )}
          </Card>
        </div>
        {analytics.lowStock.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-[13px] font-semibold">Running low</p>
            </div>
            <ul className="divide-y divide-border">
              {analytics.lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                  <span className="truncate">{p.title}</span>
                  <span className={cn("font-semibold tabular-nums", (p.inventoryQuantity ?? 0) <= 0 ? "text-danger" : "text-warning")}>{p.inventoryQuantity} left</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="products" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Filter products…" className="h-8 max-w-xs" />
          <span className="text-[12px] text-muted-foreground">{visibleProducts.length} of {products.length} · inventory value {money(analytics.inventoryValue)}</span>
          <div className="ml-auto flex gap-2">
            <ImportButton kind="products" storeId={store.id} canEdit={canEdit} />
            <Button variant="ghost" size="sm" disabled={products.length === 0} onClick={() => downloadCsv(Papa.unparse(products.map((p) => ({ Title: p.title, SKU: p.sku ?? "", Vendor: p.vendor ?? "", Type: p.productType ?? "", Status: p.status, Price: p.price ?? "", Inventory: p.inventoryQuantity ?? "" }))), `${store.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-products.csv`)}>
              <Download /> Export
            </Button>
          </div>
        </div>
        <Card>
          {visibleProducts.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">{products.length === 0 ? "No products yet. Sync from Shopify or import a products CSV." : "No products match."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Inventory</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.slice(0, 500).map((p) => {
                    const low = p.inventoryQuantity !== null && p.inventoryQuantity <= store.lowStockThreshold;
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover" loading="lazy" />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Boxes className="h-3.5 w-3.5 text-muted-foreground" /></span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.title}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{[p.vendor, p.productType].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">{p.sku ?? "—"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{money(p.price)}</td>
                        <td className={cn("px-3 py-2.5 tabular-nums", low && "font-semibold text-warning", (p.inventoryQuantity ?? 1) <= 0 && "text-danger")}>{p.inventoryQuantity ?? "—"}</td>
                        <td className="px-3 py-2.5"><Badge variant={p.status === "active" ? "success" : "neutral"} className="capitalize">{p.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="orders" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "unfulfilled", "fulfilled", "cancelled"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setOrderFilter(f)} className={cn("rounded-full px-2.5 py-1 text-[11.5px] capitalize transition-colors", orderFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {f}
            </button>
          ))}
          <div className="ml-auto">
            <ImportButton kind="orders" storeId={store.id} canEdit={canEdit} />
          </div>
        </div>
        <Card>
          {visibleOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">{orders.length === 0 ? "No orders yet. Sync from Shopify or import an orders CSV." : "Nothing with that status."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Placed</th>
                    <th className="px-3 py-2 font-medium">Items</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 font-medium">Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.slice(0, 300).map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-5 py-2.5 font-mono text-[11.5px]">{o.orderNumber ?? o.externalId}</td>
                      <td className="px-3 py-2.5">{o.customerName ?? o.customerEmail ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{o.placedAt ? new Date(o.placedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                      <td className="max-w-[240px] truncate px-3 py-2.5 text-muted-foreground">{o.lineItems.length ? o.lineItems.map((i) => `${i.quantity}× ${i.title}`).join(", ") : o.itemCount ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money(o.total ?? o.subtotal)}</td>
                      <td className="px-3 py-2.5"><Badge variant={o.financialStatus === "paid" ? "success" : o.financialStatus === "refunded" ? "danger" : "neutral"} className="capitalize">{o.financialStatus ?? o.status}</Badge></td>
                      <td className="px-3 py-2.5"><Badge variant={o.status === "cancelled" ? "danger" : o.fulfillmentStatus === "fulfilled" ? "success" : "warning"} className="capitalize">{o.status === "cancelled" ? "cancelled" : o.fulfillmentStatus ?? "unfulfilled"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="sync" className="space-y-4">
        <Card padding="md">
          <p className="text-[13px] font-semibold">Connection</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {store.connectionId ? `Shopify Admin API · ${store.domain} · last synced ${store.lastSyncedAt ? formatRelativeTime(store.lastSyncedAt) : "never"}` : "Fed by CSV exports. Connect Shopify from the Add store dialog to sync automatically."}
          </p>
          <p className="mt-3 text-[12px] text-muted-foreground">Scheduled sync runs every hour through the platform cron; use Sync now after a big change in Shopify.</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold">Sync history</p>
          </div>
          {runs.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No syncs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[12.5px]">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.ok === null ? "Running" : r.ok ? "Completed" : "Failed"} · {r.kind}
                      <span className="text-muted-foreground"> · {formatRelativeTime(r.startedAt)}{r.triggeredBy ? ` · ${r.triggeredBy}` : ""}</span>
                    </p>
                    {r.error && <p className="mt-0.5 truncate text-[11.5px] text-danger">{r.error}</p>}
                  </div>
                  <span className="shrink-0 text-muted-foreground">{r.productsSynced} products · {r.ordersSynced} orders</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {canEdit && (
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Remove store
          </Button>
        )}
      </TabsContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="md">
          <form onSubmit={saveSettings}>
            <DialogHeader>
              <DialogTitle>Edit store</DialogTitle>
              <DialogDescription>Display name, low-stock threshold and notes the Butler reads.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="st-name">Name</Label>
                <Input id="st-name" name="name" defaultValue={store.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-low">Low-stock threshold (units)</Label>
                <Input id="st-low" name="lowStockThreshold" type="number" min={0} defaultValue={store.lowStockThreshold} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-notes">Notes</Label>
                <Textarea id="st-notes" name="notes" rows={3} defaultValue={store.notes ?? ""} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Remove {store.name}?</DialogTitle>
            <DialogDescription>Deletes the store, its products, orders and the stored Shopify token. Shopify itself is untouched.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={remove}>Remove store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
