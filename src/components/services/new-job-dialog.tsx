"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createJob } from "@/lib/actions/services";
import { JOB_KINDS, JOB_KIND_LABEL, JOB_PRIORITIES } from "@/lib/services/analytics";
import type { CatalogItem } from "@/lib/services/industries";
import type { ServiceCustomer, ServiceStaff } from "@/lib/services/types";

/** Local-time value for <input type="datetime-local">: the next whole hour. */
function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Books a visit. Picking a catalogue service fills the title, price and
 * duration; a customer's address fills the site. Used from the dispatch
 * board, the schedule and the customer page.
 */
export function NewJobDialog({ open, onOpenChange, customers, staff, catalog = [], customerId: presetCustomer = null, defaultStart }: { open: boolean; onOpenChange: (open: boolean) => void; customers: ServiceCustomer[]; staff: ServiceStaff[]; catalog?: CatalogItem[]; customerId?: string | null; defaultStart?: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [duration, setDuration] = React.useState("90");
  const [customerId, setCustomerId] = React.useState(presetCustomer ?? "");
  const [address, setAddress] = React.useState("");
  const techs = staff.filter((s) => s.active && s.role === "technician");

  function pickService(name: string) {
    const item = catalog.find((c) => c.name === name);
    if (!item) return;
    setTitle(item.name);
    setPrice(item.price > 0 ? String(item.price) : "");
    setDuration(String(item.durationMin || 90));
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c?.address && !address) setAddress(c.address);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createJob({
        customerId: customerId || null,
        staffId: String(fd.get("staffId") ?? "") || null,
        kind: String(fd.get("kind") ?? "job"),
        title,
        description: String(fd.get("description") ?? ""),
        priority: String(fd.get("priority") ?? "normal"),
        scheduledStart: String(fd.get("scheduledStart") ?? ""),
        durationMin: Number(duration) || 90,
        address,
        price,
        recurrence: String(fd.get("recurrence") ?? "") || undefined,
      });
      if (!r.ok) return void toast.error(r.error ?? "Couldn't create the job.");
      toast.success("Job booked");
      onOpenChange(false);
      setTitle("");
      setPrice("");
      setAddress("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New job</DialogTitle>
            <DialogDescription>A visit on the calendar and a card on the dispatch board. Assign a technician now or leave it pending.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {catalog.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="j-service">Service (from your catalogue)</Label>
                <NativeSelect id="j-service" defaultValue="" onChange={(e) => pickService(e.target.value)}>
                  <option value="">Choose a service…</option>
                  {catalog.map((c) => <option key={c.name} value={c.name}>{c.name}{c.price > 0 ? ` — $${c.price}` : ""} · {c.durationMin}m</option>)}
                </NativeSelect>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="j-title">Title</Label><Input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Windshield replacement — 2019 Camry" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="j-customer">Customer</Label>
              <NativeSelect id="j-customer" value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                <option value="">No customer yet</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="j-address">Site address</Label><Input id="j-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" /></div>
            <div className="space-y-1.5"><Label htmlFor="j-start">Scheduled start</Label><Input id="j-start" name="scheduledStart" type="datetime-local" defaultValue={defaultStart ?? nextHourLocal()} /></div>
            <div className="space-y-1.5"><Label htmlFor="j-duration">Duration (minutes)</Label><Input id="j-duration" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="j-staff">Technician</Label>
              <NativeSelect id="j-staff" name="staffId" defaultValue="">
                <option value="">Unassigned (pending)</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="j-price">Price</Label><Input id="j-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="j-kind">Kind</Label>
              <NativeSelect id="j-kind" name="kind" defaultValue="job">{JOB_KINDS.map((k) => <option key={k} value={k}>{JOB_KIND_LABEL[k]}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-priority">Priority</Label>
              <NativeSelect id="j-priority" name="priority" defaultValue="normal">{JOB_PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-recurrence">Repeats</Label>
              <NativeSelect id="j-recurrence" name="recurrence" defaultValue="">
                <option value="">One-off</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="j-desc">Notes for the technician</Label><Textarea id="j-desc" name="description" rows={2} placeholder="Gate code, parking, what the customer said…" /></div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>Book job</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
