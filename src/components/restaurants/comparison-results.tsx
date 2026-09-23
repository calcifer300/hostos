"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Download, Link2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildActionListCsv, buildFullComparisonCsv, downloadCsv } from "@/lib/restaurants/export";
import { itemKey } from "@/lib/restaurants/match";
import { linkItems } from "@/lib/actions/restaurants";
import type { Comparison, ComparisonRow, ResultStatus } from "@/lib/restaurants/types";
import { cn } from "@/lib/utils";

const money = (v?: number) => (v === undefined ? "—" : `$${v.toFixed(2)}`);

const STATUS_META: Record<ResultStatus, { label: string; variant: "warning" | "success" | "accent" | "neutral" }> = {
  "needs-update": { label: "Needs update", variant: "warning" },
  "in-sync": { label: "In sync", variant: "success" },
  "missing-on-doordash": { label: "Missing on DoorDash", variant: "accent" },
  "unmatched-on-doordash": { label: "Only on DoorDash", variant: "neutral" },
};

function SummaryTile({ label, value, tone, delay }: { label: string; value: number; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border bg-background/40 px-4 py-3"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[24px] font-semibold leading-none tracking-tight", tone)}>{value}</p>
    </motion.div>
  );
}

function RowsTable({ rows, mode }: { rows: ComparisonRow[]; mode: "matched" | "pos-only" | "dd-only" }) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing in this bucket.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">SKU</th>
            {mode !== "dd-only" && <th className="px-3 py-2 font-medium">POS</th>}
            {mode !== "pos-only" && <th className="px-3 py-2 font-medium">DoorDash</th>}
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const item = r.pos ?? r.doordash!;
            const meta = STATUS_META[r.status];
            return (
              <tr key={r.key} className="border-t border-border align-top">
                <td className="max-w-[280px] px-4 py-2.5">
                  <p className="truncate font-medium">{item.name}</p>
                  {r.pos && r.doordash && r.pos.name !== r.doordash.name && (
                    <p className="truncate text-[11px] text-muted-foreground">DoorDash: {r.doordash.name}</p>
                  )}
                  {r.matchMethod === "fuzzy" && r.matchConfidence !== undefined && (
                    <p className="text-[10.5px] text-muted-foreground">fuzzy · {Math.round(r.matchConfidence * 100)}%</p>
                  )}
                  {r.matchMethod === "manual" && <p className="text-[10.5px] text-accent">linked by hand</p>}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">{item.sku ?? "—"}</td>
                {mode !== "dd-only" && (
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {r.pos ? (
                      <>
                        <span className={cn(r.mismatches.some((m) => m.field === "price") && "font-semibold text-warning")}>{money(r.pos.price)}</span>
                        {r.pos.quantity !== undefined && <span className="text-muted-foreground"> · qty {r.pos.quantity}</span>}
                        {r.pos.available === false && <span className="text-danger"> · 86&rsquo;d</span>}
                        {r.lowStock && <span className="text-warning"> · low</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {mode !== "pos-only" && (
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {r.doordash ? (
                      <>
                        <span className={cn(r.mismatches.some((m) => m.field === "price") && "font-semibold text-warning")}>{money(r.doordash.price)}</span>
                        {r.doordash.quantity !== undefined && <span className="text-muted-foreground"> · qty {r.doordash.quantity}</span>}
                        {r.doordash.available === false && <span className="text-danger"> · 86&rsquo;d</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {r.mismatches.length > 0 && (
                    <p className="mt-1 text-[10.5px] text-muted-foreground">{r.mismatches.map((m) => m.field).join(", ")}</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LinkItemsDialog({
  open,
  onOpenChange,
  restaurantId,
  posOnly,
  ddOnly,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurantId: string;
  posOnly: ComparisonRow[];
  ddOnly: ComparisonRow[];
  onLinked: () => void;
}) {
  const [pos, setPos] = React.useState("");
  const [dd, setDd] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const result = await linkItems(restaurantId, pos, dd);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't link those items.");
        return;
      }
      toast.success("Linked. Re-run the comparison to apply it.");
      onOpenChange(false);
      onLinked();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Link items by hand</DialogTitle>
          <DialogDescription>
            For pairs the matcher can&rsquo;t resolve. The link is remembered for this restaurant and applied to every future comparison.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-muted-foreground">POS item (missing on DoorDash)</p>
            <NativeSelect value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="">Choose…</option>
              {posOnly.map((r) => (
                <option key={r.key} value={itemKey(r.pos!)}>
                  {r.pos!.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-muted-foreground">DoorDash item (only on DoorDash)</p>
            <NativeSelect value={dd} onChange={(e) => setDd(e.target.value)}>
              <option value="">Choose…</option>
              {ddOnly.map((r) => (
                <option key={r.key} value={itemKey(r.doordash!)}>
                  {r.doordash!.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!pos || !dd} loading={pending} onClick={submit}>
            Link items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ComparisonResults({
  comparison,
  restaurantId,
  restaurantName,
  canEdit,
}: {
  comparison: Comparison;
  restaurantId: string;
  restaurantName: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [linkOpen, setLinkOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const filter = (rows: ComparisonRow[]) =>
    q ? rows.filter((r) => [r.pos?.name, r.doordash?.name, r.pos?.sku, r.doordash?.sku].some((v) => v?.toLowerCase().includes(q))) : rows;

  const needsUpdate = filter(comparison.rows.filter((r) => r.status === "needs-update"));
  const inSync = filter(comparison.rows.filter((r) => r.status === "in-sync"));
  const missing = filter(comparison.rows.filter((r) => r.status === "missing-on-doordash"));
  const unmatched = filter(comparison.rows.filter((r) => r.status === "unmatched-on-doordash"));
  const s = comparison.summary;
  const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const stamp = comparison.createdAt.slice(0, 10);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
        <SummaryTile label="Needs update" value={s.needsUpdate} tone="text-warning" delay={0} />
        <SummaryTile label="Missing on DoorDash" value={s.missingOnDoordash} tone="text-accent" delay={0.05} />
        <SummaryTile label="Only on DoorDash" value={s.unmatchedOnDoordash} tone="text-foreground" delay={0.1} />
        <SummaryTile label="In sync" value={s.inSync} tone="text-success" delay={0.15} />
        <SummaryTile label="Low stock" value={s.lowStock} tone={s.lowStock > 0 ? "text-danger" : "text-foreground"} delay={0.2} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter items…" className="h-8 pl-9" />
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setLinkOpen(true)} disabled={missing.length === 0 || unmatched.length === 0}>
            <Link2 /> Link items
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildActionListCsv(comparison), `${slug}-doordash-updates-${stamp}.csv`)}>
          <Download /> Action list
        </Button>
        <Button variant="ghost" size="sm" onClick={() => downloadCsv(buildFullComparisonCsv(comparison), `${slug}-comparison-${stamp}.csv`)}>
          Full report
        </Button>
      </div>

      <Tabs defaultValue="needs-update" className="border-t border-border">
        <div className="px-5 pt-4">
          <TabsList>
            <TabsTrigger value="needs-update">Needs update ({needsUpdate.length})</TabsTrigger>
            <TabsTrigger value="missing">Missing ({missing.length})</TabsTrigger>
            <TabsTrigger value="unmatched">Only on DoorDash ({unmatched.length})</TabsTrigger>
            <TabsTrigger value="in-sync">In sync ({inSync.length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="needs-update" className="mt-3">
          <RowsTable rows={needsUpdate} mode="matched" />
        </TabsContent>
        <TabsContent value="missing" className="mt-3">
          <RowsTable rows={missing} mode="pos-only" />
        </TabsContent>
        <TabsContent value="unmatched" className="mt-3">
          <RowsTable rows={unmatched} mode="dd-only" />
        </TabsContent>
        <TabsContent value="in-sync" className="mt-3">
          <RowsTable rows={inSync} mode="matched" />
        </TabsContent>
      </Tabs>

      <LinkItemsDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        restaurantId={restaurantId}
        posOnly={comparison.rows.filter((r) => r.status === "missing-on-doordash")}
        ddOnly={comparison.rows.filter((r) => r.status === "unmatched-on-doordash")}
        onLinked={() => router.refresh()}
      />
    </div>
  );
}
