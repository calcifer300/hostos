"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, MapPin, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { editJob } from "@/lib/actions/services";
import { JOB_STATUSES, JOB_STATUS_LABEL, isOverdue, type JobStatus } from "@/lib/services/analytics";
import type { ServiceCustomer, ServiceJob, ServiceStaff } from "@/lib/services/types";
import type { CatalogItem } from "@/lib/services/industries";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";
import { NewJobDialog } from "@/components/services/new-job-dialog";
import { STATUS_TONE, When } from "@/components/services/service-widgets";

const COLUMNS: JobStatus[] = ["pending", "assigned", "in_progress", "completed", "cancelled"];
const PRIORITY_TONE: Record<ServiceJob["priority"], string> = { low: "text-muted-foreground", normal: "text-muted-foreground", high: "text-warning", urgent: "text-danger" };

/**
 * The dispatch board: one column per status, a technician picker on every
 * open card, and a status picker to move it. Dispatchers reassign by
 * changing the technician; the server keeps pending/assigned honest. Cards
 * animate between columns with layout animations, so a move reads as a
 * move, not a re-render.
 */
export function DispatchBoard({ jobs, staff, customers, catalog = [], canEdit }: { jobs: ServiceJob[]; staff: ServiceStaff[]; customers: ServiceCustomer[]; catalog?: CatalogItem[]; canEdit: boolean }) {
  const router = useRouter();
  const now = useNow();
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [techFilter, setTechFilter] = React.useState<string>("");
  const [local, setLocal] = React.useState(jobs);

  // A fresh server render carries the truth; adopt it.
  const [seen, setSeen] = React.useState(jobs);
  if (seen !== jobs) {
    setSeen(jobs);
    setLocal(jobs);
  }

  const techs = staff.filter((s) => s.active && s.role === "technician");
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? null;

  function move(job: ServiceJob, patch: { status?: JobStatus; staffId?: string | null }) {
    // Optimistic: the card jumps now; the server confirms (and may correct pending/assigned).
    setLocal((list) => list.map((j) => (j.id === job.id ? { ...j, ...patch, status: patch.status ?? (patch.staffId !== undefined ? (patch.staffId ? (j.status === "pending" ? "assigned" : j.status) : j.status === "assigned" ? "pending" : j.status) : j.status) } : j)));
    startTransition(async () => {
      const r = await editJob(job.id, patch);
      if (!r.ok) {
        toast.error(r.error ?? "Couldn't move the job.");
        setLocal(jobs);
        return;
      }
      router.refresh();
    });
  }

  const visible = techFilter ? local.filter((j) => j.staffId === techFilter || (techFilter === "none" && !j.staffId)) : local;
  const recentClosed = (j: ServiceJob) => j.status !== "completed" && j.status !== "cancelled" ? true : now - Date.parse(j.updatedAt) < 3 * 86_400_000;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="h-9 w-56" aria-label="Filter by technician">
          <option value="">Everyone</option>
          <option value="none">Unassigned only</option>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </NativeSelect>
        <span className="text-[12.5px] text-muted-foreground">{visible.filter((j) => j.status !== "completed" && j.status !== "cancelled").length} open</span>
        {canEdit && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus /> New job
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((status) => {
          const cards = visible.filter((j) => j.status === status && recentClosed(j)).sort((a, b) => (a.scheduledStart ?? "9").localeCompare(b.scheduledStart ?? "9"));
          return (
            <section key={status} className={cn("flex min-h-[200px] flex-col rounded-2xl border border-border bg-surface/60 p-2", status === "pending" && cards.length > 0 && "border-warning/40")}>
              <header className="flex items-center justify-between px-1.5 py-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[status])}>{JOB_STATUS_LABEL[status]}</span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">{cards.length}</span>
              </header>
              <motion.ul layout className="flex flex-1 flex-col gap-2">
                <AnimatePresence initial={false}>
                  {cards.map((j) => {
                    const late = isOverdue(j, now);
                    return (
                      <motion.li key={j.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className={cn("spot rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]", late ? "border-danger/50" : "border-border")}>
                        <div className="flex items-start justify-between gap-2">
                          <Link href={routes.serviceJob(j.id)} className="min-w-0 text-[13px] font-semibold leading-snug hover:text-accent">
                            <span className="text-muted-foreground">#{j.number}</span> {j.title}
                          </Link>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-1 truncate text-[12px] text-muted-foreground">{customerName(j.customerId) ?? "No customer"}{j.priority !== "normal" ? <span className={cn("ml-1 font-semibold uppercase", PRIORITY_TONE[j.priority])}> · {j.priority}</span> : null}</p>
                        <p className="mt-1 flex items-center gap-1 text-[12px] tabular-nums text-muted-foreground">{late && <AlertTriangle className="h-3 w-3 text-danger" />}<When start={j.scheduledStart} end={j.scheduledEnd} withDate /></p>
                        {j.address && <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted-foreground"><MapPin className="h-3 w-3" />{j.address}</p>}
                        {canEdit && status !== "cancelled" ? (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <NativeSelect value={j.staffId ?? ""} disabled={pending} onChange={(e) => move(j, { staffId: e.target.value || null })} className="h-8 text-[12px]" aria-label="Technician">
                              <option value="">Unassigned</option>
                              {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </NativeSelect>
                            <NativeSelect value={j.status} disabled={pending} onChange={(e) => move(j, { status: e.target.value as JobStatus })} className="h-8 text-[12px]" aria-label="Status">
                              {JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>)}
                            </NativeSelect>
                          </div>
                        ) : (
                          <p className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground"><User className="h-3 w-3" />{staff.find((s) => s.id === j.staffId)?.name ?? "Unassigned"}</p>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </motion.ul>
            </section>
          );
        })}
      </div>

      <NewJobDialog open={creating} onOpenChange={setCreating} customers={customers} staff={staff} catalog={catalog} />
    </div>
  );
}
