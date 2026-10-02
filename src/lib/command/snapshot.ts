/**
 * The Command Center snapshot the HostOS extension sends (extension/modules/snapshot.js in the Files/CC
 * project). The extension does all the arithmetic; this file only describes the shape and makes any stored
 * or received value safe to draw: unknown fields are dropped, missing ones get a neutral value, and nothing
 * here throws.
 *
 * Pure: no I/O, so the ingest route and the tests share it.
 */

export const SNAPSHOT_VERSION = 1;
/** Larger than this is refused; a real fleet's snapshot is a few hundred KB. */
export const MAX_SNAPSHOT_BYTES = 3_000_000;

export interface AttentionRow {
  kind: string;
  tone: string;
  label: string;
  guest: string | null;
  vehicle: string | null;
  plate: string | null;
  tripId: string | null;
  tripUrl: string | null;
  when: number | null;
  detail: string | null;
}

export interface ScheduleSlot {
  type: "Pickup" | "Return";
  at: number | null;
  done: boolean;
  time: string;
  vehicle: string | null;
  plate: string | null;
  guest: string | null;
  tripUrl: string | null;
}

export interface FleetCard {
  name: string;
  plate: string | null;
  photo: string | null;
  status: string;
  state: "ontrip" | "soon" | "attention" | "available" | "unlisted";
  issues: string[];
  /** estimated earnings, priced trips that ended in the last 90 days, and how many trips that is */
  earned90: number;
  earnedTrips90: number;
  /** trips that started in the last 90 days */
  booked90: number;
  inspection: boolean;
  listingUrl: string | null;
  now: { guest: string | null; until: string; tripUrl: string | null } | null;
  next: { guest: string | null; from: string; tripUrl: string | null } | null;
}

export interface BilledRow {
  tripId: string;
  guest: string | null;
  vehicle: string | null;
  cents: number;
  billedAt: string | null;
  invoiceNumber: string | null;
}

export interface NotBilledRow {
  tripId: string;
  guest: string | null;
  vehicle: string | null;
  cents: number;
  group: string;
  why: string;
  /** When the trip ends (ms), so a trip that is still out can say how long until it can be billed. */
  endsAt: number | null;
}

export interface TripLeg {
  day: string;
  time: string;
  rel: string;
  soon: boolean;
  past: boolean;
}

export interface TripRow {
  tripId: string | null;
  tripUrl: string | null;
  guest: string | null;
  vehicle: string | null;
  plate: string | null;
  pickupAt: number | null;
  returnAt: number | null;
  pickup: TripLeg | null;
  ret: TripLeg | null;
  days: number | null;
  earnings: number | null;
  flags: { tone: string; text: string }[];
  guestRating: number | null;
  guestTrips: number | null;
}

export interface UnreadRow {
  tripId: string | null;
  tripUrl: string | null;
  guest: string | null;
  vehicle: string | null;
  plate: string | null;
  text: string;
  sentAt: number | null;
  waitMs: number | null;
  sent: string;
  wait: string;
  urgency: "high" | "medium" | "new" | "unknown";
  /** urgent: a car or trip is at risk; reply: a person should answer; fyi: thanks or an update, nothing asked */
  tone: "urgent" | "reply" | "fyi";
  labels: { key: string; label: string; level: "urgent" | "attention" }[];
}

/** What the scanner could and could not confirm, so each tile can say how far to trust it. */
export interface SnapshotQuality {
  tripsAt: string | null;
  fleetAt: string | null;
  fleetLive: boolean;
  listingsLive: boolean;
  listingsAt: string | null;
  unpricedTrips: number;
  detailsPending: number;
  detailsFailed: number;
  activeNoPlate: number;
  tollsAt: string | null;
  invoicesMissing: number;
  invoicesTotal: number;
}

export interface TopCar {
  name: string;
  plate: string | null;
  total: number;
  trips: number;
  perTrip: number;
  photo: string | null;
  photos: string[];
  runnersUp: { name: string; plate: string | null; total: number }[];
}

