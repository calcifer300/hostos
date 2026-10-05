"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Blocks, Hammer, Plus, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Sparkline } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMetric, logMetric, removeMetric, requestBuild, updateBuildRequest } from "@/lib/actions/custom";
import type { BuildRequest, CustomMetric } from "@/lib/custom/queries";
import { metricStatus } from "@/lib/custom/analytics";
import { cn, formatRelativeTime } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

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

const fmt = (v: number | null, unit: string | null) => (v === null ? "—" : `${unit === "$" ? "$" : ""}${Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit && unit !== "$" ? ` ${unit}` : ""}`);

/* ------------------------------------------------------------ metrics */

export function MetricsWidget({ metrics, canEdit }: { metrics: CustomMetric[]; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [logging, setLogging] = React.useState<CustomMetric | null>(null);
  const { pending, run } = useAction();

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => createMetric({ name: String(fd.get("name") ?? ""), unit: String(fd.get("unit") ?? ""), target: fd.get("target") ? Number(fd.get("target")) : null, direction: fd.get("direction") === "down" ? "down" : "up" }), "Now tracking", () => setOpen(false));
  }
  function onLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!logging) return;
    const fd = new FormData(e.currentTarget);
    run(() => logMetric({ metricId: logging.id, day: String(fd.get("day") ?? ""), value: Number(fd.get("value")), note: String(fd.get("note") ?? "") }), "Logged", () => setLogging(null));
  }

  return (
    <DashboardCard
      icon={Target}
      title="Your numbers"
      action={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus /> Track a number
          </Button>
        ) : undefined
      }
    >
      {metrics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-[14px] font-medium">What do you want to see every morning?</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">Daily revenue, leads, jobs completed, cash in the bank — name it, set a target, and log it in a tap. HostOS charts it and flags the days you miss.</p>
          {canEdit && (
            <Button variant="primary" className="mt-4" onClick={() => setOpen(true)}>
              <Plus /> Track your first number
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m, i) => {
            const s = metricStatus(m);
            const Trend = s.changePct !== null && s.changePct < 0 ? TrendingDown : TrendingUp;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.target !== null ? `Target ${fmt(m.target, m.unit)} · ${m.direction === "up" ? "higher is better" : "lower is better"}` : "No target"}
                    </p>
                  </div>
                  {s.onTarget !== null && <Badge variant={s.onTarget ? "success" : "warning"}>{s.onTarget ? "On target" : "Below"}</Badge>}
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[24px] font-semibold leading-none tracking-tight">{fmt(s.latest, m.unit)}</p>
                    <p className={cn("mt-1 flex items-center gap-1 text-[11px]", s.changePct === null ? "text-muted-foreground" : (s.changePct >= 0) === (m.direction === "up") ? "text-success" : "text-danger")}>
                      {s.changePct !== null && <Trend className="h-3 w-3" />}
                      {s.changePct === null ? (m.entries.length ? `Logged ${m.entries[m.entries.length - 1].day}` : "Nothing logged yet") : `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(0)}% vs previous`}
                    </p>
                  </div>
                  {m.entries.length > 1 && <Sparkline values={m.entries.slice(-14).map((e) => e.value)} width={90} height={30} tone={s.onTarget === false ? "warning" : "accent"} />}
                </div>
                {canEdit && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => setLogging(m)}>
                      <Plus /> Log today
                    </Button>
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Stop tracking ${m.name}?`)) run(() => removeMetric(m.id), "Removed"); }} className="rounded-md p-1.5 text-muted-foreground hover:text-danger" aria-label="Remove metric">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onCreate} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Track a number</DialogTitle>
              <DialogDescription>One metric, logged as often as you like. The target turns the card green or amber.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="m-name">Name</Label>
                  <Input id="m-name" name="name" placeholder="Daily revenue" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-unit">Unit</Label>
                  <Input id="m-unit" name="unit" placeholder="$, leads, jobs, %" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-target">Target</Label>
                  <Input id="m-target" name="target" type="number" step="any" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="m-dir">Good direction</Label>
                  <NativeSelect id="m-dir" name="direction" defaultValue="up">
                    <option value="up">Higher is better</option>
                    <option value="down">Lower is better</option>
                  </NativeSelect>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Track it
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={logging !== null} onOpenChange={(o) => !o && setLogging(null)}>
        <DialogContent size="sm">
          <form onSubmit={onLog} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Log {logging?.name}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lg-value">Value{logging?.unit ? ` (${logging.unit})` : ""}</Label>
                  <Input id="lg-value" name="value" type="number" step="any" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lg-day">Day</Label>
                  <Input id="lg-day" name="day" type="date" defaultValue={today()} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lg-note">Note</Label>
                  <Input id="lg-note" name="note" placeholder="Optional" />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setLogging(null)}>
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

/* ----------------------------------------------------- build requests */

const STATUS_TONE: Record<BuildRequest["status"], "accent" | "warning" | "success" | "neutral" | "danger"> = { new: "accent", scoping: "warning", building: "warning", done: "success", declined: "neutral" };

export function BuildRequestsWidget({ requests, canEdit }: { requests: BuildRequest[]; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { pending, run } = useAction();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => requestBuild({ title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), priority: (String(fd.get("priority") ?? "medium") as BuildRequest["priority"]) }), "Sent to HostOS Collective", () => setOpen(false));
  }

  return (
    <DashboardCard
      icon={Hammer}
      title="Build requests"
      action={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Blocks /> Ask for a build
          </Button>
        ) : undefined
      }
      className="h-full"
    >
      {requests.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Need a monitor, an automation, an integration or a whole tool? Describe it here — it lands with HostOS Collective&rsquo;s engineers as a task, and you&rsquo;ll see its status here.</p>
      ) : (
        <ul className="space-y-2">
          {requests.slice(0, 6).map((r) => (
            <li key={r.id} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium">{r.title}</p>
                <Badge variant={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>
              {r.description && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{r.description}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {r.priority} priority · {formatRelativeTime(r.createdAt)}
                </span>
                {canEdit && r.status !== "done" && r.status !== "declined" && (
                  <button type="button" disabled={pending} onClick={() => run(() => updateBuildRequest(r.id, "done"), "Marked done")} className="hover:text-foreground">
                    mark done
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Ask HostOS Collective for a build</DialogTitle>
              <DialogDescription>Describe the outcome, not the implementation. We scope it and come back with a plan.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="br-title">What should exist?</Label>
                  <Input id="br-title" name="title" placeholder="Alert me when a client's invoice is 7 days overdue" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="br-desc">Details</Label>
                  <Textarea id="br-desc" name="description" rows={5} placeholder="Where the data lives today, who needs to see it, what should happen when it fires…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="br-pri">Priority</Label>
                  <NativeSelect id="br-pri" name="priority" defaultValue="medium">
                    <option value="low">Low — when there&rsquo;s time</option>
                    <option value="medium">Medium — this month</option>
                    <option value="high">High — it&rsquo;s costing us now</option>
                  </NativeSelect>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}
