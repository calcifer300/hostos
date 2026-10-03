import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";
import { asCustomerStage, type ServiceCustomer, type ServiceDoc, type ServiceEstimate, type ServiceEvent, type ServiceJob, type ServiceProperty, type ServiceSettings, type ServiceStaff } from "@/lib/services/types";
import { asEstimateStatus, asEventKind, asJobKind, asJobPriority, asJobStatus, asStaffRole, type JobPhoto, type LineItem, type Material } from "@/lib/services/analytics";
import type { CatalogItem } from "@/lib/services/industries";

/**
 * Reads and writes for the Service Businesses vertical (migration 0027).
 * Every read is total (empty before the migration, never a throw); every
 * write returns { ok } and lets the action decide what to tell the person.
 */

type Res = { ok: true; id: string } | { ok: false; error: string };
type Done = { ok: true } | { ok: false; error: string };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ------------------------------------------------------------- settings */

interface SettingsRow {
  host_id: string;
  industry: string;
  business_name: string | null;
  timezone: string;
  default_duration_min: number;
  service_catalog: unknown;
  updated_at: string;
}

export const getServiceSettings = cache(async function getServiceSettings(hostId: string): Promise<ServiceSettings | null> {
  const { data } = await runQueryOr<SettingsRow | null>("service_settings.get", null, (client) =>
    client.from("service_settings").select("host_id, industry, business_name, timezone, default_duration_min, service_catalog, updated_at").eq("host_id", hostId).maybeSingle<SettingsRow>()
  );
  if (!data) return null;
  return {
    industry: data.industry,
    businessName: data.business_name,
    timezone: data.timezone,
    defaultDurationMin: data.default_duration_min,
    catalog: arr<CatalogItem>(data.service_catalog).filter((c) => c && typeof c.name === "string").map((c) => ({ name: c.name, price: Number(c.price) || 0, durationMin: Number(c.durationMin) || 60 })),
    updatedAt: data.updated_at,
  };
});