export interface CommandSnapshot {
  version: number;
  builtAt: number;
  zone: string;
  brand: string | null;
  operator: string | null;
  owner: string | null;
  scannedAt: string | null;
  counts: { trips: number; vehicles: number };
  kpis: {
    vehicles: number;
    activeTrips: number;
    pickups: number;
    returns: number;
    earningsNext30: number;
    earningsLast30: number;
    tripsNext30: number;
  };
  greeting: string;
  attention: AttentionRow[];
  schedule: ScheduleSlot[];
  fleetSummary: { total: number; onTrip: number; scheduled: number; available: number; unlisted: number; needsAttention: number };
  fleet: FleetCard[];
  tripLists: { active: TripRow[]; pickups: TripRow[]; returns: TripRow[] };
  unread: UnreadRow[];
  quality: SnapshotQuality;
  topCar: TopCar | null;
  weeks: { from: number; cents: number; trips: number; future: boolean }[];
  tolls: {
    at: string | null;
    toBill: number;
    toBillCents: number;
    running: number;
    runningCents: number;
    looks: number;
    billedWeekTrips: number;
    billedWeekCents: number;
    fileBilled: number;
    fileTotal: number;
    billedRows: BilledRow[];
    notBilledRows: NotBilledRow[];
  } | null;
  unpriced: { vehicle: string; plate: string | null; guest: string | null; ends: string; reason: string; guess: number | null }[];
  calendar: { fleet: number; fresh: number; needed: number; neededDone: number; complete: boolean } | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, max = 300): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const num = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const bool = (value: unknown): boolean => value === true;
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
/** Only http(s) addresses are ever kept, so a stored value can never become a javascript: link. */
const url = (value: unknown): string | null => {
  const text = str(value, 600);
  return text && /^https:\/\//i.test(text) ? text : null;
};

const STATES = ["ontrip", "soon", "attention", "available", "unlisted"] as const;

