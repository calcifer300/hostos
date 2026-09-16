"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, FileText, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createEstimate, setEstimateStatus } from "@/lib/actions/services";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABEL, estimateTotals, needsFollowUp, type EstimateStatus, type LineItem } from "@/lib/services/analytics";
import type { CatalogItem } from "@/lib/services/industries";
import type { ServiceCustomer, ServiceEstimate } from "@/lib/services/types";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatMoney } from "@/lib/restaurants/analytics";

const TONE: Record<EstimateStatus, string> = { draft: "bg-muted text-muted-foreground", sent: "bg-info-bg text-info", accepted: "bg-success-bg text-success", declined: "bg-danger-bg text-danger", expired: "bg-warning-bg text-warning" };

/**
 * Estimates: a list with the pipeline filter, and a builder with catalogue
 * line items. Accepting one creates the work order on the server.
 */
export function EstimatesView({ estimates, customers, catalog, canEdit }: { estimates: ServiceEstimate[]; customers: ServiceCustomer[]; catalog: CatalogItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [filter, setFilter] = React.useState<"" | EstimateStatus | "followup">("");
  const [building, setBuilding] = React.useState(false);
  const [items, setItems] = React.useState<LineItem[]>([{ name: "", quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = React.useState("0");
  const [customerId, setCustomerId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const totals = estimateTotals(items, Number(taxRate) || 0);
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";
  const rows = estimates.filter((e) => (filter === "followup" ? needsFollowUp(e) : !filter || e.status === filter));

  function decide(id: string, status: EstimateStatus) {
    startTransition(async () => {
      const r = await setEstimateStatus(id, status);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't update.");
      toast.success(status === "accepted" ? "Accepted — work order created" : ESTIMATE_STATUS_LABEL[status]);
      router.refresh();
      if (status === "accepted" && r.id) router.push(routes.serviceJob(r.id));
    });
  }

  function addFromCatalog(name: string) {
    const c = catalog.find((x) => x.name === name);
    if (!c) return;
    setItems((list) => [...list.filter((i) => i.name.trim()), { name: c.name, quantity: 1, unitPrice: c.price }]);
    if (!title) setTitle(c.name);
  }

  function submit(send: boolean) {
    startTransition(async () => {
      const r = await createEstimate({ customerId: customerId || null, title, lineItems: items.filter((i) => i.name.trim()), taxRate, notes, send });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't create the estimate.");
      toast.success(send ? "Estimate sent — follow-up reminder set for 2 days" : "Draft saved");
      setBuilding(false);
      setItems([{ name: "", quantity: 1, unitPrice: 0 }]);
      setTitle("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([["", "All"], ["followup", "Need follow-up"], ...ESTIMATE_STATUSES.map((s) => [s, ESTIMATE_STATUS_LABEL[s]])] as [string, string][]).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v as typeof filter)} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium transition-[background-color,border-color,color] duration-200 active:scale-95", filter === v ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground")}>
            {label}
            {v === "followup" && estimates.some((e) => needsFollowUp(e)) && <span className="ml-1 rounded-full bg-warning/15 px-1.5 text-[10.5px] text-warning">{estimates.filter((e) => needsFollowUp(e)).length}</span>}
          </button>
        ))}
        {canEdit && <Button variant="primary" size="sm" className="ml-auto" onClick={() => setBuilding((v) => !v)}><Plus /> Estimate</Button>}
      </div>

      {building && (
        <Card padding="md">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><FileText className="h-4 w-4 text-muted-foreground" /> New estimate</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="es-title">Title</Label><Input id="es-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Windshield replacement + calibration" /></div>
            <div className="space-y-1.5"><Label htmlFor="es-customer">Customer</Label><NativeSelect id="es-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">No customer yet</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>
            {catalog.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="es-catalog">Add from catalogue</Label><NativeSelect id="es-catalog" defaultValue="" onChange={(e) => { addFromCatalog(e.target.value); e.target.value = ""; }}><option value="">Choose a service…</option>{catalog.map((c) => <option key={c.name} value={c.name}>{c.name}{c.price > 0 ? ` — $${c.price}` : ""}</option>)}</NativeSelect></div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="grid grid-cols-[1fr_70px_110px_100px_32px] gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>Line item</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span><span /></div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_110px_100px_32px] items-center gap-1.5">
                <Input value={it.name} onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Description" className="h-8 text-[12.5px]" />
                <Input type="number" min={0} step="0.5" value={it.quantity} onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, quantity: Number(e.target.value) } : x)))} className="h-8 text-[12.5px]" aria-label="Quantity" />
                <Input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} className="h-8 text-[12.5px]" aria-label="Unit price" />
                <span className="text-right text-[12.5px] tabular-nums">{formatMoney(it.quantity * it.unitPrice)}</span>
                <button type="button" aria-label="Remove line" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : l))} className="rounded-md p-1 text-muted-foreground hover:bg-danger-bg hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setItems((l) => [...l, { name: "", quantity: 1, unitPrice: 0 }])}><Plus /> Line</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5"><Label htmlFor="es-tax">Tax %</Label><Input id="es-tax" type="number" min={0} max={50} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-8 w-24 text-[12.5px]" /></div>
              <div className="space-y-1.5"><Label htmlFor="es-notes">Notes to customer</Label><Textarea id="es-notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-72" placeholder="Valid 14 days. Parts warranty 1 year." /></div>
            </div>
            <div className="text-right text-[12.5px] tabular-nums">
              <p className="text-muted-foreground">Subtotal {formatMoney(totals.subtotal)} · Tax {formatMoney(totals.tax)}</p>
              <p className="text-[20px] font-bold">{formatMoney(totals.total)}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" loading={pending} onClick={() => submit(true)}><Send /> Send</Button>
            <Button variant="secondary" loading={pending} onClick={() => submit(false)}>Save draft</Button>
            <Button variant="ghost" onClick={() => setBuilding(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-border">
          {rows.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No estimates here.</li>}
          {rows.map((e, i) => (
            <motion.li key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13.5px] font-medium"><span className="text-muted-foreground">#{e.number}</span> {e.title}<span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", TONE[e.status])}>{ESTIMATE_STATUS_LABEL[e.status]}</span>{needsFollowUp(e) && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-warning">Follow up</span>}</p>
                <p className="truncate text-[12px] text-muted-foreground">{e.customerId ? <Link href={routes.serviceCustomer(e.customerId)} className="hover:text-accent">{customerName(e.customerId)}</Link> : "No customer"} · {e.lineItems.length} line{e.lineItems.length === 1 ? "" : "s"} · {e.sentAt ? `sent ${formatRelativeTime(e.sentAt)}` : `created ${formatRelativeTime(e.createdAt)}`}{e.jobId ? <> · <Link href={routes.serviceJob(e.jobId)} className="text-accent">work order →</Link></> : null}</p>
              </div>
              <span className="text-[14px] font-semibold tabular-nums">{formatMoney(e.total)}</span>
              {canEdit && (e.status === "draft" || e.status === "sent") && (
                <div className="flex items-center gap-1">
                  {e.status === "draft" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide(e.id, "sent")}><Send /> Send</Button>}
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide(e.id, "declined")}><X /> Declined</Button>
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => decide(e.id, "accepted")}><Check /> Accepted</Button>
                </div>
              )}
            </motion.li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
