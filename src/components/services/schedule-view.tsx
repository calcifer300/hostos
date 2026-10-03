"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { editJob } from "@/lib/actions/services";
import { conflicts, isOverdue } from "@/lib/services/analytics";
import type { CatalogItem } from "@/lib/services/industries";
import type { ServiceCustomer, ServiceJob, ServiceStaff } from "@/lib/services/types";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useMounted, useNow } from "@/lib/hooks/use-client-value";
import { NewJobDialog } from "@/components/services/new-job-dialog";
import { STATUS_TONE, timeRange } from "@/components/services/service-widgets";

const DAY_MS = 86_400_000;

function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
const localDayKey = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localKeyOf = (t: number) => localDayKey(new Date(t).toISOString());

/**
 * A week of visits, one row per technician (plus "Unassigned"), one column
 * per day. Moving a job to another day or technician is a select on the
 * card — the server keeps the duration and flags pending/assigned.
 * Conflicts (same technician, overlapping windows) are marked so a
 * dispatcher sees the double-booking before the customer does.
 */
export function ScheduleView(props: { jobs: ServiceJob[]; staff: ServiceStaff[]; customers: ServiceCustomer[]; catalog: CatalogItem[]; canEdit: boolean }) {
  // The week grid is laid out in the reader's timezone, which the server
  // doesn't know: a skeleton on the server, the calendar once mounted.
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="skeleton h-9 w-72" />
        <div className="skeleton h-[420px] w-full rounded-2xl" />
      </div>
    );
  }
  return <ScheduleGrid {...props} />;
}

function ScheduleGrid({ jobs, staff, customers, catalog, canEdit }: { jobs: ServiceJob[]; staff: ServiceStaff[]; customers: ServiceCustomer[]; catalog: CatalogItem[]; canEdit: boolean }) {
  const router = useRouter();
  const now = useNow();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(now));
  const [creating, setCreating] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS);
  const techs = staff.filter((s) => s.active && s.role === "technician");
  const rows: { id: string | null; name: string; color: string | null }[] = [...techs.map((t) => ({ id: t.id, name: t.name, color: t.color })), { id: null, name: "Unassigned", color: null }];
  const scheduled = jobs.filter((j) => j.scheduledStart && j.status !== "cancelled");
  const unscheduled = jobs.filter((j) => !j.scheduledStart && j.status !== "cancelled" && j.status !== "completed");
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? null;
  const conflictIds = new Set<string>();
  for (const a of scheduled) for (const b of scheduled) if (a.id < b.id && conflicts(a, b)) { conflictIds.add(a.id); conflictIds.add(b.id); }

  function reschedule(job: ServiceJob, patch: { day?: string; staffId?: string | null }) {
    startTransition(async () => {
      const next: { scheduledStart?: string; staffId?: string | null } = {};
      if (patch.day && job.scheduledStart) {
        const old = new Date(job.scheduledStart);
        const [y, m, d] = patch.day.split("-").map(Number);
        const moved = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
        next.scheduledStart = moved.toISOString();
      }
      if (patch.staffId !== undefined) next.staffId = patch.staffId;
      const r = await editJob(job.id, next);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't move the job.");
      router.refresh();
    });
  }

  const label = `${new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekStart + 6 * DAY_MS).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="icon-sm" aria-label="Previous week" onClick={() => setWeekStart((w) => w - 7 * DAY_MS)}><ChevronLeft /></Button>
        <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(now))}>This week</Button>
        <Button variant="secondary" size="icon-sm" aria-label="Next week" onClick={() => setWeekStart((w) => w + 7 * DAY_MS)}><ChevronRight /></Button>
        <span className="text-[13px] font-medium">{label}</span>
        {conflictIds.size > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-semibold text-danger"><AlertTriangle className="h-3 w-3" /> {conflictIds.size} double-booked</span>}
        {canEdit && <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}><Plus /> New job</Button>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface/60">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="w-40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Technician</th>
              {days.map((d) => {
                const isToday = dayKey(d) === dayKey(now);
                return (
                  <th key={d} className={cn("px-2 py-2 text-[11px] font-semibold uppercase tracking-wide", isToday ? "text-accent" : "text-muted-foreground")}>
                    {new Date(d).toLocaleDateString("en-US", { weekday: "short" })} <span className="font-normal normal-case">{new Date(d).getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? "none"} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    {row.color && <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />}
                    {row.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{scheduled.filter((j) => j.staffId === row.id && days.some((d) => localKeyOf(d) === localDayKey(j.scheduledStart!))).length} this week</p>
                </td>
                {days.map((d) => {
                  const key = localKeyOf(d);
                  const cell = scheduled.filter((j) => j.staffId === row.id && localDayKey(j.scheduledStart!) === key).sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
                  return (
                    <td key={d} className={cn("min-w-[130px] px-1.5 py-1.5", dayKey(d) === dayKey(now) && "bg-accent/[0.04]")}>
                      <div className="flex flex-col gap-1.5">
                        {cell.map((j) => (
                          <motion.div key={j.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("spot rounded-lg border bg-card p-2 shadow-[var(--shadow-card)]", conflictIds.has(j.id) ? "border-danger/60" : isOverdue(j, now) ? "border-warning/60" : "border-border")}>
                            <Link href={routes.serviceJob(j.id)} className="block truncate text-[12px] font-semibold hover:text-accent">#{j.number} {j.title}</Link>
                            <p className="truncate text-[11px] tabular-nums text-muted-foreground">{timeRange(j)}{customerName(j.customerId) ? ` · ${customerName(j.customerId)}` : ""}</p>
                            <span className={cn("mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-semibold", STATUS_TONE[j.status])}>{j.status.replace("_", " ")}</span>
                            {canEdit && j.status !== "completed" && (
                              <div className="mt-1.5 grid grid-cols-2 gap-1">
                                <NativeSelect value={key} disabled={pending} onChange={(e) => reschedule(j, { day: e.target.value })} className="h-7 px-1.5 pr-5 text-[11px]" aria-label="Move to day">
                                  {days.map((dd) => <option key={dd} value={localKeyOf(dd)}>{new Date(dd).toLocaleDateString("en-US", { weekday: "short" })}</option>)}
                                </NativeSelect>
                                <NativeSelect value={j.staffId ?? ""} disabled={pending} onChange={(e) => reschedule(j, { staffId: e.target.value || null })} className="h-7 px-1.5 pr-5 text-[11px]" aria-label="Technician">
                                  <option value="">—</option>
                                  {techs.map((t) => <option key={t.id} value={t.id}>{t.name.split(" ")[0]}</option>)}
                                </NativeSelect>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Waiting for a time · {unscheduled.length}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unscheduled.map((j) => (
              <li key={j.id}>
                <Link href={routes.serviceJob(j.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12.5px] transition-colors hover:border-accent/40">
                  #{j.number} {j.title}{customerName(j.customerId) ? ` · ${customerName(j.customerId)}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewJobDialog open={creating} onOpenChange={setCreating} customers={customers} staff={staff} catalog={catalog} />
    </div>
  );
}
