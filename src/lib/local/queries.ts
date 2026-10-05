import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Local businesses (migration 0025): cafés and barbershops share one set of
 * tables — locations, daily sales, stock, shifts, appointments, clients and
 * checklists — because they are the same shape with different defaults. The
 * `kind` on a location keeps the two dashboards apart.
 *
 * Reads never throw; an un-migrated install shows empty dashboards that say
 * what to add first.
 */

export type LocationKind = "cafe" | "salon";

export interface Location {
  id: string;
  hostId: string;
  kind: LocationKind;
  name: string;
  address: string | null;
  timezone: string;
  posSystem: string | null;
  opensAt: string | null;
  closesAt: string | null;
  chairs: number | null;
  lowStockThreshold: number;
  rebookAfterDays: number;
  notes: string | null;
  createdAt: string;
}

export interface SalesEntry {
  id: string;
  locationId: string;
  day: string;
  grossSales: number;
  transactions: number;
  laborCost: number | null;
  notes: string | null;
  source: string;
}

export interface StockItem {
  id: string;
  locationId: string;
  name: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number | null;
  parLevel: number | null;
  supplier: string | null;
  updatedAt: string;
}

export interface Shift {
  id: string;
  locationId: string;
  staffName: string;
  role: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
}

export type AppointmentStatus = "booked" | "completed" | "no_show" | "cancelled";

export interface Appointment {
  id: string;
  locationId: string;
  clientName: string;
  clientPhone: string | null;
  service: string | null;
  staffName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: AppointmentStatus;
  price: number | null;
  notes: string | null;
}

