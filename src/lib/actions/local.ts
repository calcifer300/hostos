"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import {
  deleteChecklist,
  deleteLocation,
  deleteShift,
  deleteStockItem,
  getLocation,
  insertAppointment,
  insertChecklist,
  insertLocation,
  insertShift,
  insertStockItem,
  recordVisit,
  saveChecklistItems,
  setAppointmentStatus,
  setStockQuantity,
  updateLocation,
  upsertSales,
  type AppointmentStatus,
  type ChecklistItem,
  type LocationKind,
  type LocationWrite,
} from "@/lib/local/queries";
import { logActivity, type ActivityModule } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { routes } from "@/lib/routes";

/**
 * Every write for cafés and barbershops. Same contract as every other action
 * file: { ok, error? }, never throws to the client, permission-checked.
 */

export interface LocalActionResult {
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
const numOr = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const isoOrNull = (v: unknown) => {
  const s = str(v, 40);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const pathFor = (kind: LocationKind) => (kind === "salon" ? routes.salon : routes.cafe);
const moduleFor = (kind: LocationKind): ActivityModule => kind;
const migrationHint = (error: string) => (/relation|created/i.test(error) ? "Run migration 0025 to enable this vertical." : error);

/* ---------------------------------------------------------- locations */

export interface LocationInput {
  kind: LocationKind;
  name: string;
  address?: string;
  timezone?: string;
  posSystem?: string;
  opensAt?: string;
  closesAt?: string;
  chairs?: number;
  lowStockThreshold?: number;
  rebookAfterDays?: number;
  notes?: string;
}

function toLocation(input: LocationInput): LocationWrite | { error: string } {
  const name = str(input.name, 120);
  if (!name) return { error: "Give the location a name." };
  return {
    kind: input.kind === "salon" ? "salon" : "cafe",
    name,
    address: str(input.address, 300) || null,
    timezone: str(input.timezone, 60) || "America/Denver",
    posSystem: str(input.posSystem, 60) || null,
    opensAt: str(input.opensAt, 10) || null,
    closesAt: str(input.closesAt, 10) || null,
    chairs: input.chairs !== undefined && input.chairs !== null && Number.isFinite(Number(input.chairs)) ? Math.max(0, Math.round(Number(input.chairs))) : null,
    lowStockThreshold: Math.max(0, numOr(input.lowStockThreshold, 5)),
    rebookAfterDays: Math.max(1, Math.round(numOr(input.rebookAfterDays, 35))),
    notes: str(input.notes, 4000) || null,
  };
}

export async function createLocation(input: LocationInput): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const write = toLocation(input);
  if ("error" in write) return { ok: false, error: write.error };
  const outcome = await insertLocation(g.hostId, write);
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  await logActivity({ hostId: g.hostId, module: moduleFor(write.kind), event: "location.created", description: `Added ${write.name}`, actorEmail: g.email, href: pathFor(write.kind) });
  revalidatePath(pathFor(write.kind));
  return { ok: true, id: outcome.id };
}

export async function editLocation(id: string, input: LocationInput): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const write = toLocation(input);
  if ("error" in write) return { ok: false, error: write.error };
  const outcome = await updateLocation(g.hostId, id, write);
  if (!outcome.ok) return { ok: false, error: outcome.error };
  revalidatePath(pathFor(write.kind));
  return { ok: true, id };
}

export async function removeLocation(id: string): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const existing = await getLocation(g.hostId, id);
  if (!existing) return { ok: false, error: "That location is gone already." };
  if (!(await deleteLocation(g.hostId, id))) return { ok: false, error: "Couldn't remove the location." };
  await logActivity({ hostId: g.hostId, module: moduleFor(existing.kind), event: "location.deleted", description: `Removed ${existing.name}`, actorEmail: g.email });
  revalidatePath(pathFor(existing.kind));
  return { ok: true };
}

/* -------------------------------------------------------------- sales */