export async function upsertServiceSettings(hostId: string, input: { industry: string; businessName: string | null; timezone?: string; defaultDurationMin?: number; catalog: CatalogItem[] }): Promise<Done> {
  const result = await runMutation("service_settings.upsert", (client) =>
    client.from("service_settings").upsert({ host_id: hostId, industry: input.industry, business_name: input.businessName, timezone: input.timezone ?? "America/Denver", default_duration_min: input.defaultDurationMin ?? 90, service_catalog: input.catalog }, { onConflict: "host_id" })
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* ---------------------------------------------------------------- CRM */

interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  stage: string;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
const CUSTOMER_COLUMNS = "id, name, company, email, phone, address, stage, source, tags, notes, created_at, updated_at";
const rowToCustomer = (r: CustomerRow): ServiceCustomer => ({ id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone, address: r.address, stage: asCustomerStage(r.stage), source: r.source, tags: r.tags ?? [], notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at });

export const getCustomers = cache(async function getCustomers(hostId: string): Promise<ServiceCustomer[]> {
  const { data } = await runQueryOr<CustomerRow[]>("service_customers.list", [], (client) =>
    client.from("service_customers").select(CUSTOMER_COLUMNS).eq("host_id", hostId).order("updated_at", { ascending: false }).limit(500).returns<CustomerRow[]>()
  );
  return data.map(rowToCustomer);
});

export const getCustomer = cache(async function getCustomer(hostId: string, id: string): Promise<ServiceCustomer | null> {
  const { data } = await runQueryOr<CustomerRow | null>("service_customers.get", null, (client) =>
    client.from("service_customers").select(CUSTOMER_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<CustomerRow>()
  );
  return data ? rowToCustomer(data) : null;
});

export async function insertCustomer(hostId: string, input: Omit<ServiceCustomer, "id" | "createdAt" | "updatedAt"> & { createdBy: string | null }): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_customers.insert", (client) =>
    client.from("service_customers").insert({ host_id: hostId, name: input.name, company: input.company, email: input.email, phone: input.phone, address: input.address, stage: input.stage, source: input.source, tags: input.tags, notes: input.notes, created_by: input.createdBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function updateCustomer(hostId: string, id: string, patch: Partial<Omit<ServiceCustomer, "id" | "createdAt" | "updatedAt">>): Promise<Done> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.company !== undefined) row.company = patch.company;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.tags !== undefined) row.tags = patch.tags;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const result = await runMutation("service_customers.update", (client) => client.from("service_customers").update(row).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

interface PropertyRow {
  id: string;
  customer_id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}
const rowToProperty = (r: PropertyRow): ServiceProperty => ({ id: r.id, customerId: r.customer_id, label: r.label, address: r.address, lat: r.lat, lng: r.lng, notes: r.notes });

export const getProperties = cache(async function getProperties(hostId: string, customerId?: string): Promise<ServiceProperty[]> {
  const { data } = await runQueryOr<PropertyRow[]>("service_properties.list", [], (client) => {
    let q = client.from("service_properties").select("id, customer_id, label, address, lat, lng, notes").eq("host_id", hostId);
    if (customerId) q = q.eq("customer_id", customerId);
    return q.order("created_at", { ascending: true }).limit(1000).returns<PropertyRow[]>();
  });
  return data.map(rowToProperty);
});

export async function insertProperty(hostId: string, input: { customerId: string; label: string; address: string; notes: string | null }): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_properties.insert", (client) =>
    client.from("service_properties").insert({ host_id: hostId, customer_id: input.customerId, label: input.label, address: input.address, notes: input.notes }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

/* -------------------------------------------------------------- staff */

interface StaffRow {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  skills: string[] | null;
  color: string | null;
  active: boolean;
}
const rowToStaff = (r: StaffRow): ServiceStaff => ({ id: r.id, name: r.name, role: asStaffRole(r.role), email: r.email, phone: r.phone, skills: r.skills ?? [], color: r.color, active: r.active });

export const getStaff = cache(async function getStaff(hostId: string): Promise<ServiceStaff[]> {
  const { data } = await runQueryOr<StaffRow[]>("service_staff.list", [], (client) =>
    client.from("service_staff").select("id, name, role, email, phone, skills, color, active").eq("host_id", hostId).order("active", { ascending: false }).order("name", { ascending: true }).limit(200).returns<StaffRow[]>()
  );
  return data.map(rowToStaff);
});

export async function insertStaff(hostId: string, input: Omit<ServiceStaff, "id">): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_staff.insert", (client) =>
    client.from("service_staff").insert({ host_id: hostId, name: input.name, role: input.role, email: input.email, phone: input.phone, skills: input.skills, color: input.color, active: input.active }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function updateStaff(hostId: string, id: string, patch: Partial<Omit<ServiceStaff, "id">>): Promise<Done> {
  const result = await runMutation("service_staff.update", (client) => client.from("service_staff").update(patch).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* --------------------------------------------------------------- jobs */

interface JobRow {
  id: string;
  number: number;
  customer_id: string | null;
  property_id: string | null;
  staff_id: string | null;
  estimate_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  address: string | null;
  price: number | string | null;
  labor_hours: number | string | null;
  materials: unknown;
  photos: unknown;
  signature_name: string | null;
  signed_at: string | null;
  recurrence: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
const JOB_COLUMNS = "id, number, customer_id, property_id, staff_id, estimate_id, kind, title, description, status, priority, scheduled_start, scheduled_end, started_at, completed_at, address, price, labor_hours, materials, photos, signature_name, signed_at, recurrence, notes, created_at, updated_at";
const rowToJob = (r: JobRow): ServiceJob => ({
  id: r.id,
  number: r.number,
  customerId: r.customer_id,
  propertyId: r.property_id,
  staffId: r.staff_id,
  estimateId: r.estimate_id,
  kind: asJobKind(r.kind),
  title: r.title,
  description: r.description,
  status: asJobStatus(r.status),
  priority: asJobPriority(r.priority),
  scheduledStart: r.scheduled_start,
  scheduledEnd: r.scheduled_end,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  address: r.address,
  price: num(r.price),
  laborHours: num(r.labor_hours),
  materials: arr<Material>(r.materials).filter((m) => m && typeof m.name === "string").map((m) => ({ name: m.name, quantity: Number(m.quantity) || 1, cost: Number(m.cost) || 0 })),
  photos: arr<JobPhoto>(r.photos).filter((p) => p && typeof p.url === "string").map((p) => ({ url: p.url, caption: p.caption ?? null, phase: p.phase === "before" || p.phase === "after" ? p.phase : "other" })),
  signatureName: r.signature_name,
  signedAt: r.signed_at,
  recurrence: r.recurrence,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Every open job plus the last 60 days of closed ones — enough for the board, the calendar and the month's numbers. */
export const getJobs = cache(async function getJobs(hostId: string): Promise<ServiceJob[]> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await runQueryOr<JobRow[]>("service_jobs.list", [], (client) =>
    client.from("service_jobs").select(JOB_COLUMNS).eq("host_id", hostId).or(`status.in.(pending,assigned,in_progress),updated_at.gte.${since}`).order("scheduled_start", { ascending: true, nullsFirst: false }).limit(1000).returns<JobRow[]>()
  );
  return data.map(rowToJob);
});

export const getJob = cache(async function getJob(hostId: string, id: string): Promise<ServiceJob | null> {
  const { data } = await runQueryOr<JobRow | null>("service_jobs.get", null, (client) => client.from("service_jobs").select(JOB_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<JobRow>());
  return data ? rowToJob(data) : null;
});

export const getJobsForCustomer = cache(async function getJobsForCustomer(hostId: string, customerId: string): Promise<ServiceJob[]> {
  const { data } = await runQueryOr<JobRow[]>("service_jobs.for_customer", [], (client) =>
    client.from("service_jobs").select(JOB_COLUMNS).eq("host_id", hostId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200).returns<JobRow[]>()
  );
  return data.map(rowToJob);
});

export interface NewJob {
  customerId: string | null;
  propertyId: string | null;
  staffId: string | null;
  estimateId?: string | null;
  kind: ServiceJob["kind"];
  title: string;
  description: string | null;
  status: ServiceJob["status"];
  priority: ServiceJob["priority"];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  price: number | null;
  recurrence: string | null;
  notes: string | null;
  createdBy: string | null;
}

export async function insertJob(hostId: string, input: NewJob): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_jobs.insert", (client) =>
    client
      .from("service_jobs")
      .insert({ host_id: hostId, customer_id: input.customerId, property_id: input.propertyId, staff_id: input.staffId, estimate_id: input.estimateId ?? null, kind: input.kind, title: input.title, description: input.description, status: input.status, priority: input.priority, scheduled_start: input.scheduledStart, scheduled_end: input.scheduledEnd, address: input.address, price: input.price, recurrence: input.recurrence, notes: input.notes, created_by: input.createdBy })
      .select("id")
      .single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export type JobPatch = Partial<{
  staffId: string | null;
  propertyId: string | null;
  kind: ServiceJob["kind"];
  title: string;
  description: string | null;
  status: ServiceJob["status"];
  priority: ServiceJob["priority"];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startedAt: string | null;
  completedAt: string | null;
  address: string | null;
  price: number | null;
  laborHours: number | null;
  materials: Material[];
  photos: JobPhoto[];
  signatureName: string | null;
  signedAt: string | null;
  recurrence: string | null;
  notes: string | null;
}>;

export async function updateJob(hostId: string, id: string, patch: JobPatch): Promise<Done> {
  const map: Record<keyof JobPatch, string> = { staffId: "staff_id", propertyId: "property_id", kind: "kind", title: "title", description: "description", status: "status", priority: "priority", scheduledStart: "scheduled_start", scheduledEnd: "scheduled_end", startedAt: "started_at", completedAt: "completed_at", address: "address", price: "price", laborHours: "labor_hours", materials: "materials", photos: "photos", signatureName: "signature_name", signedAt: "signed_at", recurrence: "recurrence", notes: "notes" };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof JobPatch)[]) if (patch[key] !== undefined) row[map[key]] = patch[key];
  if (Object.keys(row).length === 0) return { ok: true };
  const result = await runMutation("service_jobs.update", (client) => client.from("service_jobs").update(row).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* ---------------------------------------------------------- estimates */

interface EstimateRow {
  id: string;
  number: number;
  customer_id: string | null;
  property_id: string | null;
  job_id: string | null;
  title: string;
  line_items: unknown;
  subtotal: number | string;
  tax_rate: number | string;
  total: number | string;
  status: string;
  sent_at: string | null;
  expires_at: string | null;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
const ESTIMATE_COLUMNS = "id, number, customer_id, property_id, job_id, title, line_items, subtotal, tax_rate, total, status, sent_at, expires_at, decided_at, notes, created_at, updated_at";
const rowToEstimate = (r: EstimateRow): ServiceEstimate => ({
  id: r.id,
  number: r.number,
  customerId: r.customer_id,
  propertyId: r.property_id,
  jobId: r.job_id,
  title: r.title,
  lineItems: arr<LineItem>(r.line_items).filter((i) => i && typeof i.name === "string").map((i) => ({ name: i.name, quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0 })),
  subtotal: num(r.subtotal) ?? 0,
  taxRate: num(r.tax_rate) ?? 0,
  total: num(r.total) ?? 0,
  status: asEstimateStatus(r.status),
  sentAt: r.sent_at,
  expiresAt: r.expires_at,
  decidedAt: r.decided_at,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const getEstimates = cache(async function getEstimates(hostId: string): Promise<ServiceEstimate[]> {
  const { data } = await runQueryOr<EstimateRow[]>("service_estimates.list", [], (client) =>
    client.from("service_estimates").select(ESTIMATE_COLUMNS).eq("host_id", hostId).order("updated_at", { ascending: false }).limit(500).returns<EstimateRow[]>()
  );
  return data.map(rowToEstimate);
});

export const getEstimate = cache(async function getEstimate(hostId: string, id: string): Promise<ServiceEstimate | null> {
  const { data } = await runQueryOr<EstimateRow | null>("service_estimates.get", null, (client) => client.from("service_estimates").select(ESTIMATE_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<EstimateRow>());
  return data ? rowToEstimate(data) : null;
});

export async function insertEstimate(hostId: string, input: { customerId: string | null; propertyId: string | null; title: string; lineItems: LineItem[]; subtotal: number; taxRate: number; total: number; status: ServiceEstimate["status"]; sentAt: string | null; expiresAt: string | null; notes: string | null; createdBy: string | null }): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_estimates.insert", (client) =>
    client
      .from("service_estimates")
      .insert({ host_id: hostId, customer_id: input.customerId, property_id: input.propertyId, title: input.title, line_items: input.lineItems, subtotal: input.subtotal, tax_rate: input.taxRate, total: input.total, status: input.status, sent_at: input.sentAt, expires_at: input.expiresAt, notes: input.notes, created_by: input.createdBy })
      .select("id")
      .single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function updateEstimate(hostId: string, id: string, patch: Partial<{ status: ServiceEstimate["status"]; sentAt: string | null; expiresAt: string | null; decidedAt: string | null; jobId: string | null; notes: string | null }>): Promise<Done> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
  if (patch.decidedAt !== undefined) row.decided_at = patch.decidedAt;
  if (patch.jobId !== undefined) row.job_id = patch.jobId;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const result = await runMutation("service_estimates.update", (client) => client.from("service_estimates").update(row).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* ------------------------------------------------------------- events */

interface EventRow {
  id: string;
  customer_id: string | null;
  job_id: string | null;
  kind: string;
  body: string;
  created_by: string | null;
  created_at: string;
}
const rowToEvent = (r: EventRow): ServiceEvent => ({ id: r.id, customerId: r.customer_id, jobId: r.job_id, kind: asEventKind(r.kind), body: r.body, createdBy: r.created_by, createdAt: r.created_at });

export const getEvents = cache(async function getEvents(hostId: string, filter: { customerId?: string; jobId?: string }): Promise<ServiceEvent[]> {
  const { data } = await runQueryOr<EventRow[]>("service_events.list", [], (client) => {
    let q = client.from("service_events").select("id, customer_id, job_id, kind, body, created_by, created_at").eq("host_id", hostId);
    if (filter.customerId) q = q.eq("customer_id", filter.customerId);
    if (filter.jobId) q = q.eq("job_id", filter.jobId);
    return q.order("created_at", { ascending: false }).limit(300).returns<EventRow[]>();
  });
  return data.map(rowToEvent);
});

export async function insertEvent(hostId: string, input: { customerId: string | null; jobId: string | null; kind: ServiceEvent["kind"]; body: string; createdBy: string | null }): Promise<Res> {
  const outcome = await runQuery<{ id: string }>("service_events.insert", (client) =>
    client.from("service_events").insert({ host_id: hostId, customer_id: input.customerId, job_id: input.jobId, kind: input.kind, body: input.body, created_by: input.createdBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

/* --------------------------------------------------------------- docs */

interface DocRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  position: number;
  updated_at: string;
}
const rowToDoc = (r: DocRow): ServiceDoc => ({ id: r.id, kind: r.kind === "policy" || r.kind === "guide" || r.kind === "faq" || r.kind === "handbook" || r.kind === "training" ? r.kind : "sop", title: r.title, body: r.body, position: r.position, updatedAt: r.updated_at });

export const getDocs = cache(async function getDocs(hostId: string): Promise<ServiceDoc[]> {
  const { data } = await runQueryOr<DocRow[]>("service_docs.list", [], (client) =>
    client.from("service_docs").select("id, kind, title, body, position, updated_at").eq("host_id", hostId).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(300).returns<DocRow[]>()
  );
  return data.map(rowToDoc);
});

export async function insertDocs(hostId: string, docs: { kind: ServiceDoc["kind"]; title: string; body: string; position: number }[], createdBy: string | null): Promise<Done> {
  if (docs.length === 0) return { ok: true };
  const result = await runMutation("service_docs.insert", (client) => client.from("service_docs").insert(docs.map((d) => ({ host_id: hostId, kind: d.kind, title: d.title, body: d.body, position: d.position, created_by: createdBy }))));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function updateDoc(hostId: string, id: string, patch: { title?: string; body?: string; kind?: ServiceDoc["kind"] }): Promise<Done> {
  const result = await runMutation("service_docs.update", (client) => client.from("service_docs").update(patch).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteDoc(hostId: string, id: string): Promise<Done> {
  const result = await runMutation("service_docs.delete", (client) => client.from("service_docs").delete().eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
