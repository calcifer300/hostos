"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock, Phone, Play, Plus, UserPlus, Wrench } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addStaff, createCustomer, editJob, setEstimateStatus, setupServices } from "@/lib/actions/services";
import { INDUSTRIES, INDUSTRY_GROUPS, industryById, type IndustryGroup } from "@/lib/services/industries";
import { ESTIMATE_STATUS_LABEL, JOB_STATUS_LABEL, STAFF_ROLES, STAFF_ROLE_LABEL, isOpen, isOverdue, needsFollowUp, onDay, revenueSummary, staffStats, type JobStatus } from "@/lib/services/analytics";
import { todayInZone } from "@/lib/timezones";
import type { ServiceJob, ServiceStaff, ServicesData } from "@/lib/services/types";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatMoney } from "@/lib/restaurants/analytics";
import { useMounted, useNow } from "@/lib/hooks/use-client-value";

/* ------------------------------------------------------------ shared */

export const STATUS_TONE: Record<JobStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-info-bg text-info",
  in_progress: "bg-warning-bg text-warning",
  completed: "bg-success-bg text-success",
  cancelled: "bg-danger-bg text-danger",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STATUS_TONE[status])}>{JOB_STATUS_LABEL[status]}</span>;
}

export function timeRange(job: { scheduledStart: string | null; scheduledEnd: string | null }): string {
  if (!job.scheduledStart) return "Unscheduled";
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return job.scheduledEnd ? `${fmt(job.scheduledStart)} – ${fmt(job.scheduledEnd)}` : fmt(job.scheduledStart);
}

/**
 * A scheduled window in the reader's own timezone, rendered only after
 * mount — the server is in UTC and must not paint a time the browser will
 * disagree with. Before mount, an invisible placeholder keeps the width.
 */