export async function logSales(input: { locationId: string; day: string; grossSales: number; transactions: number; laborCost?: number | null; notes?: string }): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const location = await getLocation(g.hostId, str(input.locationId, 40));
  if (!location) return { ok: false, error: "Pick a location." };
  const day = str(input.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Pick a day." };
  const gross = numOr(input.grossSales, NaN);
  if (!Number.isFinite(gross) || gross < 0) return { ok: false, error: "Enter the day's sales." };
  const outcome = await upsertSales(g.hostId, {
    locationId: location.id,
    day,
    grossSales: Math.round(gross * 100) / 100,
    transactions: Math.max(0, Math.round(numOr(input.transactions, 0))),
    laborCost: input.laborCost === null || input.laborCost === undefined || input.laborCost === ("" as unknown) ? null : Math.max(0, numOr(input.laborCost, 0)),
    notes: str(input.notes, 1000) || null,
    source: "manual",
    createdBy: g.email,
  });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  await logActivity({ hostId: g.hostId, module: moduleFor(location.kind), event: "sales.logged", description: `${location.name}: $${gross.toFixed(2)} logged for ${day}`, actorEmail: g.email, href: pathFor(location.kind) });
  revalidatePath(pathFor(location.kind));
  return { ok: true };
}

/* -------------------------------------------------------------- stock */

export async function addStockItem(input: { locationId: string; name: string; unit?: string; quantity: number; lowStockThreshold?: number | null; parLevel?: number | null; supplier?: string }): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const location = await getLocation(g.hostId, str(input.locationId, 40));
  if (!location) return { ok: false, error: "Pick a location." };
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: "Name the item." };
  const outcome = await insertStockItem(g.hostId, {
    locationId: location.id,
    name,
    unit: str(input.unit, 30) || "units",
    quantity: Math.max(0, numOr(input.quantity, 0)),
    lowStockThreshold: input.lowStockThreshold === null || input.lowStockThreshold === undefined ? null : Math.max(0, numOr(input.lowStockThreshold, 0)),
    parLevel: input.parLevel === null || input.parLevel === undefined ? null : Math.max(0, numOr(input.parLevel, 0)),
    supplier: str(input.supplier, 120) || null,
    updatedBy: g.email,
  });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  revalidatePath(pathFor(location.kind));
  return { ok: true, id: outcome.id };
}

export async function updateStock(id: string, quantity: number, kind: LocationKind): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await setStockQuantity(g.hostId, str(id, 40), Math.max(0, numOr(quantity, 0)), g.email))) return { ok: false, error: "Couldn't update the quantity." };
  revalidatePath(pathFor(kind));
  return { ok: true };
}

export async function removeStockItem(id: string, kind: LocationKind): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await deleteStockItem(g.hostId, str(id, 40)))) return { ok: false, error: "Couldn't remove the item." };
  revalidatePath(pathFor(kind));
  return { ok: true };
}

/* ------------------------------------------------------------- shifts */

export async function addShift(input: { locationId: string; staffName: string; role?: string; startsAt: string; endsAt: string; notes?: string }): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const location = await getLocation(g.hostId, str(input.locationId, 40));
  if (!location) return { ok: false, error: "Pick a location." };
  const staffName = str(input.staffName, 120);
  if (!staffName) return { ok: false, error: "Who is on shift?" };
  const startsAt = isoOrNull(input.startsAt);
  const endsAt = isoOrNull(input.endsAt);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: "The shift needs a start and a later end." };
  const outcome = await insertShift(g.hostId, { locationId: location.id, staffName, role: str(input.role, 60) || null, startsAt, endsAt, notes: str(input.notes, 1000) || null, createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  revalidatePath(pathFor(location.kind));
  return { ok: true, id: outcome.id };
}

export async function removeShift(id: string, kind: LocationKind): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await deleteShift(g.hostId, str(id, 40)))) return { ok: false, error: "Couldn't remove the shift." };
  revalidatePath(pathFor(kind));
  return { ok: true };
}

/* ------------------------------------------------------- appointments */

export async function addAppointment(input: { locationId: string; clientName: string; clientPhone?: string; service?: string; staffName?: string; startsAt: string; durationMinutes?: number; price?: number | null; notes?: string }): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const location = await getLocation(g.hostId, str(input.locationId, 40));
  if (!location) return { ok: false, error: "Pick a location." };
  const clientName = str(input.clientName, 120);
  if (!clientName) return { ok: false, error: "Who is the appointment for?" };
  const startsAt = isoOrNull(input.startsAt);
  if (!startsAt) return { ok: false, error: "Pick a start time." };
  const minutes = Math.max(5, Math.round(numOr(input.durationMinutes, 30)));
  const endsAt = new Date(Date.parse(startsAt) + minutes * 60_000).toISOString();
  const outcome = await insertAppointment(g.hostId, {
    locationId: location.id,
    clientName,
    clientPhone: str(input.clientPhone, 40) || null,
    service: str(input.service, 120) || null,
    staffName: str(input.staffName, 120) || null,
    startsAt,
    endsAt,
    price: input.price === null || input.price === undefined ? null : Math.max(0, numOr(input.price, 0)),
    notes: str(input.notes, 1000) || null,
    createdBy: g.email,
  });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  revalidatePath(pathFor(location.kind));
  return { ok: true, id: outcome.id };
}

