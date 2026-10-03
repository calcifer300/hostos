"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarCheck, Check, ClipboardList, Clock3, Coffee, DollarSign, MapPin, Package, Pencil, Plus, Scissors, Sparkles, Trash2, UserX, Users } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { BarChart, RankBar } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addAppointment,
  addChecklist,
  addShift,
  addStockItem,
  createLocation,
  editLocation,
  logSales,
  markAppointment,
  removeChecklist,
  removeLocation,
  removeShift,
  removeStockItem,
  seedChecklists,
  setChecklistItems,
  updateStock,
  type LocationInput,
} from "@/lib/actions/local";
import type { Appointment, Checklist, Client, DailySales, Location, LocationKind, SalesEntry, Shift, StockItem } from "@/lib/local/queries";
import { formatMoney } from "@/lib/restaurants/analytics";
import { US_ZONES } from "@/lib/timezones";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";

export interface LocalData {
  locations: Location[];
  sales: SalesEntry[];
  stock: StockItem[];
  shifts: Shift[];
  appointments: Appointment[];
  clients: Client[];
  rebookingDue: (Client & { daysSince: number })[];
  checklists: Checklist[];
  summary: { daily: DailySales[]; today: number; todayTransactions: number; sameDayLastWeek: number; total14d: number; avgTicket: number | null };
}

const KIND_LABEL: Record<LocationKind, { one: string; many: string; icon: typeof Coffee }> = {
  cafe: { one: "shop", many: "shops", icon: Coffee },
  salon: { one: "shop", many: "shops", icon: Scissors },
};

