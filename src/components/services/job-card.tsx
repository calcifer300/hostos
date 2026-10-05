"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Camera, CheckCircle2, ClipboardList, MapPin, PenLine, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { editJob, logEvent } from "@/lib/actions/services";
import { JOB_KINDS, JOB_KIND_LABEL, JOB_PRIORITIES, JOB_STATUSES, JOB_STATUS_LABEL, type JobPhoto, type JobStatus, type Material } from "@/lib/services/analytics";
import type { ServiceCustomer, ServiceEvent, ServiceJob, ServiceStaff } from "@/lib/services/types";
import type { Checklist } from "@/lib/local/queries";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatMoney } from "@/lib/restaurants/analytics";
import { NextStepButton, StatusPill, When } from "@/components/services/service-widgets";
import { useMounted } from "@/lib/hooks/use-client-value";

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * The work order: everything the brief lists on one screen — customer,
 * address, technician, status, schedule, notes, materials, labor, photos,
 * signature, price — each editable in place. The technician's checklist
 * comes from the industry template.
 */
export function JobCard({ job, customer, staff, events, checklist, canEdit }: { job: ServiceJob; customer: ServiceCustomer | null; staff: ServiceStaff[]; events: ServiceEvent[]; checklist: Checklist | null; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [materials, setMaterials] = React.useState<Material[]>(job.materials);
  const [photos, setPhotos] = React.useState<JobPhoto[]>(job.photos);
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [photoPhase, setPhotoPhase] = React.useState<JobPhoto["phase"]>("before");
  const [signature, setSignature] = React.useState(job.signatureName ?? "");
  const [note, setNote] = React.useState("");
  const [ticked, setTicked] = React.useState<Set<number>>(new Set());
  const techs = staff.filter((s) => s.active && s.role === "technician");
  // The details form defaults its datetime-local inputs in the reader's timezone.
  const mounted = useMounted();

  function save(patch: Parameters<typeof editJob>[1], message = "Saved") {
    startTransition(async () => {
      const r = await editJob(job.id, patch);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success(message);
      router.refresh();
    });
  }

  function saveField(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    save({ title: String(fd.get("title") ?? ""), kind: String(fd.get("kind") ?? ""), priority: String(fd.get("priority") ?? ""), staffId: String(fd.get("staffId") ?? "") || null, scheduledStart: String(fd.get("scheduledStart") ?? "") || null, scheduledEnd: String(fd.get("scheduledEnd") ?? "") || null, address: String(fd.get("address") ?? ""), price: String(fd.get("price") ?? "") || null, laborHours: String(fd.get("laborHours") ?? "") || null, description: String(fd.get("description") ?? ""), notes: String(fd.get("notes") ?? "") });
  }

  function addPhoto() {
    if (!/^https?:\/\//.test(photoUrl.trim())) return void toast.error("Paste a photo link (https://…). Upload from the phone lands here in a later release.");
    const next = [...photos, { url: photoUrl.trim(), caption: null, phase: photoPhase }];
    setPhotos(next);
    setPhotoUrl("");
    save({ photos: next }, "Photo added");
  }

  function addNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      const r = await logEvent({ jobId: job.id, customerId: job.customerId, kind: "note", body: note });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't log.");
      setNote("");
      router.refresh();
    });
  }

  const items = checklist?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <Card padding="md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusPill status={job.status} />
              <span className="text-[12px] text-muted-foreground">{JOB_KIND_LABEL[job.kind]} · <When start={job.scheduledStart} end={job.scheduledEnd} withDate /></span>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <NativeSelect value={job.status} disabled={pending} onChange={(e) => save({ status: e.target.value as JobStatus }, JOB_STATUS_LABEL[e.target.value as JobStatus])} className="h-8 w-36 text-[12.5px]" aria-label="Status">
                  {JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>)}
                </NativeSelect>
                <NextStepButton job={job} disabled={pending} />
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" />{customer ? <Link href={routes.serviceCustomer(customer.id)} className="font-medium hover:text-accent">{customer.name}</Link> : <span className="text-muted-foreground">No customer</span>}{customer?.phone && <a href={`tel:${customer.phone}`} className="text-muted-foreground hover:text-accent">{customer.phone}</a>}</p>
            <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{job.address ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" className="hover:text-accent">{job.address}</a> : <span className="text-muted-foreground">No address</span>}</p>
          </div>
          {job.description && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-[12.5px]">{job.description}</p>}
        </Card>

        {canEdit && mounted && (
          <Card padding="md">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><PenLine className="h-4 w-4 text-muted-foreground" /> Details</p>
            <form onSubmit={saveField} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-title">Title</Label><Input id="e-title" name="title" defaultValue={job.title} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-kind">Kind</Label><NativeSelect id="e-kind" name="kind" defaultValue={job.kind}>{JOB_KINDS.map((k) => <option key={k} value={k}>{JOB_KIND_LABEL[k]}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="e-priority">Priority</Label><NativeSelect id="e-priority" name="priority" defaultValue={job.priority}>{JOB_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="e-staff">Technician</Label><NativeSelect id="e-staff" name="staffId" defaultValue={job.staffId ?? ""}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="e-address">Address</Label><Input id="e-address" name="address" defaultValue={job.address ?? ""} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-start">Start</Label><Input id="e-start" name="scheduledStart" type="datetime-local" defaultValue={toLocal(job.scheduledStart)} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-end">End</Label><Input id="e-end" name="scheduledEnd" type="datetime-local" defaultValue={toLocal(job.scheduledEnd)} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-price">Price</Label><Input id="e-price" name="price" type="number" step="0.01" min={0} defaultValue={job.price ?? ""} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-labor">Labor hours</Label><Input id="e-labor" name="laborHours" type="number" step="0.25" min={0} defaultValue={job.laborHours ?? ""} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-desc">Scope / instructions</Label><Textarea id="e-desc" name="description" rows={2} defaultValue={job.description ?? ""} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-notes">Technician notes</Label><Textarea id="e-notes" name="notes" rows={2} defaultValue={job.notes ?? ""} placeholder="What was found, what was done, what to watch." /></div>
              <div className="sm:col-span-2"><Button type="submit" variant="primary" size="sm" loading={pending}>Save details</Button></div>
            </form>
          </Card>
        )}

        <Card padding="md">
          <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-[13px] font-semibold"><ClipboardList className="h-4 w-4 text-muted-foreground" /> Materials</p><span className="text-[12px] tabular-nums text-muted-foreground">{formatMoney(materials.reduce((s, m) => s + m.quantity * m.cost, 0))}</span></div>
          <ul className="space-y-1.5">
            {materials.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="tabular-nums text-muted-foreground">{m.quantity} × {formatMoney(m.cost)}</span>
                {canEdit && <button type="button" aria-label="Remove" className="rounded-md p-1 text-muted-foreground hover:bg-danger-bg hover:text-danger" onClick={() => { const next = materials.filter((_, k) => k !== i); setMaterials(next); save({ materials: next }, "Materials updated"); }}><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
            {materials.length === 0 && <li className="text-[12.5px] text-muted-foreground">Nothing logged.</li>}
          </ul>
          {canEdit && (
            <form className="mt-2 grid grid-cols-[1fr_70px_90px_auto] gap-1.5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const m = { name: String(fd.get("name") ?? "").trim(), quantity: Number(fd.get("quantity")) || 1, cost: Number(fd.get("cost")) || 0 }; if (!m.name) return; const next = [...materials, m]; setMaterials(next); save({ materials: next }, "Material added"); e.currentTarget.reset(); }}>
              <Input name="name" placeholder="Part or material" className="h-8 text-[12.5px]" />
              <Input name="quantity" type="number" min={1} defaultValue={1} className="h-8 text-[12.5px]" aria-label="Quantity" />
              <Input name="cost" type="number" min={0} step="0.01" placeholder="Cost" className="h-8 text-[12.5px]" aria-label="Unit cost" />
              <Button type="submit" size="sm" variant="secondary"><Plus /></Button>
            </form>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {items.length > 0 && (
          <Card padding="md">
            <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Job checklist <span className="text-[11px] font-normal text-muted-foreground">{ticked.size}/{items.length}</span></p>
            <ul className="space-y-1">
              {items.map((it, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-muted/60">
                    <input type="checkbox" checked={ticked.has(i)} onChange={() => setTicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="mt-0.5" />
                    <span className={cn(ticked.has(i) && "text-muted-foreground line-through")}>{it.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card padding="md">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Camera className="h-4 w-4 text-muted-foreground" /> Photos <span className="text-[11px] font-normal text-muted-foreground">{photos.filter((p) => p.phase === "before").length} before · {photos.filter((p) => p.phase === "after").length} after</span></p>
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence>
              {photos.map((p, i) => (
                <motion.a key={p.url + i} href={p.url} target="_blank" rel="noreferrer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? p.phase} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-px text-[10px] font-semibold uppercase text-white">{p.phase}</span>
                </motion.a>
              ))}
            </AnimatePresence>
          </div>
          {canEdit && (
            <div className="mt-2 flex gap-1.5">
              <NativeSelect value={photoPhase} onChange={(e) => setPhotoPhase(e.target.value as JobPhoto["phase"])} className="h-8 w-24 text-[12px]" aria-label="Phase"><option value="before">Before</option><option value="after">After</option><option value="other">Other</option></NativeSelect>
              <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo link (Google Photos, Drive, iCloud…)" className="h-8 text-[12.5px]" />
              <Button size="sm" variant="secondary" onClick={addPhoto} loading={pending}><Plus /></Button>
            </div>
          )}
        </Card>

        <Card padding="md">
          <p className="mb-2 text-[13px] font-semibold">Customer sign-off</p>
          {job.signedAt ? (
            <p className="text-[13px]">Signed by <span className="font-medium">{job.signatureName}</span> · {formatRelativeTime(job.signedAt)}</p>
          ) : canEdit ? (
            <div className="flex gap-1.5">
              <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Customer's full name" className="h-8 text-[12.5px]" />
              <Button size="sm" variant="primary" disabled={!signature.trim()} loading={pending} onClick={() => save({ signatureName: signature }, "Signed off")}>Sign</Button>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">Not signed yet.</p>
          )}
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 text-[13px] font-semibold">Job log</div>
          {canEdit && (
            <div className="flex gap-2 border-b border-border p-3">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} placeholder="Add a note…" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); }} />
              <Button size="sm" variant="secondary" onClick={addNote} disabled={!note.trim()} loading={pending}>Log</Button>
            </div>
          )}
          <ol className="max-h-80 divide-y divide-border overflow-y-auto">
            {events.length === 0 && <li className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">Nothing yet.</li>}
            {events.map((ev) => (
              <li key={ev.id} className="px-4 py-2.5">
                <p className="whitespace-pre-wrap text-[12.5px]">{ev.body}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelativeTime(ev.createdAt)}{ev.createdBy ? ` · ${ev.createdBy.split("@")[0]}` : ""}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
