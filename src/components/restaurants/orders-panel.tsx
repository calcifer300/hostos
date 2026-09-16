"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, UploadCloud, ShoppingBag, Clock3, Ban, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, RankBar } from "@/components/charts/charts";
import { AnimatedNumber } from "@/components/motion/reveal";
import { parseFile, parseOrders, type ParsedOrder } from "@/lib/restaurants/parse";
import { buildOrdersCsv, downloadCsv } from "@/lib/restaurants/export";
import { formatMoney, type OrderAnalytics } from "@/lib/restaurants/analytics";
import { importOrders } from "@/lib/actions/restaurants";
import type { OrderStatus, RestaurantOrder } from "@/lib/restaurants/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<OrderStatus, "neutral" | "accent" | "success" | "danger" | "warning"> = {
  placed: "accent",
  confirmed: "accent",
  preparing: "warning",
  ready: "warning",
  picked_up: "neutral",
  delivered: "success",
  cancelled: "danger",
  unknown: "neutral",
};

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

function ImportDialog({ restaurantId, open, onOpenChange }: { restaurantId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<{ fileName: string; orders: ParsedOrder[]; columns: Record<string, string | undefined> } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      const { orders, columns } = parseOrders(parsed);
      if (orders.length === 0) {
        toast.error("No orders found in that file.");
        return;
      }
      setPreview({ fileName: file.name, orders, columns });
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!preview) return;
    startTransition(async () => {
      const result = await importOrders(restaurantId, preview.orders);
      if (!result.ok) {
        toast.error(result.error ?? "Import failed.");
        return;
      }
      toast.success(`${result.imported} orders imported`);
      setPreview(null);
      onOpenChange(false);
      router.refresh();
    });
  }

  const detected = preview ? Object.entries(preview.columns).filter(([, v]) => v) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPreview(null); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import orders</DialogTitle>
          <DialogDescription>
            Export orders from the DoorDash Merchant Portal (Orders → Export) and drop the file here. Re-importing the same period updates
            existing orders rather than duplicating them.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!preview ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center transition-colors hover:border-accent/50 hover:bg-accent/5"
            >
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <span className="text-[13.5px] font-medium">{busy ? "Reading…" : "Choose a CSV or XLSX export"}</span>
              <span className="text-[12px] text-muted-foreground">Order ID, status, time placed, totals and items are detected automatically.</span>
            </button>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-background/40 p-4 text-[13px]">
                <p>
                  <span className="font-medium">{preview.fileName}</span>
                  <span className="text-muted-foreground"> · {preview.orders.length.toLocaleString()} orders</span>
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Detected columns:{" "}
                  {detected.length === 0 ? "none — the file may not be an order export" : detected.map(([k, v]) => `${k} ← "${v}"`).join(" · ")}
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-[12px]">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Placed</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.orders.slice(0, 5).map((o) => (
                      <tr key={o.externalId} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{o.externalId}</td>
                        <td className="px-3 py-1.5">{o.status}</td>
                        <td className="px-3 py-1.5">{o.placedAt ? new Date(o.placedAt).toLocaleString() : "—"}</td>
                        <td className="px-3 py-1.5">{formatMoney(o.total ?? o.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.currentTarget.value = "";
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!preview} loading={pending} onClick={confirm}>
            Import {preview ? preview.orders.length.toLocaleString() : ""} orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrdersPanel({
  restaurantId,
  restaurantName,
  orders,
  analytics,
  canEdit,
}: {
  restaurantId: string;
  restaurantName: string;
  orders: RestaurantOrder[];
  analytics: OrderAnalytics;
  canEdit: boolean;
}) {
  const [importOpen, setImportOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"all" | OrderStatus>("all");
  const visible = status === "all" ? orders : orders.filter((o) => o.status === status);
  const change = (pct: number | null) => (pct === null ? undefined : `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs prior 14 days`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">Last 14 days, computed from imported orders.</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildOrdersCsv(orders), `${restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-orders.csv`)} disabled={orders.length === 0}>
            <Download /> Export
          </Button>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud /> Import orders
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={ShoppingBag} label="Orders" value={<AnimatedNumber value={analytics.totalOrders} />} sub={change(analytics.ordersChangePct)} />
        <Stat icon={Receipt} label="Revenue" value={formatMoney(analytics.revenue)} sub={change(analytics.revenueChangePct)} tone="text-success" />
        <Stat icon={Clock3} label="Median fulfilment" value={analytics.medianFulfilmentMinutes === null ? "—" : `${Math.round(analytics.medianFulfilmentMinutes)}m`} sub="placed → delivered" />
        <Stat icon={Ban} label="Cancelled" value={analytics.cancelledRate === null ? "—" : `${Math.round(analytics.cancelledRate * 100)}%`} sub="of all orders" tone={analytics.cancelledRate && analytics.cancelledRate > 0.05 ? "text-danger" : undefined} />
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card padding="md" className="lg:col-span-2">
            <p className="mb-3 text-[13px] font-semibold">Orders per day</p>
            <BarChart data={analytics.daily.map((d) => ({ label: d.label, value: d.orders }))} height={150} format={(v) => `${v} orders`} />
          </Card>
          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold">Top items</p>
            {analytics.topItems.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">The export didn&rsquo;t include line items.</p>
            ) : (
              <div className="space-y-3">
                {analytics.topItems.map((it, i) => (
                  <RankBar key={it.name} label={it.name} value={it.quantity} max={analytics.topItems[0].quantity} index={i} />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <p className="mr-auto text-[13px] font-semibold">Orders ({visible.length})</p>
          {(["all", "placed", "preparing", "delivered", "cancelled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] capitalize transition-colors",
                status === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            {orders.length === 0 ? "No orders yet. Import an export from the Merchant Portal to see analytics." : "Nothing with that status."}
          </p>
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
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-5 py-2.5 font-mono text-[11.5px]">{o.externalId}</td>
                    <td className="px-3 py-2.5">{o.customerName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{o.placedAt ? new Date(o.placedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 text-muted-foreground">{o.items.length ? o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") : o.itemCount ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatMoney(o.total ?? o.subtotal)}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_VARIANT[o.status]} className="capitalize">
                        {o.status.replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ImportDialog restaurantId={restaurantId} open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