const today = () => new Date().toISOString().slice(0, 10);
const localDateTime = (offsetHours = 0) => {
  const d = new Date(Date.now() + offsetHours * 3600_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong.");
      if (success) toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

/* ---------------------------------------------------------- locations */

export function LocationDialog({ open, onOpenChange, kind, location }: { open: boolean; onOpenChange: (o: boolean) => void; kind: LocationKind; location?: Location | null }) {
  const { pending, run } = useAction();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: LocationInput = {
      kind,
      name: String(fd.get("name") ?? ""),
      address: String(fd.get("address") ?? ""),
      timezone: String(fd.get("timezone") ?? ""),
      posSystem: String(fd.get("posSystem") ?? ""),
      opensAt: String(fd.get("opensAt") ?? ""),
      closesAt: String(fd.get("closesAt") ?? ""),
      chairs: kind === "salon" ? Number(fd.get("chairs") ?? 0) : undefined,
      lowStockThreshold: Number(fd.get("lowStockThreshold") ?? 5),
      rebookAfterDays: Number(fd.get("rebookAfterDays") ?? 35),
      notes: String(fd.get("notes") ?? ""),
    };
    run(() => (location ? editLocation(location.id, input) : createLocation(input)), location ? "Location updated" : "Location added", () => onOpenChange(false));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{location ? "Edit location" : kind === "salon" ? "Add a barbershop" : "Add a coffee shop"}</DialogTitle>
            <DialogDescription>One physical shop. Sales, stock, shifts{kind === "salon" ? ", appointments and clients" : " and checklists"} hang off it.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="l-name">Name</Label>
                <Input id="l-name" name="name" defaultValue={location?.name ?? ""} placeholder={kind === "salon" ? "Main Street Barbers" : "Corner Café"} required autoFocus />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="l-address">Address</Label>
                <Input id="l-address" name="address" defaultValue={location?.address ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-tz">Timezone</Label>
                <NativeSelect id="l-tz" name="timezone" defaultValue={location?.timezone ?? "America/Denver"}>
                  {US_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-pos">POS / booking system</Label>
                <Input id="l-pos" name="posSystem" defaultValue={location?.posSystem ?? ""} placeholder={kind === "salon" ? "Square Appointments, Booksy…" : "Square, Toast, Clover…"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-open">Opens</Label>
                <Input id="l-open" name="opensAt" type="time" defaultValue={location?.opensAt ?? "07:00"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-close">Closes</Label>
                <Input id="l-close" name="closesAt" type="time" defaultValue={location?.closesAt ?? (kind === "salon" ? "19:00" : "16:00")} />
              </div>
              {kind === "salon" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="l-chairs">Chairs</Label>
                    <Input id="l-chairs" name="chairs" type="number" min={0} defaultValue={location?.chairs ?? 3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="l-rebook">Rebooking reminder after (days)</Label>
                    <Input id="l-rebook" name="rebookAfterDays" type="number" min={1} defaultValue={location?.rebookAfterDays ?? 35} />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="l-low">Default low-stock threshold</Label>
                  <Input id="l-low" name="lowStockThreshold" type="number" min={0} defaultValue={location?.lowStockThreshold ?? 5} />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="l-notes">Notes</Label>
                <Textarea id="l-notes" name="notes" rows={2} defaultValue={location?.notes ?? ""} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {location ? "Save changes" : "Add location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationsWidget({ kind, d, canEdit }: { kind: LocationKind; d: LocalData; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const { pending, run } = useAction();
  const Icon = KIND_LABEL[kind].icon;
  return (
    <DashboardCard
      icon={MapPin}
      title="Locations"
      action={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus /> Add {KIND_LABEL[kind].one}
          </Button>
        ) : undefined
      }
    >
      {d.locations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-[14px] font-medium">Add your first {KIND_LABEL[kind].one}</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">Everything on this dashboard — sales, stock, shifts{kind === "salon" ? ", appointments" : ""} — belongs to a location.</p>
          {canEdit && (
            <Button variant="primary" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus /> Add {KIND_LABEL[kind].one}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.locations.map((l) => {
            const salesToday = d.sales.filter((s) => s.locationId === l.id && s.day === today()).reduce((sum, s) => sum + s.grossSales, 0);
            const low = d.stock.filter((s) => s.locationId === l.id && s.quantity <= (s.lowStockThreshold ?? l.lowStockThreshold)).length;
            return (
              <motion.div key={l.id} whileHover={{ y: -2 }} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{l.name}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {l.opensAt && l.closesAt ? `${l.opensAt}–${l.closesAt}` : "Hours not set"}
                        {l.posSystem ? ` · ${l.posSystem}` : ""}
                        {kind === "salon" && l.chairs ? ` · ${l.chairs} chairs` : ""}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <span className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => { setEditing(l); setOpen(true); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Remove ${l.name} and everything logged for it?`)) run(() => removeLocation(l.id), "Removed"); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="accent">{formatMoney(salesToday)} today</Badge>
                  {low > 0 ? <Badge variant="warning">{low} low</Badge> : <Badge variant="success">Stock OK</Badge>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <LocationDialog key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} kind={kind} location={editing} />
    </DashboardCard>
  );
}

/* -------------------------------------------------------------- sales */

export function SalesWidget({ kind, d, canEdit }: { kind: LocationKind; d: LocalData; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const s = d.summary;
  const delta = s.sameDayLastWeek > 0 ? ((s.today - s.sameDayLastWeek) / s.sameDayLastWeek) * 100 : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(
      () => logSales({ locationId: String(fd.get("locationId") ?? ""), day: String(fd.get("day") ?? ""), grossSales: Number(fd.get("grossSales") ?? 0), transactions: Number(fd.get("transactions") ?? 0), laborCost: fd.get("laborCost") ? Number(fd.get("laborCost")) : null, notes: String(fd.get("notes") ?? "") }),
      "Sales logged",
      () => setOpen(false)
    );
  }

  return (
    <DashboardCard
      icon={DollarSign}
      title="Sales · 14 days"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">{formatMoney(s.total14d)} · {s.avgTicket !== null ? `${formatMoney(s.avgTicket)} avg ticket` : "no tickets yet"}</span>
          {canEdit && d.locations.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus /> Log a day
            </Button>
          )}
        </div>
      }
      className="h-full"
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
          <p className="mt-1 text-[18px] font-semibold leading-none">{formatMoney(s.today)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Same day last week</p>
          <p className="mt-1 text-[18px] font-semibold leading-none">{formatMoney(s.sameDayLastWeek)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Change</p>
          <p className={cn("mt-1 text-[18px] font-semibold leading-none", delta === null ? "text-muted-foreground" : delta >= 0 ? "text-success" : "text-danger")}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`}</p>
        </div>
      </div>
      {s.total14d === 0 ? (
        <p className="text-[13px] text-muted-foreground">{d.locations.length === 0 ? `Add a ${KIND_LABEL[kind].one} first, then log each day's sales here.` : "Log the first day's sales to start the chart."}</p>
      ) : (
        <BarChart data={s.daily.map((x) => ({ label: x.label, value: x.sales }))} height={130} format={(v) => formatMoney(v)} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Log a day&rsquo;s sales</DialogTitle>
              <DialogDescription>From the POS end-of-day report. Logging the same day again replaces it.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-loc">Location</Label>
                  <NativeSelect id="s-loc" name="locationId" defaultValue={d.locations[0]?.id ?? ""}>
                    {d.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-day">Day</Label>
                  <Input id="s-day" name="day" type="date" defaultValue={today()} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-gross">Gross sales ($)</Label>
                  <Input id="s-gross" name="grossSales" type="number" step="0.01" min={0} required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-tx">Transactions</Label>
                  <Input id="s-tx" name="transactions" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-labor">Labor cost ($, optional)</Label>
                  <Input id="s-labor" name="laborCost" type="number" step="0.01" min={0} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="s-notes">Notes</Label>
                  <Input id="s-notes" name="notes" placeholder="Rainy, event nearby, machine down…" />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* -------------------------------------------------------------- stock */

export function StockWidget({ kind, d, canEdit }: { kind: LocationKind; d: LocalData; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const locById = new Map(d.locations.map((l) => [l.id, l]));
  const rows = d.stock
    .map((s) => ({ ...s, threshold: s.lowStockThreshold ?? locById.get(s.locationId)?.lowStockThreshold ?? 5 }))
    .sort((a, b) => a.quantity - a.threshold - (b.quantity - b.threshold));
  const low = rows.filter((r) => r.quantity <= r.threshold);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(
      () => addStockItem({ locationId: String(fd.get("locationId") ?? ""), name: String(fd.get("name") ?? ""), unit: String(fd.get("unit") ?? ""), quantity: Number(fd.get("quantity") ?? 0), lowStockThreshold: fd.get("lowStockThreshold") ? Number(fd.get("lowStockThreshold")) : null, parLevel: fd.get("parLevel") ? Number(fd.get("parLevel")) : null, supplier: String(fd.get("supplier") ?? "") }),
      "Item added",
      () => setOpen(false)
    );
  }

  return (
    <DashboardCard
      icon={Package}
      title="Stock"
      action={
        <div className="flex items-center gap-2">
          {low.length > 0 && <Badge variant="warning">{low.length} low</Badge>}
          {canEdit && d.locations.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Plus /> Item
            </Button>
          )}
        </div>
      }
      className="h-full"
    >
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{kind === "salon" ? "Track towels, product and supplies here." : "Track milk, beans, cups and pastries here — low items rise to the top."}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 10).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate">
                {s.name} <span className="text-[11px] text-muted-foreground">· {locById.get(s.locationId)?.name ?? ""}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  min={0}
                  defaultValue={s.quantity}
                  disabled={!canEdit || pending}
                  onBlur={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v) && v !== s.quantity) run(() => updateStock(s.id, v, kind), ""); }}
                  className={cn("h-7 w-16 rounded-md border bg-background px-2 text-right text-[12.5px] tabular-nums outline-none focus:border-accent/50", s.quantity <= s.threshold ? "border-warning/60 text-warning" : "border-border")}
                  aria-label={`${s.name} quantity`}
                />
                <span className="w-9 truncate text-[11px] text-muted-foreground">{s.unit}</span>
                {canEdit && (
                  <button type="button" onClick={() => run(() => removeStockItem(s.id, kind), "Removed")} className="rounded-md p-1 text-muted-foreground hover:text-danger" aria-label="Remove">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Track a stock item</DialogTitle>
              <DialogDescription>Counts are updated in place on the dashboard; a low count files a restock task.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="st-name">Item</Label>
                  <Input id="st-name" name="name" placeholder={kind === "salon" ? "Towels" : "Whole milk"} required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-loc">Location</Label>
                  <NativeSelect id="st-loc" name="locationId" defaultValue={d.locations[0]?.id ?? ""}>
                    {d.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-unit">Unit</Label>
                  <Input id="st-unit" name="unit" placeholder="gallons, bags, sleeves" defaultValue="units" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-qty">On hand</Label>
                  <Input id="st-qty" name="quantity" type="number" min={0} step="0.5" defaultValue={0} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-low">Low at</Label>
                  <Input id="st-low" name="lowStockThreshold" type="number" min={0} step="0.5" placeholder="location default" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-par">Par level</Label>
                  <Input id="st-par" name="parLevel" type="number" min={0} step="0.5" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-sup">Supplier</Label>
                  <Input id="st-sup" name="supplier" />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Add item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* ------------------------------------------------------------- shifts */

export function ShiftsWidget({ kind, d, canEdit }: { kind: LocationKind; d: LocalData; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const now = useNow();
  const locById = new Map(d.locations.map((l) => [l.id, l]));
  const byDay = new Map<string, Shift[]>();
  for (const s of d.shifts) {
    const key = dayLabel(s.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => addShift({ locationId: String(fd.get("locationId") ?? ""), staffName: String(fd.get("staffName") ?? ""), role: String(fd.get("role") ?? ""), startsAt: String(fd.get("startsAt") ?? ""), endsAt: String(fd.get("endsAt") ?? ""), notes: String(fd.get("notes") ?? "") }), "Shift added", () => setOpen(false));
  }

  return (
    <DashboardCard
      icon={Clock3}
      title="Shifts"
      action={
        canEdit && d.locations.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Plus /> Shift
          </Button>
        ) : undefined
      }
      className="h-full"
    >
      {d.shifts.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nobody scheduled for today or tomorrow yet.</p>
      ) : (
        <div className="space-y-3">
          {[...byDay.entries()].map(([day, shifts]) => (
            <div key={day}>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</p>
              <ul className="space-y-1">
                {shifts.map((s) => {
                  const live = Date.parse(s.startsAt) <= now && Date.parse(s.endsAt) >= now;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", live ? "bg-success" : "bg-muted-foreground/40")} />
                        <span className="truncate font-medium">{s.staffName}</span>
                        <span className="truncate text-[11.5px] text-muted-foreground">
                          {s.role ? `${s.role} · ` : ""}
                          {locById.get(s.locationId)?.name ?? ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
                        {timeLabel(s.startsAt)}–{timeLabel(s.endsAt)}
                        {canEdit && (
                          <button type="button" disabled={pending} onClick={() => run(() => removeShift(s.id, kind), "Removed")} className="rounded-md p-1 hover:text-danger" aria-label="Remove shift">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Add a shift</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sh-name">Staff</Label>
                  <Input id="sh-name" name="staffName" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sh-role">Role</Label>
                  <Input id="sh-role" name="role" placeholder={kind === "salon" ? "Barber, front desk" : "Barista, shift lead"} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sh-loc">Location</Label>
                  <NativeSelect id="sh-loc" name="locationId" defaultValue={d.locations[0]?.id ?? ""}>
                    {d.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sh-start">Starts</Label>
                  <Input id="sh-start" name="startsAt" type="datetime-local" defaultValue={localDateTime(1)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sh-end">Ends</Label>
                  <Input id="sh-end" name="endsAt" type="datetime-local" defaultValue={localDateTime(9)} required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sh-notes">Notes</Label>
                  <Input id="sh-notes" name="notes" />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Add shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* --------------------------------------------------------- checklists */

export function ChecklistsWidget({ module, checklists, locations, canEdit, title = "Opening & closing" }: { module: "cafe" | "salon" | "custom"; checklists: Checklist[]; locations: Location[]; canEdit: boolean; title?: string }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();

  function toggle(c: Checklist, index: number) {
    const items = c.items.map((it, i) => (i === index ? { ...it, done: !it.done } : it));
    run(() => setChecklistItems(c.id, items, module), "");
  }
  function reset(c: Checklist) {
    run(() => setChecklistItems(c.id, c.items.map((it) => ({ ...it, done: false })), module), "Reset for today");
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const items = String(fd.get("items") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    run(() => addChecklist({ module, locationId: String(fd.get("locationId") ?? "") || null, title: String(fd.get("title") ?? ""), kind: String(fd.get("kind") ?? "daily"), items }), "Checklist added", () => setOpen(false));
  }

  return (
    <DashboardCard
      icon={ClipboardList}
      title={title}
      action={
        canEdit ? (
          <div className="flex items-center gap-1.5">
            {module !== "custom" && checklists.length === 0 && locations.length > 0 && (
              <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => seedChecklists(module, locations[0]?.id ?? null), "Opening and closing routines added")}>
                <Sparkles /> Add routines
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Plus /> New
            </Button>
          </div>
        ) : undefined
      }
      className="h-full"
    >
      {checklists.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{module === "custom" ? "Keep the routines that must not slip — weekly reviews, month-end, compliance." : "Opening and closing routines, ticked off by whoever is there. Add the defaults or write your own."}</p>
      ) : (
        <div className="space-y-4">
          {checklists.slice(0, 4).map((c) => {
            const done = c.items.filter((i) => i.done).length;
            return (
              <div key={c.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold">
                    {c.title} <span className="font-normal text-muted-foreground">· {done}/{c.items.length}</span>
                  </p>
                  <span className="flex items-center gap-1">
                    {c.completedAt ? <Badge variant="success">Done {formatRelativeTime(c.completedAt)}</Badge> : null}
                    {canEdit && done > 0 && (
                      <button type="button" onClick={() => reset(c)} className="text-[11px] text-muted-foreground hover:text-foreground">
                        reset
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" onClick={() => { if (window.confirm(`Remove "${c.title}"?`)) run(() => removeChecklist(c.id, module), "Removed"); }} className="rounded-md p-1 text-muted-foreground hover:text-danger" aria-label="Remove checklist">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </div>
                <ul className="space-y-1">
                  {c.items.map((it, i) => (
                    <li key={i}>
                      <button type="button" disabled={!canEdit || pending} onClick={() => toggle(c, i)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/60 disabled:opacity-70">
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors", it.done ? "border-success bg-success text-white" : "border-border")}>{it.done && <Check className="h-3 w-3" />}</span>
                        <span className={cn(it.done && "text-muted-foreground line-through")}>{it.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>New checklist</DialogTitle>
              <DialogDescription>One item per line.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cl-title">Title</Label>
                  <Input id="cl-title" name="title" placeholder="Opening" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cl-kind">Cadence</Label>
                  <NativeSelect id="cl-kind" name="kind" defaultValue="daily">
                    <option value="opening">Opening</option>
                    <option value="closing">Closing</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </NativeSelect>
                </div>
                {locations.length > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cl-loc">Location</Label>
                    <NativeSelect id="cl-loc" name="locationId" defaultValue={locations[0]?.id ?? ""}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cl-items">Items</Label>
                  <Textarea id="cl-items" name="items" rows={6} placeholder={"Unlock and lights\nCount the float\nBrew the first batch"} required />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Add checklist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* ------------------------------------------------------- appointments */

const APPT_TONE: Record<Appointment["status"], "accent" | "success" | "danger" | "neutral"> = { booked: "accent", completed: "success", no_show: "danger", cancelled: "neutral" };
const APPT_LABEL: Record<Appointment["status"], string> = { booked: "Booked", completed: "Done", no_show: "No-show", cancelled: "Cancelled" };

export function ScheduleWidget({ d, canEdit }: { d: LocalData; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();
  const locById = new Map(d.locations.map((l) => [l.id, l]));
  const todayKey = today();
  const todays = d.appointments.filter((a) => a.startsAt.slice(0, 10) === todayKey);
  const upcoming = d.appointments.filter((a) => a.startsAt.slice(0, 10) > todayKey).slice(0, 5);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(
      () => addAppointment({ locationId: String(fd.get("locationId") ?? ""), clientName: String(fd.get("clientName") ?? ""), clientPhone: String(fd.get("clientPhone") ?? ""), service: String(fd.get("service") ?? ""), staffName: String(fd.get("staffName") ?? ""), startsAt: String(fd.get("startsAt") ?? ""), durationMinutes: Number(fd.get("durationMinutes") ?? 30), price: fd.get("price") ? Number(fd.get("price")) : null, notes: String(fd.get("notes") ?? "") }),
      "Appointment added",
      () => setOpen(false)
    );
  }

  const Row = ({ a }: { a: Appointment }) => (
    <li className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-16 shrink-0 font-mono text-[12px] text-muted-foreground">{timeLabel(a.startsAt)}</span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {a.clientName}
            {a.service ? <span className="font-normal text-muted-foreground"> · {a.service}</span> : null}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {a.staffName ?? "Any barber"} · {locById.get(a.locationId)?.name ?? ""}
            {a.price !== null ? ` · ${formatMoney(a.price)}` : ""}
          </p>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1">
        {a.status === "booked" && canEdit ? (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => markAppointment(a.id, "completed"), "Marked done")} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:border-success hover:text-success" aria-label="Mark completed">
              Done
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => markAppointment(a.id, "no_show"), "Marked no-show")} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:border-danger hover:text-danger" aria-label="Mark no-show">
              No-show
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => markAppointment(a.id, "cancelled"), "Cancelled")} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Cancel">
              <UserX className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <Badge variant={APPT_TONE[a.status]}>{APPT_LABEL[a.status]}</Badge>
        )}
      </span>
    </li>
  );

  return (
    <DashboardCard
      icon={CalendarCheck}
      title="Today's chairs"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            {todays.length} today · {todays.filter((a) => a.status === "completed").length} done · {todays.filter((a) => a.status === "no_show").length} no-show
          </span>
          {canEdit && d.locations.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus /> Book
            </Button>
          )}
        </div>
      }
      className="h-full"
    >
      {todays.length === 0 && upcoming.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{d.locations.length === 0 ? "Add a shop first, then book appointments here or import them from your booking system." : "No appointments booked. Add one, or paste today's book from Square / Booksy."}</p>
      ) : (
        <div className="space-y-3">
          {todays.length > 0 && (
            <ul className="space-y-0.5">
              {todays.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Coming up</p>
              <ul className="space-y-0.5">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-1.5 py-1 text-[12.5px]">
                    <span className="truncate">
                      <span className="font-mono text-muted-foreground">{dayLabel(a.startsAt)} {timeLabel(a.startsAt)}</span> · {a.clientName}
                      {a.service ? ` · ${a.service}` : ""}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{a.staffName ?? ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Book an appointment</DialogTitle>
              <DialogDescription>Marking it done later records the visit against the client, so rebooking reminders know when they were last in.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ap-client">Client</Label>
                  <Input id="ap-client" name="clientName" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-phone">Phone</Label>
                  <Input id="ap-phone" name="clientPhone" placeholder="For reminders" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-service">Service</Label>
                  <Input id="ap-service" name="service" placeholder="Cut, fade, beard trim…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-staff">Barber</Label>
                  <Input id="ap-staff" name="staffName" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-loc">Location</Label>
                  <NativeSelect id="ap-loc" name="locationId" defaultValue={d.locations[0]?.id ?? ""}>
                    {d.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-start">Starts</Label>
                  <Input id="ap-start" name="startsAt" type="datetime-local" defaultValue={localDateTime(1)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-dur">Duration (minutes)</Label>
                  <Input id="ap-dur" name="durationMinutes" type="number" min={5} step={5} defaultValue={30} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-price">Price ($)</Label>
                  <Input id="ap-price" name="price" type="number" min={0} step="0.01" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-notes">Notes</Label>
                  <Input id="ap-notes" name="notes" />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

export function RebookingWidget({ d }: { d: LocalData }) {
  const locById = new Map(d.locations.map((l) => [l.id, l]));
  return (
    <DashboardCard icon={Users} title="Due for a rebooking" action={<span className="text-[12px] text-muted-foreground">{d.rebookingDue.length} client{d.rebookingDue.length === 1 ? "" : "s"}</span>} className="h-full">
      {d.rebookingDue.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Every regular has been in recently. Clients appear here once they pass the shop&rsquo;s rebooking window.</p>
      ) : (
        <ul className="space-y-1.5">
          {d.rebookingDue.slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium">{c.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {c.visits} visit{c.visits === 1 ? "" : "s"} · {c.preferredStaff ? `${c.preferredStaff} · ` : ""}
                  {locById.get(c.locationId)?.name ?? ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                </span>
              </span>
              <Badge variant={c.daysSince >= 60 ? "danger" : "warning"}>{c.daysSince}d ago</Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

export function RevenueByStaffWidget({ d }: { d: LocalData }) {
  const totals = new Map<string, { revenue: number; count: number }>();
  for (const a of d.appointments) {
    if (a.status !== "completed") continue;
    const key = a.staffName ?? "Unassigned";
    const cur = totals.get(key) ?? { revenue: 0, count: 0 };
    totals.set(key, { revenue: cur.revenue + (a.price ?? 0), count: cur.count + 1 });
  }
  const rows = [...totals.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <DashboardCard icon={DollarSign} title="Revenue per barber · 14 days" className="h-full">
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Completed appointments with a price show up here, by barber.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 6).map((r, i) => (
            <RankBar key={r.name} label={`${r.name} · ${r.count} cut${r.count === 1 ? "" : "s"}`} value={r.revenue} max={max} index={i} format={(v) => formatMoney(v)} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