/** Makes whatever arrived (or was stored) into a whole snapshot, or null when it is not one. */
export function normalizeSnapshot(raw: unknown): CommandSnapshot | null {
  if (!isObject(raw)) return null;
  // Two shapes arrive here: the extension's (everything under `model`, `earnings`) and our own stored one (flat).
  // Accepting both is what lets a stored snapshot be read back and made safe again.
  const flat = !isObject(raw.model) && isObject(raw.kpis);
  const model: Record<string, unknown> | null = isObject(raw.model)
    ? raw.model
    : flat
      ? { greeting: raw.greeting, kpis: raw.kpis, fleet: raw.fleetSummary, attention: raw.attention, schedule: raw.schedule, earnings: raw.weeks }
      : null;
  if (!model) return null;
  const kpis = isObject(model.kpis) ? model.kpis : {};
  const fleetSummary = isObject(model.fleet) ? model.fleet : {};
  const photos = isObject(raw.photos) ? raw.photos : {};
  const earnings: Record<string, unknown> = flat ? { unpriced: raw.unpriced, calendar: raw.calendar } : isObject(raw.earnings) ? raw.earnings : {};

  const attention = list(model.attention, 200).filter(isObject).map((row) => ({
    kind: str(row.kind, 20) ?? "other", tone: str(row.tone, 20) ?? "amber", label: str(row.label, 120) ?? "",
    guest: str(row.guest, 80), vehicle: str(row.vehicle, 100), plate: str(row.plate, 20), tripId: str(row.tripId, 30),
    tripUrl: url(row.tripUrl), when: typeof row.when === "number" ? row.when : null, detail: str(row.detail, 300),
  }));
  const schedule = list(model.schedule, 100).filter(isObject).map((slot) => ({
    type: (slot.type === "Return" ? "Return" : "Pickup") as "Pickup" | "Return", at: typeof slot.at === "number" ? slot.at : null,
    done: bool(slot.done), time: str(slot.time, 20) ?? "", vehicle: str(slot.vehicle, 100), plate: str(slot.plate, 20),
    guest: str(slot.guest, 80), tripUrl: url(slot.tripUrl),
  }));
  const fleet = list(raw.fleet, 400).filter(isObject).map((car) => {
    const plate = str(car.plate, 20);
    const pics = plate && Array.isArray(photos[plate]) ? (photos[plate] as unknown[]) : [];
    const now = isObject(car.now) ? { guest: str(car.now.guest, 80), until: str(car.now.until, 60) ?? "", tripUrl: url(car.now.tripUrl) } : null;
    const next = isObject(car.next) ? { guest: str(car.next.guest, 80), from: str(car.next.from, 60) ?? "", tripUrl: url(car.next.tripUrl) } : null;
    return {
      name: str(car.name, 100) ?? "Vehicle", plate, photo: url(pics[0]) ?? url(car.photo), status: str(car.status, 20) ?? "listed",
      state: (STATES as readonly string[]).includes(String(car.state)) ? (car.state as FleetCard["state"]) : "available",
      issues: list(car.issues, 6).map((issue) => str(issue, 120)).filter((issue): issue is string => Boolean(issue)), now, next,
      earned90: num(car.earned90), earnedTrips90: num(car.earnedTrips90), booked90: num(car.booked90), inspection: bool(car.inspection), listingUrl: url(car.listingUrl),
    };
  });
  const leg = (value: unknown): TripLeg | null =>
    isObject(value) ? { day: str(value.day, 30) ?? "", time: str(value.time, 20) ?? "", rel: str(value.rel, 30) ?? "", soon: bool(value.soon), past: bool(value.past) } : null;
  const tripRows = (rows: unknown): TripRow[] =>
    list(rows, 250).filter(isObject).map((row) => ({
      tripId: str(row.tripId, 30), tripUrl: url(row.tripUrl), guest: str(row.guest, 80), vehicle: str(row.vehicle, 100), plate: str(row.plate, 20),
      pickupAt: typeof row.pickupAt === "number" ? row.pickupAt : null, returnAt: typeof row.returnAt === "number" ? row.returnAt : null,
      pickup: leg(row.pickup), ret: leg(row.ret), days: typeof row.days === "number" ? row.days : null,
      earnings: typeof row.earnings === "number" ? row.earnings : null,
      flags: list(row.flags, 4).filter(isObject).map((flag) => ({ tone: str(flag.tone, 10) ?? "amber", text: str(flag.text, 60) ?? "" })).filter((flag) => flag.text),
      guestRating: typeof row.guestRating === "number" ? row.guestRating : null, guestTrips: typeof row.guestTrips === "number" ? row.guestTrips : null,
    }));
  const lists = isObject(raw.tripLists) ? raw.tripLists : {};
  const URGENCY = ["high", "medium", "new", "unknown"] as const;
  const unread: UnreadRow[] = list(raw.unread, 80).filter(isObject).map((row) => ({
    tripId: str(row.tripId, 30), tripUrl: url(row.tripUrl), guest: str(row.guest, 80), vehicle: str(row.vehicle, 100), plate: str(row.plate, 20),
    text: str(row.text, 420) ?? "", sentAt: typeof row.sentAt === "number" ? row.sentAt : null, waitMs: typeof row.waitMs === "number" ? row.waitMs : null,
    sent: str(row.sent, 40) ?? "", wait: str(row.wait, 60) ?? "",
    urgency: (URGENCY as readonly string[]).includes(String(row.urgency)) ? (row.urgency as UnreadRow["urgency"]) : "unknown",
    tone: row.tone === "urgent" || row.tone === "fyi" ? row.tone : "reply",
    labels: list(row.labels, 6).filter(isObject).map((entry) => ({
      key: str(entry.key, 20) ?? "", label: str(entry.label, 40) ?? "", level: entry.level === "urgent" ? ("urgent" as const) : ("attention" as const),
    })).filter((entry) => entry.key && entry.label),
  }));
  const q = isObject(raw.quality) ? raw.quality : {};
  const quality: SnapshotQuality = {
    tripsAt: str(q.tripsAt, 40), fleetAt: str(q.fleetAt, 40), fleetLive: bool(q.fleetLive), listingsLive: bool(q.listingsLive), listingsAt: str(q.listingsAt, 40),
    unpricedTrips: num(q.unpricedTrips), detailsPending: num(q.detailsPending), detailsFailed: num(q.detailsFailed), activeNoPlate: num(q.activeNoPlate),
    tollsAt: str(q.tollsAt, 40), invoicesMissing: num(q.invoicesMissing), invoicesTotal: num(q.invoicesTotal),
  };
  const tc = isObject(raw.topCar) ? raw.topCar : null;
  const topCar: TopCar | null = tc
    ? {
        name: str(tc.name, 100) ?? "Vehicle", plate: str(tc.plate, 20), total: num(tc.total), trips: num(tc.trips), perTrip: num(tc.perTrip),
        photo: url(tc.photo), photos: list(tc.photos, 3).map((photo) => url(photo)).filter((photo): photo is string => Boolean(photo)),
        runnersUp: list(tc.runnersUp, 2).filter(isObject).map((car) => ({ name: str(car.name, 100) ?? "Vehicle", plate: str(car.plate, 20), total: num(car.total) })),
      }
    : null;
  const weeks = list(model.earnings, 12).filter(isObject).map((bar) => ({
    from: num(bar.from), cents: num(bar.cents), trips: num(bar.trips), future: bool(bar.future),
  }));
  const billedRows = (rows: unknown): BilledRow[] =>
    list(rows, 250).filter(isObject).map((row) => ({
      tripId: str(row.tripId, 30) ?? "", guest: str(row.guest, 80), vehicle: str(row.vehicle, 100), cents: num(row.cents),
      billedAt: str(row.billedAt, 30), invoiceNumber: str(row.invoiceNumber, 30),
    }));
  const notBilledRows = (rows: unknown): NotBilledRow[] =>
    list(rows, 150).filter(isObject).map((row) => ({
      tripId: str(row.tripId, 30) ?? "", guest: str(row.guest, 80), vehicle: str(row.vehicle, 100), cents: num(row.cents),
      group: str(row.group, 20) ?? "other", why: str(row.why, 240) ?? "", endsAt: typeof row.endsAt === "number" ? row.endsAt : null,
    }));
  const tolls = isObject(raw.tolls)
    ? {
        at: str(raw.tolls.at, 40), toBill: num(raw.tolls.trips ?? raw.tolls.toBill), toBillCents: num(raw.tolls.cents ?? raw.tolls.toBillCents), running: num(raw.tolls.running),
        runningCents: num(raw.tolls.runningCents), looks: num(raw.tolls.looks), billedWeekTrips: num(raw.tolls.billedWeekTrips),
        billedWeekCents: num(raw.tolls.billedWeekCents), fileBilled: num(raw.tolls.fileBilled), fileTotal: num(raw.tolls.fileTotal),
        billedRows: billedRows(raw.tolls.billedRows), notBilledRows: notBilledRows(raw.tolls.notBilledRows),
      }
    : null;
  const unpriced = list(earnings.unpriced, 100).filter(isObject).map((row) => ({
    vehicle: str(row.vehicle, 100) ?? "Vehicle", plate: str(row.plate, 20), guest: str(row.guest, 80), ends: str(row.ends, 40) ?? "",
    reason: str(row.reason, 200) ?? "", guess: typeof row.guess === "number" ? row.guess : null,
  }));
  const cal = isObject(earnings.calendar) ? earnings.calendar : null;

  return {
    version: num(raw.version, SNAPSHOT_VERSION),
    builtAt: num(raw.builtAt),
    zone: str(raw.zone, 60) ?? "America/Denver",
    brand: str(raw.brand, 80), operator: str(raw.operator, 60), owner: str(raw.owner, 60),
    scannedAt: str(raw.scannedAt, 40),
    counts: { trips: num(isObject(raw.counts) ? raw.counts.trips : 0), vehicles: num(isObject(raw.counts) ? raw.counts.vehicles : 0) },
    kpis: {
      vehicles: num(kpis.vehicles), activeTrips: num(kpis.activeTrips), pickups: num(kpis.pickups), returns: num(kpis.returns),
      earningsNext30: num(kpis.earningsNext30), earningsLast30: num(kpis.earningsLast30), tripsNext30: num(kpis.tripsNext30),
    },
    greeting: str(model.greeting, 80) ?? "Welcome",
    attention, schedule,
    fleetSummary: {
      total: num(fleetSummary.total), onTrip: num(fleetSummary.onTrip), scheduled: num(fleetSummary.scheduled), available: num(fleetSummary.available),
      unlisted: num(fleetSummary.unlisted), needsAttention: num(fleetSummary.needsAttention),
    },
    unread, quality, topCar,
    fleet, tripLists: { active: tripRows(lists.active), pickups: tripRows(lists.pickups), returns: tripRows(lists.returns) }, weeks, tolls, unpriced,
    calendar: cal ? { fleet: num(cal.fleet), fresh: num(cal.fresh), needed: num(cal.needed), neededDone: num(cal.neededDone), complete: bool(cal.complete) } : null,
  };
}

/** How old the data is, in plain words, and whether to warn about it. */
export function freshness(builtAt: number, now: number): { label: string; stale: boolean } {
  if (!builtAt) return { label: "never", stale: true };
  const minutes = Math.max(0, Math.round((now - builtAt) / 60000));
  const label = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`;
  // The PC scans and sends every few minutes while it is on; more than 2 hours means it is off or logged out.
  return { label, stale: minutes > 120 };
}
