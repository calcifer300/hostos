"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Building2, Mail, MapPin, MessageSquare, Phone, Plus, Search, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addProperty, createCustomer, editCustomer, logEvent } from "@/lib/actions/services";
import { EVENT_KINDS, EVENT_KIND_LABEL, ESTIMATE_STATUS_LABEL, type CustomerStage } from "@/lib/services/analytics";
import type { CatalogItem } from "@/lib/services/industries";
import type { ServiceCustomer, ServiceEstimate, ServiceEvent, ServiceJob, ServiceProperty, ServiceStaff } from "@/lib/services/types";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatMoney } from "@/lib/restaurants/analytics";
import { NewJobDialog } from "@/components/services/new-job-dialog";
import { StatusPill, When } from "@/components/services/service-widgets";

const STAGE_TONE: Record<CustomerStage, string> = { lead: "bg-warning-bg text-warning", customer: "bg-success-bg text-success", inactive: "bg-muted text-muted-foreground" };

/* ------------------------------------------------------------- list */

export function CustomersList({ customers, jobs, canEdit }: { customers: ServiceCustomer[]; jobs: ServiceJob[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState<"" | CustomerStage>("");
  const [adding, setAdding] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const needle = q.trim().toLowerCase();
  const rows = customers.filter((c) => (!stage || c.stage === stage) && (!needle || [c.name, c.company, c.email, c.phone, c.address].some((v) => v?.toLowerCase().includes(needle))));
  const jobsFor = (id: string) => jobs.filter((j) => j.customerId === id);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createCustomer({ name: String(fd.get("name") ?? ""), company: String(fd.get("company") ?? ""), phone: String(fd.get("phone") ?? ""), email: String(fd.get("email") ?? ""), address: String(fd.get("address") ?? ""), stage: String(fd.get("stage") ?? "lead"), source: String(fd.get("source") ?? "") });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't add.");
      toast.success("Added");
      setAdding(false);
      router.refresh();
      if (r.id) router.push(routes.serviceCustomer(r.id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, address…" className="pl-9" />
        </div>
        <NativeSelect value={stage} onChange={(e) => setStage(e.target.value as "" | CustomerStage)} className="h-9 w-40" aria-label="Stage">
          <option value="">All stages</option>
          <option value="lead">Leads</option>
          <option value="customer">Customers</option>
          <option value="inactive">Inactive</option>
        </NativeSelect>
        <span className="text-[12.5px] text-muted-foreground">{rows.length} of {customers.length}</span>
        {canEdit && <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAdding((v) => !v)}><Plus /> Customer</Button>}
      </div>

      {adding && (
        <Card padding="md">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" required /></div>
            <div className="space-y-1.5"><Label htmlFor="c-company">Company</Label><Input id="c-company" name="company" /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" name="phone" /></div>
            <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" name="email" type="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="c-address">Address</Label><Input id="c-address" name="address" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label htmlFor="c-stage">Stage</Label><NativeSelect id="c-stage" name="stage" defaultValue="lead"><option value="lead">Lead</option><option value="customer">Customer</option></NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="c-source">Source</Label><NativeSelect id="c-source" name="source" defaultValue="phone">{["phone", "facebook", "google", "website", "referral", "whatsapp", "other"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</NativeSelect></div>
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" variant="primary" loading={pending}>Add customer</Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-border">
          {rows.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nobody matches yet.</li>}
          {rows.map((c, i) => {
            const cj = jobsFor(c.id);
            const lifetime = cj.filter((j) => j.status === "completed").reduce((s, j) => s + (j.price ?? 0), 0);
            return (
              <motion.li key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-semibold uppercase text-white">{c.name.slice(0, 2)}</span>
                <div className="min-w-0 flex-1">
                  <Link href={routes.serviceCustomer(c.id)} className="flex items-center gap-2 text-[13.5px] font-medium hover:text-accent">
                    {c.name}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STAGE_TONE[c.stage])}>{c.stage}</span>
                  </Link>
                  <p className="truncate text-[12px] text-muted-foreground">{[c.company, c.phone, c.address].filter(Boolean).join(" · ") || "No details yet"}</p>
                </div>
                <div className="text-right text-[12px] tabular-nums text-muted-foreground">
                  <p className="font-medium text-foreground">{cj.length} job{cj.length === 1 ? "" : "s"}</p>
                  <p>{lifetime > 0 ? `${formatMoney(lifetime)} lifetime` : `since ${formatRelativeTime(c.createdAt)}`}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- detail */

export function CustomerDetail({ customer, properties, jobs, estimates, events, staff, catalog, canEdit }: { customer: ServiceCustomer; properties: ServiceProperty[]; jobs: ServiceJob[]; estimates: ServiceEstimate[]; events: ServiceEvent[]; staff: ServiceStaff[]; catalog: CatalogItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [booking, setBooking] = React.useState(false);
  const [kind, setKind] = React.useState<(typeof EVENT_KINDS)[number]>("note");
  const [body, setBody] = React.useState("");
  const [address, setAddress] = React.useState("");
  const lifetime = jobs.filter((j) => j.status === "completed").reduce((s, j) => s + (j.price ?? 0), 0);

  function log() {
    if (!body.trim()) return;
    startTransition(async () => {
      const r = await logEvent({ customerId: customer.id, kind, body });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't log it.");
      setBody("");
      router.refresh();
    });
  }

  function setStage(stage: string) {
    startTransition(async () => {
      const r = await editCustomer(customer.id, { stage });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't update.");
      router.refresh();
    });
  }

  function addSite(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    startTransition(async () => {
      const r = await addProperty({ customerId: customer.id, address, label: "Site" });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't add the address.");
      setAddress("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <Card padding="md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-muted-foreground">{customer.company ? <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {customer.company}</span> : "Individual"}{customer.source ? ` · via ${customer.source}` : ""}</p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {customer.phone && <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><a href={`tel:${customer.phone}`} className="hover:text-accent">{customer.phone}</a></li>}
                {customer.email && <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><a href={`mailto:${customer.email}`} className="hover:text-accent">{customer.email}</a></li>}
                {properties.map((p) => <li key={p.id} className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{p.label}: {p.address}</li>)}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <NativeSelect value={customer.stage} disabled={pending} onChange={(e) => setStage(e.target.value)} className="h-8 w-32 text-[12.5px]"><option value="lead">Lead</option><option value="customer">Customer</option><option value="inactive">Inactive</option></NativeSelect>
              ) : (
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STAGE_TONE[customer.stage])}>{customer.stage}</span>
              )}
              {canEdit && <Button variant="primary" size="sm" onClick={() => setBooking(true)}><Plus /> Book job</Button>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border p-2"><p className="text-[18px] font-bold leading-none tabular-nums">{jobs.length}</p><p className="mt-1 text-[11px] text-muted-foreground">Jobs</p></div>
            <div className="rounded-xl border border-border p-2"><p className="text-[18px] font-bold leading-none tabular-nums">{formatMoney(lifetime)}</p><p className="mt-1 text-[11px] text-muted-foreground">Lifetime</p></div>
            <div className="rounded-xl border border-border p-2"><p className="text-[18px] font-bold leading-none tabular-nums">{estimates.filter((e) => e.status === "sent").length}</p><p className="mt-1 text-[11px] text-muted-foreground">Open estimates</p></div>
          </div>
          {canEdit && (
            <form onSubmit={addSite} className="mt-3 flex gap-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Add another service address" className="h-8 text-[12.5px]" />
              <Button type="submit" size="sm" variant="secondary" disabled={!address.trim()} loading={pending}>Add</Button>
            </form>
          )}
          {customer.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-[12.5px] text-muted-foreground">{customer.notes}</p>}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-3"><p className="text-[13px] font-semibold">Service history</p><Link href={routes.servicesSchedule} className="text-[12px] font-medium text-accent">Schedule →</Link></div>
          <ul className="divide-y divide-border">
            {jobs.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-muted-foreground">No jobs yet.</li>}
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={routes.serviceJob(j.id)} className="block truncate text-[13.5px] font-medium hover:text-accent">#{j.number} {j.title}</Link>
                  <p className="text-[12px] text-muted-foreground"><When start={j.scheduledStart} end={j.scheduledEnd} withDate /> · {staff.find((s) => s.id === j.staffId)?.name ?? "Unassigned"}</p>
                </div>
                {j.price !== null && <span className="text-[12.5px] tabular-nums">{formatMoney(j.price)}</span>}
                <StatusPill status={j.status} />
              </li>
            ))}
          </ul>
        </Card>

        {estimates.length > 0 && (
          <Card>
            <div className="border-b border-border px-5 py-3"><p className="text-[13px] font-semibold">Estimates</p></div>
            <ul className="divide-y divide-border">
              {estimates.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">#{e.number} {e.title}</span>
                  <span className="tabular-nums">{formatMoney(e.total)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold">{ESTIMATE_STATUS_LABEL[e.status]}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><p className="text-[13px] font-semibold">Timeline</p></div>
        {canEdit && (
          <div className="border-b border-border p-3">
            <div className="flex gap-2">
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as (typeof EVENT_KINDS)[number])} className="h-9 w-32" aria-label="Kind">
                {EVENT_KINDS.filter((k) => k !== "status").map((k) => <option key={k} value={k}>{EVENT_KIND_LABEL[k]}</option>)}
              </NativeSelect>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder="What happened? Called, no answer. Texted the estimate…" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") log(); }} />
              <Button size="sm" variant="primary" onClick={log} loading={pending} disabled={!body.trim()}>Log</Button>
            </div>
          </div>
        )}
        <ol className="max-h-[640px] divide-y divide-border overflow-y-auto">
          {events.length === 0 && <li className="px-5 py-6 text-center text-[13px] text-muted-foreground">Nothing logged yet.</li>}
          {events.map((ev) => (
            <li key={ev.id} className="flex gap-3 px-5 py-3">
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", ev.kind === "status" ? "bg-muted text-muted-foreground" : "bg-accent/10 text-accent")}>
                {ev.kind === "call" ? <Phone className="h-3 w-3" /> : ev.kind === "email" ? <Mail className="h-3 w-3" /> : ev.kind === "note" ? <StickyNote className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[13px]">{ev.body}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{EVENT_KIND_LABEL[ev.kind]} · {formatRelativeTime(ev.createdAt)}{ev.createdBy ? ` · ${ev.createdBy.split("@")[0]}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <NewJobDialog open={booking} onOpenChange={setBooking} customers={[customer]} staff={staff} catalog={catalog} customerId={customer.id} />
    </div>
  );
}