export interface Client {
  id: string;
  locationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastVisitAt: string | null;
  visits: number;
  noShows: number;
  preferredStaff: string | null;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  module: string;
  locationId: string | null;
  title: string;
  kind: string;
  items: ChecklistItem[];
  day: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

/* ---------------------------------------------------------- locations */

interface LocationRow {
  id: string;
  host_id: string;
  kind: string;
  name: string;
  address: string | null;
  timezone: string;
  pos_system: string | null;
  opens_at: string | null;
  closes_at: string | null;
  chairs: number | null;
  low_stock_threshold: number | string;
  rebook_after_days: number;
  notes: string | null;
  created_at: string;
}

const LOCATION_COLUMNS = "id, host_id, kind, name, address, timezone, pos_system, opens_at, closes_at, chairs, low_stock_threshold, rebook_after_days, notes, created_at";

const num = (v: number | string | null | undefined, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function rowToLocation(row: LocationRow): Location {
  return {
    id: row.id,
    hostId: row.host_id,
    kind: row.kind === "salon" ? "salon" : "cafe",
    name: row.name,
    address: row.address,
    timezone: row.timezone,
    posSystem: row.pos_system,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    chairs: row.chairs,
    lowStockThreshold: num(row.low_stock_threshold, 5),
    rebookAfterDays: row.rebook_after_days ?? 35,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export const getLocations = cache(async function getLocations(hostId: string, kind: LocationKind): Promise<Location[]> {
  const { data } = await runQueryOr<LocationRow[]>("locations.list", [], (client) =>
    client.from("locations").select(LOCATION_COLUMNS).eq("host_id", hostId).eq("kind", kind).order("name", { ascending: true }).limit(200).returns<LocationRow[]>()
  );
  return data.map(rowToLocation);
});

export async function getLocation(hostId: string, id: string): Promise<Location | null> {
  const { data } = await runQueryOr<LocationRow | null>("locations.get", null, (client) =>
    client.from("locations").select(LOCATION_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<LocationRow>()
  );
  return data ? rowToLocation(data) : null;
}

export interface LocationWrite {
  kind: LocationKind;
  name: string;
  address: string | null;
  timezone: string;
  posSystem: string | null;
  opensAt: string | null;
  closesAt: string | null;
  chairs: number | null;
  lowStockThreshold: number;
  rebookAfterDays: number;
  notes: string | null;
}

function locationToRow(input: LocationWrite) {
  return {
    kind: input.kind,
    name: input.name,
    address: input.address,
    timezone: input.timezone,
    pos_system: input.posSystem,
    opens_at: input.opensAt,
    closes_at: input.closesAt,
    chairs: input.chairs,
    low_stock_threshold: input.lowStockThreshold,
    rebook_after_days: input.rebookAfterDays,
    notes: input.notes,
  };
}

export async function insertLocation(hostId: string, input: LocationWrite): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("locations.insert", (client) =>
    client.from("locations").insert({ host_id: hostId, ...locationToRow(input) }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function updateLocation(hostId: string, id: string, input: LocationWrite): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("locations.update", (client) => client.from("locations").update(locationToRow(input)).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteLocation(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("locations.delete", (client) => client.from("locations").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

/* -------------------------------------------------------------- sales */

interface SalesRow {
  id: string;
  location_id: string;
  day: string;
  gross_sales: number | string;
  transactions: number;
  labor_cost: number | string | null;
  notes: string | null;
  source: string;
}

export const getSales = cache(async function getSales(hostId: string, sinceDay: string): Promise<SalesEntry[]> {
  const { data } = await runQueryOr<SalesRow[]>("sales_entries.list", [], (client) =>
    client
      .from("sales_entries")
      .select("id, location_id, day, gross_sales, transactions, labor_cost, notes, source")
      .eq("host_id", hostId)
      .gte("day", sinceDay)
      .order("day", { ascending: true })
      .limit(5000)
      .returns<SalesRow[]>()
  );
  return data.map((r) => ({
    id: r.id,
    locationId: r.location_id,
    day: r.day,
    grossSales: num(r.gross_sales),
    transactions: r.transactions ?? 0,
    laborCost: r.labor_cost === null ? null : num(r.labor_cost),
    notes: r.notes,
    source: r.source,
  }));
});

export async function upsertSales(hostId: string, input: { locationId: string; day: string; grossSales: number; transactions: number; laborCost: number | null; notes: string | null; source: string; createdBy: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("sales_entries.upsert", (client) =>
    client.from("sales_entries").upsert(
      {
        host_id: hostId,
        location_id: input.locationId,
        day: input.day,
        gross_sales: input.grossSales,
        transactions: input.transactions,
        labor_cost: input.laborCost,
        notes: input.notes,
        source: input.source,
        created_by: input.createdBy,
      },
      { onConflict: "location_id,day" }
    )
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* -------------------------------------------------------------- stock */

interface StockRow {
  id: string;
  location_id: string;
  name: string;
  unit: string;
  quantity: number | string;
  low_stock_threshold: number | string | null;
  par_level: number | string | null;
  supplier: string | null;
  updated_at: string;
}

export const getStock = cache(async function getStock(hostId: string, kind: LocationKind): Promise<StockItem[]> {
  const locations = await getLocations(hostId, kind);
  if (locations.length === 0) return [];
  const ids = locations.map((l) => l.id);
  const { data } = await runQueryOr<StockRow[]>("stock_items.list", [], (client) =>
    client.from("stock_items").select("id, location_id, name, unit, quantity, low_stock_threshold, par_level, supplier, updated_at").eq("host_id", hostId).in("location_id", ids).order("name", { ascending: true }).limit(2000).returns<StockRow[]>()
  );
  return data.map((r) => ({
    id: r.id,
    locationId: r.location_id,
    name: r.name,
    unit: r.unit,
    quantity: num(r.quantity),
    lowStockThreshold: r.low_stock_threshold === null ? null : num(r.low_stock_threshold),
    parLevel: r.par_level === null ? null : num(r.par_level),
    supplier: r.supplier,
    updatedAt: r.updated_at,
  }));
});

export async function insertStockItem(hostId: string, input: { locationId: string; name: string; unit: string; quantity: number; lowStockThreshold: number | null; parLevel: number | null; supplier: string | null; updatedBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("stock_items.insert", (client) =>
    client
      .from("stock_items")
      .insert({ host_id: hostId, location_id: input.locationId, name: input.name, unit: input.unit, quantity: input.quantity, low_stock_threshold: input.lowStockThreshold, par_level: input.parLevel, supplier: input.supplier, updated_by: input.updatedBy })
      .select("id")
      .single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function setStockQuantity(hostId: string, id: string, quantity: number, updatedBy: string | null): Promise<boolean> {
  const result = await runMutation("stock_items.quantity", (client) => client.from("stock_items").update({ quantity, updated_by: updatedBy }).eq("host_id", hostId).eq("id", id));
  return result.ok;
}

export async function deleteStockItem(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("stock_items.delete", (client) => client.from("stock_items").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

/* ------------------------------------------------------------- shifts */

interface ShiftRow {
  id: string;
  location_id: string;
  staff_name: string;
  role: string | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
}

export const getShifts = cache(async function getShifts(hostId: string, kind: LocationKind, fromIso: string, toIso: string): Promise<Shift[]> {
  const locations = await getLocations(hostId, kind);
  if (locations.length === 0) return [];
  const ids = locations.map((l) => l.id);
  const { data } = await runQueryOr<ShiftRow[]>("shifts.list", [], (client) =>
    client.from("shifts").select("id, location_id, staff_name, role, starts_at, ends_at, notes").eq("host_id", hostId).in("location_id", ids).gte("starts_at", fromIso).lte("starts_at", toIso).order("starts_at", { ascending: true }).limit(1000).returns<ShiftRow[]>()
  );
  return data.map((r) => ({ id: r.id, locationId: r.location_id, staffName: r.staff_name, role: r.role, startsAt: r.starts_at, endsAt: r.ends_at, notes: r.notes }));
});

export async function insertShift(hostId: string, input: { locationId: string; staffName: string; role: string | null; startsAt: string; endsAt: string; notes: string | null; createdBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("shifts.insert", (client) =>
    client.from("shifts").insert({ host_id: hostId, location_id: input.locationId, staff_name: input.staffName, role: input.role, starts_at: input.startsAt, ends_at: input.endsAt, notes: input.notes, created_by: input.createdBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function deleteShift(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("shifts.delete", (client) => client.from("shifts").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

/* ------------------------------------------------------- appointments */

interface AppointmentRow {
  id: string;
  location_id: string;
  client_name: string;
  client_phone: string | null;
  service: string | null;
  staff_name: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  price: number | string | null;
  notes: string | null;
}

const APPT_STATUSES = new Set<string>(["booked", "completed", "no_show", "cancelled"]);

function rowToAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    locationId: r.location_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    service: r.service,
    staffName: r.staff_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: (APPT_STATUSES.has(r.status) ? r.status : "booked") as AppointmentStatus,
    price: r.price === null ? null : num(r.price),
    notes: r.notes,
  };
}

export const getAppointments = cache(async function getAppointments(hostId: string, fromIso: string, toIso: string): Promise<Appointment[]> {
  const { data } = await runQueryOr<AppointmentRow[]>("appointments.list", [], (client) =>
    client
      .from("appointments")
      .select("id, location_id, client_name, client_phone, service, staff_name, starts_at, ends_at, status, price, notes")
      .eq("host_id", hostId)
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso)
      .order("starts_at", { ascending: true })
      .limit(3000)
      .returns<AppointmentRow[]>()
  );
  return data.map(rowToAppointment);
});

export async function insertAppointment(hostId: string, input: { locationId: string; clientName: string; clientPhone: string | null; service: string | null; staffName: string | null; startsAt: string; endsAt: string | null; price: number | null; notes: string | null; createdBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("appointments.insert", (client) =>
    client
      .from("appointments")
      .insert({ host_id: hostId, location_id: input.locationId, client_name: input.clientName, client_phone: input.clientPhone, service: input.service, staff_name: input.staffName, starts_at: input.startsAt, ends_at: input.endsAt, price: input.price, notes: input.notes, created_by: input.createdBy })
      .select("id")
      .single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function setAppointmentStatus(hostId: string, id: string, status: AppointmentStatus): Promise<Appointment | null> {
  const outcome = await runQuery<AppointmentRow>("appointments.status", (client) =>
    client.from("appointments").update({ status }).eq("host_id", hostId).eq("id", id).select("id, location_id, client_name, client_phone, service, staff_name, starts_at, ends_at, status, price, notes").single<AppointmentRow>()
  );
  return outcome.ok ? rowToAppointment(outcome.data) : null;
}

/* ------------------------------------------------------------ clients */

interface ClientRow {
  id: string;
  location_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  last_visit_at: string | null;
  visits: number;
  no_shows: number;
  preferred_staff: string | null;
}

const CLIENT_COLUMNS = "id, location_id, name, phone, email, last_visit_at, visits, no_shows, preferred_staff";

function rowToClient(r: ClientRow): Client {
  return { id: r.id, locationId: r.location_id, name: r.name, phone: r.phone, email: r.email, lastVisitAt: r.last_visit_at, visits: r.visits ?? 0, noShows: r.no_shows ?? 0, preferredStaff: r.preferred_staff };
}

export const getClients = cache(async function getClients(hostId: string): Promise<Client[]> {
  const { data } = await runQueryOr<ClientRow[]>("clients.list", [], (client) =>
    client.from("clients").select(CLIENT_COLUMNS).eq("host_id", hostId).order("last_visit_at", { ascending: true, nullsFirst: false }).limit(3000).returns<ClientRow[]>()
  );
  return data.map(rowToClient);
});

/**
 * A completed appointment is a visit; a no-show is a strike. The client row
 * is created on first sight, keyed by (location, name, phone).
 */
export async function recordVisit(hostId: string, appt: Appointment, kind: "visit" | "no_show"): Promise<void> {
  const { data: existing } = await runQueryOr<ClientRow | null>("clients.find", null, (client) =>
    client.from("clients").select(CLIENT_COLUMNS).eq("host_id", hostId).eq("location_id", appt.locationId).ilike("name", appt.clientName).limit(1).maybeSingle<ClientRow>()
  );
  const patch =
    kind === "visit"
      ? { last_visit_at: appt.startsAt, visits: (existing?.visits ?? 0) + 1, preferred_staff: appt.staffName ?? existing?.preferred_staff ?? null }
      : { no_shows: (existing?.no_shows ?? 0) + 1 };
  if (existing) {
    await runMutation("clients.update", (client) => client.from("clients").update(patch).eq("host_id", hostId).eq("id", existing.id));
  } else {
    await runMutation("clients.insert", (client) => client.from("clients").insert({ host_id: hostId, location_id: appt.locationId, name: appt.clientName, phone: appt.clientPhone, ...patch }));
  }
}

/** Clients whose last visit is older than the location's rebooking window, oldest first. */
export function clientsDueForRebooking(clients: Client[], locations: Location[], now = Date.now()): (Client & { daysSince: number })[] {
  const windowFor = new Map(locations.map((l) => [l.id, l.rebookAfterDays]));
  return clients
    .filter((c) => c.lastVisitAt)
    .map((c) => ({ ...c, daysSince: Math.floor((now - Date.parse(c.lastVisitAt as string)) / 86_400_000) }))
    .filter((c) => c.daysSince >= (windowFor.get(c.locationId) ?? 35))
    .sort((a, b) => b.daysSince - a.daysSince);
}

/* --------------------------------------------------------- checklists */

interface ChecklistRow {
  id: string;
  module: string;
  location_id: string | null;
  title: string;
  kind: string;
  items: unknown;
  day: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

const CHECKLIST_COLUMNS = "id, module, location_id, title, kind, items, day, completed_at, completed_by";

function parseItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is { text: unknown; done?: unknown } => typeof i === "object" && i !== null && "text" in i)
    .map((i) => ({ text: String(i.text).slice(0, 300), done: Boolean(i.done) }));
}

function rowToChecklist(r: ChecklistRow): Checklist {
  return { id: r.id, module: r.module, locationId: r.location_id, title: r.title, kind: r.kind, items: parseItems(r.items), day: r.day, completedAt: r.completed_at, completedBy: r.completed_by };
}

export const getChecklists = cache(async function getChecklists(hostId: string, module: string): Promise<Checklist[]> {
  const { data } = await runQueryOr<ChecklistRow[]>("checklists.list", [], (client) =>
    client.from("checklists").select(CHECKLIST_COLUMNS).eq("host_id", hostId).eq("module", module).order("created_at", { ascending: true }).limit(200).returns<ChecklistRow[]>()
  );
  return data.map(rowToChecklist);
});

export async function insertChecklist(hostId: string, input: { module: string; locationId: string | null; title: string; kind: string; items: ChecklistItem[]; createdBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("checklists.insert", (client) =>
    client.from("checklists").insert({ host_id: hostId, module: input.module, location_id: input.locationId, title: input.title, kind: input.kind, items: input.items, created_by: input.createdBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function saveChecklistItems(hostId: string, id: string, items: ChecklistItem[], completedBy: string | null): Promise<boolean> {
  const allDone = items.length > 0 && items.every((i) => i.done);
  const result = await runMutation("checklists.items", (client) =>
    client.from("checklists").update({ items, completed_at: allDone ? new Date().toISOString() : null, completed_by: allDone ? completedBy : null, day: new Date().toISOString().slice(0, 10) }).eq("host_id", hostId).eq("id", id)
  );
  return result.ok;
}

export async function deleteChecklist(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("checklists.delete", (client) => client.from("checklists").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

/* ---------------------------------------------------------- analytics */

export interface DailySales {
  day: string;
  label: string;
  sales: number;
  transactions: number;
}

/** 14 days of sales, every day present (zero-filled), plus the "same day last week" comparison. */
export function summarizeSales(entries: SalesEntry[], days = 14, now = new Date()): { daily: DailySales[]; today: number; todayTransactions: number; sameDayLastWeek: number; total14d: number; avgTicket: number | null } {
  const byDay = new Map<string, { sales: number; transactions: number }>();
  for (const e of entries) {
    const cur = byDay.get(e.day) ?? { sales: 0, transactions: 0 };
    byDay.set(e.day, { sales: cur.sales + e.grossSales, transactions: cur.transactions + e.transactions });
  }
  const daily: DailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const v = byDay.get(key) ?? { sales: 0, transactions: 0 };
    daily.push({ day: key, label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), sales: v.sales, transactions: v.transactions });
  }
  const todayKey = now.toISOString().slice(0, 10);
  const lastWeek = new Date(now);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const today = byDay.get(todayKey) ?? { sales: 0, transactions: 0 };
  const total = daily.reduce((s, d) => s + d.sales, 0);
  const tx = daily.reduce((s, d) => s + d.transactions, 0);
  return {
    daily,
    today: today.sales,
    todayTransactions: today.transactions,
    sameDayLastWeek: byDay.get(lastWeek.toISOString().slice(0, 10))?.sales ?? 0,
    total14d: total,
    avgTicket: tx > 0 ? total / tx : null,
  };
}
