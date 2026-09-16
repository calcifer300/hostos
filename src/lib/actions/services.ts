"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, canManageSettings, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { logActivity } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { createTask } from "@/lib/tasks/queries";
import { insertChecklist } from "@/lib/local/queries";
import { industryById, SHARED_SOPS } from "@/lib/services/industries";
import { asCustomerStage } from "@/lib/services/types";
import { asEstimateStatus, asEventKind, asJobKind, asJobPriority, asJobStatus, asStaffRole, estimateTotals, JOB_STATUS_LABEL, type JobPhoto, type LineItem, type Material } from "@/lib/services/analytics";
import { getCustomer, getEstimate, getJob, getJobs, getProperties, getStaff, insertCustomer, insertDocs, insertEstimate, insertEvent, insertJob, insertProperty, insertStaff, updateCustomer, updateDoc, deleteDoc, updateEstimate, updateJob, updateStaff, upsertServiceSettings, type JobPatch } from "@/lib/services/queries";
import { routes } from "@/lib/routes";

/**
 * Every write in the Service Businesses vertical. { ok, error? }, never
 * throws, permission-checked on the server. Status changes and assignments
 * also land on the customer's timeline, so the contact history is complete
 * without anyone having to remember to write it.
 */

export interface ServiceActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet. Reload and try again." };
  if (!(await canEditCurrentFleet())) return { error: "You have read-only access to this workspace." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => str(v, max) || null;
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isoOrNull = (v: unknown): string | null => {
  const s = str(v, 40);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const hint = (error: string) => (/relation|does not exist|service_/i.test(error) ? "Run migration 0027 to enable the Service Businesses vertical." : error);

function revalidateServices() {
  revalidatePath(routes.services);
  revalidatePath(routes.servicesDispatch);
  revalidatePath(routes.servicesSchedule);
  revalidatePath(routes.servicesCustomers);
  revalidatePath(routes.servicesEstimates);
  revalidatePath(routes.servicesKnowledge);
  revalidatePath(routes.overview);
}

/* -------------------------------------------------------------- setup */

/**
 * Applies an industry template: the catalogue into settings, the shared and
 * industry SOPs into the knowledge center, the job checklist as a routine.
 * Re-running with a different industry replaces the catalogue and adds the
 * new industry's SOPs; nothing is deleted.
 */
export async function setupServices(input: { industry: string; businessName?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await canManageSettings())) return { ok: false, error: "Only an owner, admin or manager can set up the vertical." };
  const template = industryById(str(input.industry, 60));
  if (!template) return { ok: false, error: "Pick an industry from the list." };

  const saved = await upsertServiceSettings(g.hostId, { industry: template.id, businessName: opt(input.businessName, 120), catalog: template.catalog });
  if (!saved.ok) return { ok: false, error: hint(saved.error) };

  const docs = [...SHARED_SOPS, ...template.sops].map((s, i) => ({ kind: s.kind, title: s.title, body: s.steps.map((step, n) => `${n + 1}. ${step}`).join("\n"), position: i }));
  const seeded = await insertDocs(g.hostId, docs, g.email);
  if (!seeded.ok) return { ok: false, error: hint(seeded.error) };
  await insertChecklist(g.hostId, { module: "services", locationId: null, title: `${template.label} — every job`, kind: "job", items: template.jobChecklist.map((text) => ({ text, done: false })), createdBy: g.email });

  await logActivity({ hostId: g.hostId, module: "services", event: "services.setup", description: `Set up as ${template.label}`, actorEmail: g.email, href: routes.services });
  revalidateServices();
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- CRM */

export async function createCustomer(input: { name: string; company?: string; email?: string; phone?: string; address?: string; stage?: string; source?: string; notes?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: "Give the customer a name." };
  const outcome = await insertCustomer(g.hostId, { name, company: opt(input.company, 120), email: opt(input.email, 160), phone: opt(input.phone, 40), address: opt(input.address, 240), stage: asCustomerStage(input.stage), source: opt(input.source, 40), tags: [], notes: opt(input.notes, 2000), createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  const address = opt(input.address, 240);
  if (address) await insertProperty(g.hostId, { customerId: outcome.id, label: "Home", address, notes: null });
  await insertEvent(g.hostId, { customerId: outcome.id, jobId: null, kind: "status", body: `Added as ${asCustomerStage(input.stage)}${input.source ? ` from ${str(input.source, 40)}` : ""}`, createdBy: g.email });
  await logActivity({ hostId: g.hostId, module: "services", event: "customer.created", description: `${name} added`, actorEmail: g.email, href: routes.serviceCustomer(outcome.id) });
  revalidateServices();
  return { ok: true, id: outcome.id };
}

export async function editCustomer(id: string, patch: { name?: string; company?: string; email?: string; phone?: string; address?: string; stage?: string; source?: string; notes?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const customerId = str(id, 40);
  const current = await getCustomer(g.hostId, customerId);
  if (!current) return { ok: false, error: "That customer isn't on file." };
  const next: Parameters<typeof updateCustomer>[2] = {};
  if (patch.name !== undefined) next.name = str(patch.name, 120) || current.name;
  if (patch.company !== undefined) next.company = opt(patch.company, 120);
  if (patch.email !== undefined) next.email = opt(patch.email, 160);
  if (patch.phone !== undefined) next.phone = opt(patch.phone, 40);
  if (patch.address !== undefined) next.address = opt(patch.address, 240);
  if (patch.stage !== undefined) next.stage = asCustomerStage(patch.stage);
  if (patch.source !== undefined) next.source = opt(patch.source, 40);
  if (patch.notes !== undefined) next.notes = opt(patch.notes, 4000);
  const outcome = await updateCustomer(g.hostId, customerId, next);
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  if (next.stage && next.stage !== current.stage) await insertEvent(g.hostId, { customerId, jobId: null, kind: "status", body: `Now a ${next.stage}`, createdBy: g.email });
  revalidateServices();
  revalidatePath(routes.serviceCustomer(customerId));
  return { ok: true };
}

export async function addProperty(input: { customerId: string; label?: string; address: string; notes?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const address = str(input.address, 240);
  if (!address) return { ok: false, error: "Enter the address." };
  const outcome = await insertProperty(g.hostId, { customerId: str(input.customerId, 40), label: str(input.label, 40) || "Site", address, notes: opt(input.notes, 1000) });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  revalidatePath(routes.serviceCustomer(str(input.customerId, 40)));
  return { ok: true, id: outcome.id };
}

export async function logEvent(input: { customerId?: string | null; jobId?: string | null; kind: string; body: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const body = str(input.body, 4000);
  if (!body) return { ok: false, error: "Write what happened." };
  const customerId = opt(input.customerId, 40);
  const jobId = opt(input.jobId, 40);
  if (!customerId && !jobId) return { ok: false, error: "A note belongs to a customer or a job." };
  const outcome = await insertEvent(g.hostId, { customerId, jobId, kind: asEventKind(input.kind), body, createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  if (customerId) revalidatePath(routes.serviceCustomer(customerId));
  if (jobId) revalidatePath(routes.serviceJob(jobId));
  return { ok: true, id: outcome.id };
}

/* -------------------------------------------------------------- staff */

export async function addStaff(input: { name: string; role?: string; email?: string; phone?: string; skills?: string[]; color?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: "Give them a name." };
  const skills = Array.isArray(input.skills) ? input.skills.map((s) => str(s, 40)).filter(Boolean).slice(0, 20) : [];
  const outcome = await insertStaff(g.hostId, { name, role: asStaffRole(input.role), email: opt(input.email, 160), phone: opt(input.phone, 40), skills, color: opt(input.color, 20), active: true });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  revalidateServices();
  return { ok: true, id: outcome.id };
}

export async function setStaffActive(id: string, active: boolean): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const outcome = await updateStaff(g.hostId, str(id, 40), { active: Boolean(active) });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  revalidateServices();
  return { ok: true };
}

/* --------------------------------------------------------------- jobs */

export async function createJob(input: { customerId?: string | null; propertyId?: string | null; staffId?: string | null; kind?: string; title: string; description?: string; priority?: string; scheduledStart?: string; durationMin?: number; address?: string; price?: number | string; recurrence?: string; notes?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const title = str(input.title, 160);
  if (!title) return { ok: false, error: "Give the job a title." };
  const start = isoOrNull(input.scheduledStart);
  const duration = Math.max(15, Math.min(24 * 60, Number(input.durationMin) || 90));
  const end = start ? new Date(Date.parse(start) + duration * 60_000).toISOString() : null;
  const staffId = opt(input.staffId, 40);
  const outcome = await insertJob(g.hostId, {
    customerId: opt(input.customerId, 40),
    propertyId: opt(input.propertyId, 40),
    staffId,
    kind: asJobKind(input.kind),
    title,
    description: opt(input.description, 4000),
    status: staffId ? "assigned" : "pending",
    priority: asJobPriority(input.priority),
    scheduledStart: start,
    scheduledEnd: end,
    address: opt(input.address, 240),
    price: numOrNull(input.price),
    recurrence: opt(input.recurrence, 20),
    notes: opt(input.notes, 4000),
    createdBy: g.email,
  });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  const customerId = opt(input.customerId, 40);
  if (customerId) await insertEvent(g.hostId, { customerId, jobId: outcome.id, kind: "status", body: `${title} booked${start ? ` for ${new Date(start).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}`, createdBy: g.email });
  await logActivity({ hostId: g.hostId, module: "services", event: "job.created", description: `${title} created`, actorEmail: g.email, href: routes.serviceJob(outcome.id) });
  revalidateServices();
  return { ok: true, id: outcome.id };
}

/**
 * The one write behind the dispatch board, the calendar and the job card:
 * move, assign, reschedule, log work, sign off. Status transitions keep
 * their timestamps honest (started_at, completed_at) and the timeline
 * records every change of status or technician.
 */
export async function editJob(id: string, patch: { staffId?: string | null; status?: string; priority?: string; kind?: string; title?: string; description?: string; scheduledStart?: string | null; scheduledEnd?: string | null; address?: string; price?: number | string | null; laborHours?: number | string | null; materials?: Material[]; photos?: JobPhoto[]; signatureName?: string | null; recurrence?: string | null; notes?: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const jobId = str(id, 40);
  const job = await getJob(g.hostId, jobId);
  if (!job) return { ok: false, error: "That job isn't on file." };

  const next: JobPatch = {};
  const now = new Date().toISOString();
  if (patch.staffId !== undefined) next.staffId = opt(patch.staffId, 40);
  if (patch.status !== undefined) {
    const status = asJobStatus(patch.status);
    next.status = status;
    if (status === "in_progress" && !job.startedAt) next.startedAt = now;
    if (status === "completed") next.completedAt = job.completedAt ?? now;
    if (status !== "completed") next.completedAt = null;
  }
  // Assigning a pending job makes it assigned; unassigning an assigned one makes it pending.
  const staffAfter = next.staffId !== undefined ? next.staffId : job.staffId;
  const statusAfter = next.status ?? job.status;
  if (statusAfter === "pending" && staffAfter) next.status = "assigned";
  if (statusAfter === "assigned" && !staffAfter) next.status = "pending";
  if (patch.priority !== undefined) next.priority = asJobPriority(patch.priority);
  if (patch.kind !== undefined) next.kind = asJobKind(patch.kind);
  if (patch.title !== undefined) next.title = str(patch.title, 160) || job.title;
  if (patch.description !== undefined) next.description = opt(patch.description, 4000);
  if (patch.scheduledStart !== undefined) next.scheduledStart = isoOrNull(patch.scheduledStart);
  if (patch.scheduledEnd !== undefined) next.scheduledEnd = isoOrNull(patch.scheduledEnd);
  if (next.scheduledStart && next.scheduledEnd === undefined && job.scheduledStart && job.scheduledEnd) {
    // Moving the start keeps the duration.
    next.scheduledEnd = new Date(Date.parse(next.scheduledStart) + (Date.parse(job.scheduledEnd) - Date.parse(job.scheduledStart))).toISOString();
  }
  if (patch.address !== undefined) next.address = opt(patch.address, 240);
  if (patch.price !== undefined) next.price = numOrNull(patch.price);
  if (patch.laborHours !== undefined) next.laborHours = numOrNull(patch.laborHours);
  if (patch.materials !== undefined) next.materials = (Array.isArray(patch.materials) ? patch.materials : []).map((m) => ({ name: str(m?.name, 120), quantity: Number(m?.quantity) || 1, cost: Number(m?.cost) || 0 })).filter((m) => m.name).slice(0, 100);
  if (patch.photos !== undefined) next.photos = (Array.isArray(patch.photos) ? patch.photos : []).map((p) => ({ url: str(p?.url, 1000), caption: opt(p?.caption, 200), phase: p?.phase === "before" || p?.phase === "after" ? p.phase : ("other" as const) })).filter((p) => /^https?:\/\//.test(p.url)).slice(0, 60);
  if (patch.signatureName !== undefined) {
    next.signatureName = opt(patch.signatureName, 120);
    next.signedAt = next.signatureName ? now : null;
  }
  if (patch.recurrence !== undefined) next.recurrence = opt(patch.recurrence, 20);
  if (patch.notes !== undefined) next.notes = opt(patch.notes, 4000);

  const outcome = await updateJob(g.hostId, jobId, next);
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };

  const staff = await getStaff(g.hostId);
  const nameOf = (sid: string | null) => staff.find((s) => s.id === sid)?.name ?? "nobody";
  const changes: string[] = [];
  if (next.status && next.status !== job.status) changes.push(JOB_STATUS_LABEL[next.status]);
  if (next.staffId !== undefined && next.staffId !== job.staffId) changes.push(`assigned to ${nameOf(next.staffId)}`);
  if (next.scheduledStart && next.scheduledStart !== job.scheduledStart) changes.push(`rescheduled to ${new Date(next.scheduledStart).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);
  if (changes.length > 0) {
    await insertEvent(g.hostId, { customerId: job.customerId, jobId, kind: "status", body: `${job.title}: ${changes.join(", ")}`, createdBy: g.email });
    await logActivity({ hostId: g.hostId, module: "services", event: "job.updated", description: `${job.title} — ${changes.join(", ")}`, actorEmail: g.email, href: routes.serviceJob(jobId) });
  }
  if (next.status === "completed" && job.status !== "completed") {
    // The review request is the last step of every job loop — file it so it isn't forgotten.
    await createTask({ hostId: g.hostId, title: `Request a review — ${job.title}`, description: "Text or email the customer a review link within 24 hours of completion.", priority: "low", dueAt: new Date(Date.now() + 86_400_000).toISOString(), source: "butler", relatedKind: "service_job", relatedId: jobId, href: routes.serviceJob(jobId), dedupeKey: `services:review:${jobId}` });
    if (job.recurrence) {
      // Recurring service: book the next visit on the same terms — once. A job
      // reopened and completed again must not book a second follow-on visit.
      const step = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 91 }[job.recurrence] ?? 0;
      const nextStart = step && job.scheduledStart ? new Date(Date.parse(job.scheduledStart) + step * 86_400_000).toISOString() : null;
      const alreadyBooked = nextStart ? (await getJobs(g.hostId)).some((j) => j.customerId === job.customerId && j.title === job.title && j.scheduledStart === nextStart) : true;
      if (step && job.scheduledStart && nextStart && !alreadyBooked) {
        const nextEnd = job.scheduledEnd ? new Date(Date.parse(job.scheduledEnd) + step * 86_400_000).toISOString() : null;
        await insertJob(g.hostId, { customerId: job.customerId, propertyId: job.propertyId, staffId: job.staffId, kind: job.kind, title: job.title, description: job.description, status: job.staffId ? "assigned" : "pending", priority: job.priority, scheduledStart: nextStart, scheduledEnd: nextEnd, address: job.address, price: job.price, recurrence: job.recurrence, notes: job.notes, createdBy: g.email });
      }
    }
  }
  revalidateServices();
  revalidatePath(routes.serviceJob(jobId));
  if (job.customerId) revalidatePath(routes.serviceCustomer(job.customerId));
  return { ok: true };
}

/* ---------------------------------------------------------- estimates */

export async function createEstimate(input: { customerId?: string | null; propertyId?: string | null; title: string; lineItems: LineItem[]; taxRate?: number | string; notes?: string; send?: boolean; validDays?: number }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const title = str(input.title, 160);
  if (!title) return { ok: false, error: "Give the estimate a title." };
  const lineItems = (Array.isArray(input.lineItems) ? input.lineItems : []).map((i) => ({ name: str(i?.name, 160), quantity: Number(i?.quantity) || 1, unitPrice: Number(i?.unitPrice) || 0 })).filter((i) => i.name).slice(0, 60);
  if (lineItems.length === 0) return { ok: false, error: "Add at least one line item." };
  const taxRate = Math.max(0, Math.min(50, Number(input.taxRate) || 0));
  const totals = estimateTotals(lineItems, taxRate);
  const send = Boolean(input.send);
  const validDays = Math.max(1, Math.min(90, Number(input.validDays) || 14));
  const outcome = await insertEstimate(g.hostId, { customerId: opt(input.customerId, 40), propertyId: opt(input.propertyId, 40), title, lineItems, subtotal: totals.subtotal, taxRate, total: totals.total, status: send ? "sent" : "draft", sentAt: send ? new Date().toISOString() : null, expiresAt: send ? new Date(Date.now() + validDays * 86_400_000).toISOString() : null, notes: opt(input.notes, 4000), createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  const customerId = opt(input.customerId, 40);
  if (customerId) await insertEvent(g.hostId, { customerId, jobId: null, kind: "status", body: `Estimate "${title}" ${send ? "sent" : "drafted"} — $${totals.total.toFixed(2)}`, createdBy: g.email });
  await logActivity({ hostId: g.hostId, module: "services", event: "estimate.created", description: `${title} — $${totals.total.toFixed(2)}${send ? " (sent)" : ""}`, actorEmail: g.email, href: routes.servicesEstimates });
  revalidateServices();
  return { ok: true, id: outcome.id };
}

/**
 * Sent, accepted, declined, expired. Accepting converts to a work order in
 * the same click: a pending job carrying the estimate's price, ready for
 * dispatch — the "one click" from the brief.
 */
export async function setEstimateStatus(id: string, status: string): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const estimateId = str(id, 40);
  const estimate = await getEstimate(g.hostId, estimateId);
  if (!estimate) return { ok: false, error: "That estimate isn't on file." };
  const next = asEstimateStatus(status);
  const now = new Date().toISOString();
  const patch: Parameters<typeof updateEstimate>[2] = { status: next };
  if (next === "sent") {
    patch.sentAt = estimate.sentAt ?? now;
    patch.expiresAt = estimate.expiresAt ?? new Date(Date.now() + 14 * 86_400_000).toISOString();
  }
  if (next === "accepted" || next === "declined" || next === "expired") patch.decidedAt = now;

  let jobId: string | undefined;
  if (next === "accepted" && !estimate.jobId) {
    // The work order goes where the customer is: the estimate's property, else the customer's address.
    const customer = estimate.customerId ? await getCustomer(g.hostId, estimate.customerId) : null;
    const property = estimate.propertyId ? (await getProperties(g.hostId, estimate.customerId ?? undefined)).find((p) => p.id === estimate.propertyId) : null;
    const address = property?.address ?? customer?.address ?? null;
    const job = await insertJob(g.hostId, { customerId: estimate.customerId, propertyId: estimate.propertyId, staffId: null, estimateId, kind: "job", title: estimate.title, description: estimate.lineItems.map((i) => `${i.quantity} × ${i.name}`).join("\n"), status: "pending", priority: "normal", scheduledStart: null, scheduledEnd: null, address, price: estimate.total, recurrence: null, notes: estimate.notes, createdBy: g.email });
    if (!job.ok) return { ok: false, error: hint(job.error) };
    jobId = job.id;
    patch.jobId = job.id;
    if (estimate.customerId) await updateCustomer(g.hostId, estimate.customerId, { stage: "customer" });
    await notify({ hostId: g.hostId, kind: "system", severity: "info", title: `Estimate accepted — ${estimate.title}`, body: `A work order is waiting for a technician and a time.`, href: routes.serviceJob(job.id), dedupeKey: `services:accepted:${estimateId}` });
    await createTask({ hostId: g.hostId, title: `Schedule and dispatch — ${estimate.title}`, description: "The estimate was accepted. Pick a technician and a time on the dispatch board.", priority: "high", source: "butler", relatedKind: "service_job", relatedId: job.id, href: routes.serviceJob(job.id), dedupeKey: `services:dispatch:${job.id}` });
  }
  const outcome = await updateEstimate(g.hostId, estimateId, patch);
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  if (estimate.customerId) await insertEvent(g.hostId, { customerId: estimate.customerId, jobId: jobId ?? null, kind: "status", body: `Estimate "${estimate.title}" ${next}${jobId ? " — work order created" : ""}`, createdBy: g.email });
  await logActivity({ hostId: g.hostId, module: "services", event: "estimate.status", description: `${estimate.title} ${next}`, actorEmail: g.email, href: jobId ? routes.serviceJob(jobId) : routes.servicesEstimates });
  revalidateServices();
  return { ok: true, id: jobId };
}

/* --------------------------------------------------------------- docs */

export async function saveDoc(input: { id?: string | null; kind?: string; title: string; body: string }): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const title = str(input.title, 160);
  if (!title) return { ok: false, error: "Give it a title." };
  const kind = (["sop", "policy", "guide", "faq", "handbook", "training"] as const).find((k) => k === input.kind) ?? "sop";
  const body = str(input.body, 20000);
  const id = opt(input.id, 40);
  const outcome = id ? await updateDoc(g.hostId, id, { title, body, kind }) : await insertDocs(g.hostId, [{ kind, title, body, position: Date.now() % 100000 }], g.email);
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  revalidatePath(routes.servicesKnowledge);
  return { ok: true };
}

export async function removeDoc(id: string): Promise<ServiceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const outcome = await deleteDoc(g.hostId, str(id, 40));
  if (!outcome.ok) return { ok: false, error: hint(outcome.error) };
  revalidatePath(routes.servicesKnowledge);
  return { ok: true };
}