export function When({ start, end = null, withDate = false, className }: { start: string | null; end?: string | null; withDate?: boolean; className?: string }) {
  const mounted = useMounted();
  if (!start) return <span className={className}>Unscheduled</span>;
  if (!mounted) return <span className={cn("invisible", className)} aria-hidden>00:00 PM – 00:00 PM</span>;
  const text = timeRange({ scheduledStart: start, scheduledEnd: end });
  const date = withDate ? ` · ${new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
  return <span className={className}>{text}{date}</span>;
}

export function staffName(staff: ServiceStaff[], id: string | null): string {
  return staff.find((s) => s.id === id)?.name ?? "Unassigned";
}

/** Advance a job with the one obvious next step: assigned → start, in progress → complete. */
export function NextStepButton({ job, disabled }: { job: ServiceJob; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const next: { status: JobStatus; label: string; icon: React.ReactNode } | null =
    job.status === "assigned" ? { status: "in_progress", label: "Start", icon: <Play /> } : job.status === "in_progress" ? { status: "completed", label: "Complete", icon: <CheckCircle2 /> } : null;
  if (!next) return null;
  return (
    <Button
      size="sm"
      variant={next.status === "completed" ? "primary" : "secondary"}
      loading={pending}
      disabled={disabled}
      onClick={() =>
        startTransition(async () => {
          const r = await editJob(job.id, { status: next.status });
          if (!r.ok) return void toast.error(r.error ?? "Couldn't update the job.");
          toast.success(`${job.title} — ${JOB_STATUS_LABEL[next.status]}`);
          router.refresh();
        })
      }
    >
      {next.icon} {next.label}
    </Button>
  );
}

/* ------------------------------------------------------- today's jobs */

export function TodayJobsWidget({ d, canEdit }: { d: ServicesData; canEdit: boolean }) {
  const now = useNow();
  const day = todayInZone(d.zone, new Date(now));
  const jobs = d.jobs.filter((j) => onDay(j.scheduledStart, day, d.zone) && j.status !== "cancelled").sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""));
  const unscheduledOpen = d.jobs.filter((j) => isOpen(j.status) && !j.scheduledStart).length;
  return (
    <DashboardCard icon={Clock} title="Today's jobs" action={<Link href={routes.servicesSchedule} className="text-[12px] font-medium text-accent">Full schedule →</Link>}>
      {jobs.length === 0 ? (
        <CardEmptyState icon={Wrench} message={d.settings ? `Nothing scheduled today. ${unscheduledOpen} open job${unscheduledOpen === 1 ? "" : "s"} still need a time — book them from Dispatch.` : "Set up the vertical first — pick your industry below; the catalogue and SOPs come with it."} />
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((j, i) => (
            <motion.li key={j.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex flex-wrap items-center gap-3 py-2.5">
              <When start={j.scheduledStart} end={j.scheduledEnd} className="w-28 shrink-0 text-[12px] tabular-nums text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link href={routes.serviceJob(j.id)} className="block truncate text-[13.5px] font-medium hover:text-accent">
                  #{j.number} {j.title}
                </Link>
                <p className="truncate text-[12px] text-muted-foreground">{staffName(d.staff, j.staffId)}{j.address ? ` · ${j.address}` : ""}</p>
              </div>
              {isOverdue(j, now) && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10.5px] font-semibold text-danger">Overdue</span>}
              <StatusPill status={j.status} />
              {canEdit && <NextStepButton job={j} />}
            </motion.li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ---------------------------------------------------- dispatch snapshot */

export function DispatchSnapshotWidget({ d }: { d: ServicesData }) {
  const open = d.jobs.filter((j) => isOpen(j.status));
  const counts: Record<JobStatus, number> = { completed: 0, cancelled: 0, pending: open.filter((j) => j.status === "pending").length, assigned: open.filter((j) => j.status === "assigned").length, in_progress: open.filter((j) => j.status === "in_progress").length };
  const busy = new Set(open.filter((j) => j.status === "in_progress").map((j) => j.staffId));
  const techs = d.staff.filter((s) => s.active && s.role === "technician");
  const free = techs.filter((t) => !busy.has(t.id));
  return (
    <DashboardCard icon={Wrench} title="Dispatch" action={<Link href={routes.servicesDispatch} className="text-[12px] font-medium text-accent">Open board →</Link>}>
      <div className="grid grid-cols-3 gap-2">
        {(["pending", "assigned", "in_progress"] as JobStatus[]).map((s) => (
          <Link key={s} href={routes.servicesDispatch} className={cn("rounded-xl border border-border p-3 text-center transition-colors hover:border-accent/40", s === "pending" && counts.pending > 0 && "border-warning/40")}>
            <p className="text-[22px] font-bold leading-none tabular-nums">{counts[s]}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{JOB_STATUS_LABEL[s]}</p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        {techs.length === 0 ? "No technicians yet — add them in the Technicians card." : `${free.length} of ${techs.length} technician${techs.length === 1 ? "" : "s"} free right now${free.length > 0 ? `: ${free.slice(0, 4).map((t) => t.name.split(" ")[0]).join(", ")}` : ""}.`}
      </p>
    </DashboardCard>
  );
}

/* --------------------------------------------------- estimates pipeline */

export function EstimatesPipelineWidget({ d, canEdit }: { d: ServicesData; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const month = new Date().toISOString().slice(0, 7);
  const sent = d.estimates.filter((e) => e.status === "sent");
  const acceptedMonth = d.estimates.filter((e) => e.status === "accepted" && e.decidedAt?.slice(0, 7) === month);
  const decided = d.estimates.filter((e) => e.status === "accepted" || e.status === "declined");
  const winRate = decided.length > 0 ? Math.round((d.estimates.filter((e) => e.status === "accepted").length / decided.length) * 100) : null;
  const followUps = sent.filter((e) => needsFollowUp(e)).sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));

  function decide(id: string, status: "accepted" | "declined") {
    startTransition(async () => {
      const r = await setEstimateStatus(id, status);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't update.");
      toast.success(status === "accepted" ? "Accepted — work order created" : "Marked declined");
      router.refresh();
    });
  }

  return (
    <DashboardCard icon={ArrowRight} title="Estimates" action={<Link href={routes.servicesEstimates} className="text-[12px] font-medium text-accent">All estimates →</Link>}>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border p-3 text-center"><p className="text-[22px] font-bold leading-none tabular-nums">{sent.length}</p><p className="mt-1 text-[11px] text-muted-foreground">Waiting</p></div>
        <div className="rounded-xl border border-border p-3 text-center"><p className="text-[22px] font-bold leading-none tabular-nums">{formatMoney(acceptedMonth.reduce((s, e) => s + e.total, 0))}</p><p className="mt-1 text-[11px] text-muted-foreground">Won this month</p></div>
        <div className="rounded-xl border border-border p-3 text-center"><p className="text-[22px] font-bold leading-none tabular-nums">{winRate === null ? "—" : `${winRate}%`}</p><p className="mt-1 text-[11px] text-muted-foreground">Win rate</p></div>
      </div>
      {followUps.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          <li className="text-[11px] font-semibold uppercase tracking-wide text-warning">Need a follow-up</li>
          {followUps.slice(0, 4).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">#{e.number} {e.title} · {formatMoney(e.total)} · sent {e.sentAt ? formatRelativeTime(e.sentAt) : ""}</span>
              {canEdit && (
                <>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide(e.id, "declined")}>Declined</Button>
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => decide(e.id, "accepted")}>Accepted</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ---------------------------------------------------------------- leads */

export function LeadsWidget({ d, canEdit }: { d: ServicesData; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const leads = d.customers.filter((c) => c.stage === "lead").slice(0, 6);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createCustomer({ name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? ""), email: String(fd.get("email") ?? ""), address: String(fd.get("address") ?? ""), source: String(fd.get("source") ?? ""), stage: "lead", notes: String(fd.get("notes") ?? "") });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't add the lead.");
      toast.success("Lead added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DashboardCard icon={Phone} title="New leads" action={canEdit ? <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> Lead</Button> : undefined}>
      {leads.length === 0 ? (
        <CardEmptyState icon={Phone} message="No open leads yet. Every call, text or message becomes a lead here, with where it came from." />
      ) : (
        <ul className="divide-y divide-border">
          {leads.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={routes.serviceCustomer(c.id)} className="block truncate text-[13.5px] font-medium hover:text-accent">{c.name}</Link>
                <p className="truncate text-[12px] text-muted-foreground">{[c.phone, c.source ? `via ${c.source}` : null, formatRelativeTime(c.createdAt)].filter(Boolean).join(" · ")}</p>
              </div>
              <Link href={routes.serviceCustomer(c.id)} className="text-[12px] font-medium text-accent">Open →</Link>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>New lead</DialogTitle>
              <DialogDescription>Log who reached out and how. You can book an estimate visit from their page.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="l-name">Name</Label><Input id="l-name" name="name" required placeholder="Maria Santos" /></div>
              <div className="space-y-1.5"><Label htmlFor="l-phone">Phone</Label><Input id="l-phone" name="phone" placeholder="+1 555 010 2030" /></div>
              <div className="space-y-1.5"><Label htmlFor="l-email">Email</Label><Input id="l-email" name="email" type="email" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="l-address">Service address</Label><Input id="l-address" name="address" placeholder="Street, city" /></div>
              <div className="space-y-1.5"><Label htmlFor="l-source">Came from</Label>
                <NativeSelect id="l-source" name="source" defaultValue="phone">
                  {["phone", "facebook", "google", "website", "referral", "whatsapp", "other"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="l-notes">What they need</Label><Input id="l-notes" name="notes" placeholder="Cracked windshield, 2019 Camry" /></div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>Add lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* ----------------------------------------------------------------- team */

export function TeamWidget({ d, canEdit }: { d: ServicesData; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const stats = new Map(staffStats(d.jobs).map((s) => [s.staffId, s]));
  const industry = industryById(d.settings?.industry);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await addStaff({ name: String(fd.get("name") ?? ""), role: String(fd.get("role") ?? "technician"), phone: String(fd.get("phone") ?? ""), email: String(fd.get("email") ?? ""), skills: fd.getAll("skills").map(String) });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't add them.");
      toast.success("Added to the team");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DashboardCard icon={UserPlus} title="Team" action={canEdit ? <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus /> Person</Button> : undefined}>
      {d.staff.length === 0 ? (
        <CardEmptyState icon={UserPlus} message="No technicians yet. Add technicians, dispatchers and your VA so jobs can be assigned." />
      ) : (
        <ul className="divide-y divide-border">
          {d.staff.filter((s) => s.active).map((s) => {
            const st = stats.get(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: s.color ?? "linear-gradient(135deg,var(--accent),var(--accent-2))" }}>{s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{s.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{STAFF_ROLE_LABEL[s.role]}{s.skills.length ? ` · ${s.skills.join(", ")}` : ""}</p>
                </div>
                {s.role === "technician" && (
                  <div className="text-right text-[12px] tabular-nums">
                    <p className="font-medium">{st ? formatMoney(st.revenue) : "—"}</p>
                    <p className="text-muted-foreground">{st?.completionRate !== null && st?.completionRate !== undefined ? `${st.completionRate}% completed` : "no jobs yet"}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Add to the team</DialogTitle>
              <DialogDescription>Technicians get jobs assigned; dispatchers, managers and VAs run the board.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="s-name">Name</Label><Input id="s-name" name="name" required /></div>
              <div className="space-y-1.5"><Label htmlFor="s-role">Role</Label>
                <NativeSelect id="s-role" name="role" defaultValue="technician">{STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="s-phone">Phone</Label><Input id="s-phone" name="phone" /></div>
              <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" name="email" type="email" /></div>
              {industry && industry.skills.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Skills</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {industry.skills.map((sk) => (
                      <label key={sk} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] has-[:checked]:border-accent/50 has-[:checked]:bg-accent/10 has-[:checked]:text-accent">
                        <input type="checkbox" name="skills" value={sk} className="sr-only" />{sk}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}

/* ---------------------------------------------------------------- setup */

export function SetupWidget({ d, canEdit }: { d: ServicesData; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [group, setGroup] = React.useState<IndustryGroup>("automotive");
  const [industry, setIndustry] = React.useState<string>(INDUSTRIES.find((i) => i.group === "automotive")?.id ?? "");
  const [name, setName] = React.useState("");
  const current = industryById(d.settings?.industry);
  const rev = revenueSummary(d.jobs, new Date(), d.zone);

  function apply() {
    startTransition(async () => {
      const r = await setupServices({ industry, businessName: name });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't apply the template.");
      toast.success(`${industryById(industry)?.label} template applied — catalogue, SOPs and the job checklist are in`);
      router.refresh();
    });
  }

  if (current && d.settings) {
    return (
      <DashboardCard icon={Wrench} title="Industry template" action={<Link href={routes.servicesKnowledge} className="text-[12px] font-medium text-accent">SOPs →</Link>}>
        <p className="text-[14px] font-semibold">{d.settings.businessName ? `${d.settings.businessName} · ` : ""}{current.label}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{INDUSTRY_GROUPS[current.group]} · {current.mobile ? "mobile — technicians travel" : "customers come in"} · {d.docs.length} SOPs & policies · {formatMoney(rev.month)} completed this month</p>
        <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {d.settings.catalog.slice(0, 8).map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px]">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{c.price > 0 ? formatMoney(c.price) : "quote"} · {c.durationMin}m</span>
            </li>
          ))}
        </ul>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard icon={Wrench} title="Set up your service business">
      <p className="text-[13px] text-muted-foreground">Pick the closest industry. HostOS loads its service catalogue with prices and durations, the SOPs and policies a business like yours runs on, and the checklist every technician follows — all editable afterwards.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="setup-group">Category</Label>
          <NativeSelect id="setup-group" value={group} onChange={(e) => { const g = e.target.value as IndustryGroup; setGroup(g); setIndustry(INDUSTRIES.find((i) => i.group === g)?.id ?? ""); }}>
            {(Object.keys(INDUSTRY_GROUPS) as IndustryGroup[]).map((g) => <option key={g} value={g}>{INDUSTRY_GROUPS[g]}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-industry">Industry</Label>
          <NativeSelect id="setup-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIES.filter((i) => i.group === group).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="setup-name">Business name (optional)</Label>
          <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rocky Mountain Auto Glass" />
        </div>
      </div>
      {industryById(industry) && (
        <p className="mt-3 text-[12px] text-muted-foreground">Comes with {industryById(industry)!.catalog.length} services, {5 + industryById(industry)!.sops.length} SOPs & policies and a {industryById(industry)!.jobChecklist.length}-step job checklist.</p>
      )}
      <div className="mt-4">
        <Button variant="primary" loading={pending} disabled={!canEdit} onClick={apply}>Apply template <ArrowRight /></Button>
      </div>
    </DashboardCard>
  );
}

export { ESTIMATE_STATUS_LABEL };