const STATUSES = new Set<AppointmentStatus>(["booked", "completed", "no_show", "cancelled"]);

export async function markAppointment(id: string, status: AppointmentStatus): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!STATUSES.has(status)) return { ok: false, error: "Unknown status." };
  const appt = await setAppointmentStatus(g.hostId, str(id, 40), status);
  if (!appt) return { ok: false, error: "Couldn't update the appointment." };
  const location = await getLocation(g.hostId, appt.locationId);
  const kind: LocationKind = location?.kind ?? "salon";
  if (status === "completed") await recordVisit(g.hostId, appt, "visit");
  if (status === "no_show") {
    await recordVisit(g.hostId, appt, "no_show");
    await notify({ hostId: g.hostId, kind, severity: "warning", title: `${appt.clientName} didn't show`, body: [appt.service, appt.staffName].filter(Boolean).join(" · ") || null, href: pathFor(kind), dedupeKey: `no-show:${appt.id}` });
  }
  await logActivity({ hostId: g.hostId, module: moduleFor(kind), event: `appointment.${status}`, description: `${appt.clientName}: ${status.replace("_", "-")}`, actorEmail: g.email, href: pathFor(kind) });
  revalidatePath(pathFor(kind));
  return { ok: true };
}

/* --------------------------------------------------------- checklists */

const OPENING = ["Unlock, lights, music", "Count the float and open the till", "Brew first batch · check milk and beans", "Wipe counters, check restrooms", "Put out pastries, update the board"];
const CLOSING = ["Cash up and log today's sales", "Clean machines and grinders", "Restock for the morning · note anything low", "Take out trash, mop, lock up"];
const SALON_OPENING = ["Unlock, lights, sanitise stations", "Confirm today's appointments and no-show follow-ups", "Check towels, capes and product stock", "Open the till"];
const SALON_CLOSING = ["Cash up and log today's revenue", "Sanitise tools and stations", "Text tomorrow's clients a reminder", "Lock up"];

export async function addChecklist(input: { module: "cafe" | "salon" | "custom"; locationId?: string | null; title: string; kind?: string; items: string[] }): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const title = str(input.title, 120);
  if (!title) return { ok: false, error: "Give the checklist a title." };
  const items: ChecklistItem[] = (input.items ?? []).map((t) => str(t, 300)).filter(Boolean).slice(0, 60).map((text) => ({ text, done: false }));
  if (items.length === 0) return { ok: false, error: "Add at least one item." };
  const target = input.module === "salon" ? "salon" : input.module === "custom" ? "custom" : "cafe";
  const outcome = await insertChecklist(g.hostId, { module: target, locationId: str(input.locationId, 40) || null, title, kind: str(input.kind, 20) || "daily", items, createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  revalidatePath(target === "custom" ? routes.custom : pathFor(target));
  return { ok: true, id: outcome.id };
}

/** Opening and closing routines for a location, in one click. */
export async function seedChecklists(kind: LocationKind, locationId: string | null): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const sets = kind === "salon" ? [["Opening", "opening", SALON_OPENING], ["Closing", "closing", SALON_CLOSING]] : [["Opening", "opening", OPENING], ["Closing", "closing", CLOSING]];
  for (const [title, k, items] of sets as [string, string, string[]][]) {
    const outcome = await insertChecklist(g.hostId, { module: kind, locationId, title, kind: k, items: items.map((text) => ({ text, done: false })), createdBy: g.email });
    if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  }
  revalidatePath(pathFor(kind));
  return { ok: true };
}

export async function setChecklistItems(id: string, items: ChecklistItem[], module: "cafe" | "salon" | "custom"): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const clean = items.slice(0, 60).map((i) => ({ text: str(i.text, 300), done: Boolean(i.done) })).filter((i) => i.text);
  if (!(await saveChecklistItems(g.hostId, str(id, 40), clean, g.email))) return { ok: false, error: "Couldn't save the checklist." };
  revalidatePath(module === "custom" ? routes.custom : pathFor(module));
  return { ok: true };
}

export async function removeChecklist(id: string, module: "cafe" | "salon" | "custom"): Promise<LocalActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await deleteChecklist(g.hostId, str(id, 40)))) return { ok: false, error: "Couldn't remove the checklist." };
  revalidatePath(module === "custom" ? routes.custom : pathFor(module));
  return { ok: true };
}
