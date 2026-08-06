import "server-only";
import { getSyncedEmails } from "@/lib/gmail/queries";
import { buildReservations, filterToHost, parseEmails } from "@/lib/turo/parse";
import { DEFAULT_HOST_ID, getHost } from "@/lib/host/queries";
import { getCompanionTrips, getCompanionVehicles, type CompanionTrip, type CompanionVehicle } from "@/lib/trips/queries";
import { getGuestConversations, type GuestConversation } from "@/lib/messages/queries";
import { formatRelativeTime } from "@/lib/utils";
import type { TuroEvent, TuroReservation } from "@/types/turo";

/**
 * Every dashboard widget is derived here — from synced Gmail and/or the
 * HostOS Companion extension's `trips`/`vehicles` tables. Nothing in this
 * module calls an AI provider — the dashboard must render fully with no AI
 * key configured. Only the AI briefing card talks to a model.
 *
 * Companion data is host_id-keyed (no Google account needed) and, where
 * present, is treated as authoritative over Gmail's heuristic subject-line
 * parsing — it comes from real scraped timestamps and plates, not guesses.
 * Gmail remains the only source for message content (Inbox, AI briefing,
 * Messages/Activity here), since Companion doesn't carry that.
 */

export type VehicleStatus = "on_trip" | "available" | "cleaning" | "maintenance";

export interface FleetVehicle {
  id: string;
  name: string;
  status: VehicleStatus;
  lastActivity: string | null;
  tripCount: number;
  /** e.g. "Returns 4:45 PM" / "Picks up tomorrow 10:00 AM" — null if nothing is scheduled. */
  nextEventLabel: string | null;
  /** Raw timestamp behind nextEventLabel — what the operations timeline groups/sorts by. Null if nothing is scheduled. */
  nextEventAt: string | null;
  nextEventKind: "pickup" | "return" | null;
  /** False when nextEventAt is a noon placeholder derived from a bare date label, not a real scraped time. */
  nextEventExact: boolean;
  /** True when the guest on this vehicle's active/next trip sent the last message and hasn't been replied to. */
  needsResponse: boolean;
  /** Lower sorts first: on-trip and soon-due vehicles ahead of idle ones. */
  priority: number;
}

export interface FleetHealth {
  score: number;
  unreadCount: number;
  activeReservations: number;
  pendingTrips: number;
  responseBacklog: number;
}

export interface ScheduleEntry {
  id: string;
  kind: "pickup" | "return";
  guestName: string;
  vehicle: string;
  time: string;
  location: string;
  ready: boolean;
  needsResponse: boolean;
}

export type MessageUrgency = "high" | "medium" | "low";

export interface AttentionMessage {
  id: string;
  guestName: string;
  vehicle: string;
  preview: string;
  urgency: MessageUrgency;
  receivedAgo: string;
}

export type ActivityKind = "booking" | "message" | "payment" | "review" | "maintenance";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  description: string;
  timeAgo: string;
}

export type SuggestionPriority = "high" | "medium" | "low";

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: SuggestionPriority;
  actionLabel: string;
}

export interface TimelineEvent {
  id: string;
  time: string;
  sortKey: number;
  kind: "pickup" | "return" | "message" | "maintenance";
  title: string;
  subtitle: string;
}

export interface OperationsVehicleEntry {
  id: string;
  vehicle: string;
  status: VehicleStatus;
  kind: "pickup" | "return";
  time: string;
  guestName: string | null;
  needsResponse: boolean;
}

/** One day's worth of the fleet operations board — see buildOperationsTimeline. */
export interface OperationsDay {
  dateKey: string;
  label: string;
  entries: OperationsVehicleEntry[];
}

export interface DashboardData {
  hasSyncedData: boolean;
  fleetHealth: FleetHealth;
  pickups: ScheduleEntry[];
  returns: ScheduleEntry[];
  messages: AttentionMessage[];
  activity: ActivityEntry[];
  suggestions: Suggestion[];
  timeline: TimelineEvent[];
  vehicles: FleetVehicle[];
  operationsTimeline: OperationsDay[];
  unscheduledVehicles: FleetVehicle[];
  /** Checkouts whose scheduled return time has already passed — any day, not just today. */
  overdueReturns: ScheduleEntry[];
  reservations: TuroReservation[];
  events: TuroEvent[];
}

const HOUR_MS = 3_600_000;

/**
 * The fleet operates on Colorado Cruisers' local clock, not the Node
 * process's system timezone — a server can run anywhere (UTC, a different
 * region entirely), and comparing raw Date getters against it silently
 * shifted "today" by hours and mislabeled pickup/return times. Every
 * day-boundary check and displayed clock time in this module goes through
 * this timezone so "today" means Denver's today, always.
 */
const HOST_TIMEZONE = "America/Denver";

/** "YYYY-MM-DD" in HOST_TIMEZONE — a stable, string-comparable day key. */
function hostDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: HOST_TIMEZONE });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return hostDateKey(iso) === hostDateKey(new Date().toISOString());
}

function isTomorrow(iso: string): boolean {
  const tomorrow = new Date(Date.now() + 24 * HOUR_MS).toISOString();
  return hostDateKey(iso) === hostDateKey(tomorrow);
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: HOST_TIMEZONE,
  });
}

function minutesOfDay(iso: string): number {
  const [h, m] = new Date(iso)
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: HOST_TIMEZONE })
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/**
 * "Picks up 4:45 PM" / "Returns tomorrow 10:00 AM" / "Returns Aug 6" —
 * degrades gracefully as the date moves further out. When `exact` is false
 * (the timestamp came from parseDateLabel's noon placeholder, not a real
 * scraped time — see below), the clock time is dropped rather than shown as
 * if it were real: "Returns tomorrow", not a fabricated "Returns tomorrow
 * 12:00 PM".
 */
function describeUpcoming(kind: "pickup" | "return", whenIso: string, exact = true): string {
  const verb = kind === "pickup" ? "Picks up" : "Returns";
  const day = isToday(whenIso)
    ? "today"
    : isTomorrow(whenIso)
      ? "tomorrow"
      : new Date(whenIso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: HOST_TIMEZONE });

  if (!exact) return `${verb} ${day}`;
  if (day === "today") return `${verb} ${formatClock(whenIso)}`;
  if (day === "tomorrow") return `${verb} tomorrow ${formatClock(whenIso)}`;
  return `${verb} ${day}`;
}

interface ResolvedWhen {
  iso: string;
  /** False when `iso` is a noon placeholder derived from a bare date label, not a real scraped timestamp. */
  exact: boolean;
}

/**
 * Companion doesn't always resolve a full timestamp for a trip — Turo's
 * list view sometimes only exposes a bare date like "8/6", not a time (see
 * PROJECT_STATE.md's note on the extension's date parsing). Falling back to
 * that raw label — parsed against the current year, anchored at noon UTC so
 * it lands on the same calendar day across any real-world host timezone —
 * means a trip with a known date but unknown time still shows up on the
 * right day instead of silently vanishing from "today's" pickups/returns.
 */
function parseDateLabel(label: string | null): string | null {
  if (!label) return null;
  const match = label.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let year = Number(hostDateKey(new Date().toISOString()).slice(0, 4));
  let candidate = Date.UTC(year, month - 1, day, 12, 0, 0);

  // A label naming a date more than ~a month in the past almost certainly
  // means "next year" (a December label syncing in early January), not a
  // stale trip that should have been pruned.
  if (candidate < Date.now() - 35 * 24 * HOUR_MS) {
    year += 1;
    candidate = Date.UTC(year, month - 1, day, 12, 0, 0);
  }

  return new Date(candidate).toISOString();
}

function resolveWhen(ts: string | null, dateLabel: string | null): ResolvedWhen | null {
  if (ts) return { iso: ts, exact: true };
  const fallback = parseDateLabel(dateLabel);
  return fallback ? { iso: fallback, exact: false } : null;
}

/**
 * Today's pickups and returns come from parsed reservation boundaries, not
 * from email kind — Turo states the trip window in the booking footer that
 * rides along with every message about that trip.
 */
function toScheduleEntries(
  reservations: TuroReservation[],
  kind: "pickup" | "return"
): ScheduleEntry[] {
  return reservations
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({ r, when: kind === "pickup" ? r.startsAt : r.endsAt }))
    .filter((x): x is { r: TuroReservation; when: string } => isToday(x.when))
    .map(({ r, when }) => ({
      id: `${kind}-${r.id}`,
      kind,
      guestName: r.guestName ?? "Guest",
      vehicle: r.vehicle ?? "Vehicle",
      time: formatClock(when),
      // Turo emails don't carry a pickup location; inventing one would be
      // worse than showing where the record came from.
      location: "From Gmail",
      // Any unread mail on the trip means it hasn't been acknowledged.
      ready: !r.events.some((e) => e.isUnread),
      needsResponse: r.events.some((e) => e.isUnread),
    }))
    .sort((a, b) => new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime());
}

/**
 * Turo prefixes subjects with the listing owner, e.g.
 * "(MATTHEW's vehicle) - Daniel has sent you a message". That prefix is the
 * same on every email and just eats horizontal space.
 */
export function cleanSubject(subject: string | null): string {
  if (!subject) return "";
  return subject
    .replace(/\s+/g, " ")
    .replace(/^\([^)]*\)\s*[-–—:]\s*/, "")
    .trim();
}

/** Drops an immediately repeated leading phrase ("X sent you a message X sent you a message …"). */
function dropRepeatedPrefix(text: string): string {
  const limit = Math.min(140, Math.floor(text.length / 2));
  for (let i = 10; i <= limit; i++) {
    const head = text.slice(0, i).trim().toLowerCase();
    const next = text.slice(i, i * 2).trim().toLowerCase();
    if (head && head === next) {
      return text.slice(i).replace(/^[\s.·:-]+/, "");
    }
  }
  return text;
}

/**
 * Gmail snippets open with the preheader, which for Turo repeats the subject
 * — often twice. Strip that so the preview shows what the host hasn't
 * already read in the title.
 */
function toPreview(event: TuroEvent): string {
  const snippet = (event.snippet ?? "").replace(/\s+/g, " ").trim();
  const subject = cleanSubject(event.subject);
  if (!snippet) return subject || "(no preview)";

  let rest = dropRepeatedPrefix(snippet);

  if (subject) {
    while (rest.toLowerCase().startsWith(subject.toLowerCase())) {
      rest = rest.slice(subject.length).replace(/^[\s.·:-]+/, "");
    }
  }

  // Turo appends the booking summary to every message body. Cut at the first
  // footer marker so the preview is the guest's actual words.
  const footer = rest.search(/\s(?:Reply\s+Booked trip|Booked trip|Trip start)\b/i);
  if (footer > 0) rest = rest.slice(0, footer);

  return rest.trim() || snippet;
}

const URGENT_KEYWORDS = /\basap\b|\burgent\b|\bemergency\b|\bstranded\b|\baccident\b|\blocked out\b/i;

function urgencyFromAge(ageMs: number, text: string): MessageUrgency {
  if (URGENT_KEYWORDS.test(text)) return "high";
  if (ageMs < 2 * HOUR_MS) return "high";
  if (ageMs < 12 * HOUR_MS) return "medium";
  return "low";
}

function urgencyFor(event: TuroEvent): MessageUrgency {
  const age = Date.now() - new Date(event.occurredAt).getTime();
  return urgencyFromAge(age, `${event.subject ?? ""} ${event.snippet ?? ""}`);
}

function toAttentionMessages(events: TuroEvent[]): AttentionMessage[] {
  return events
    .filter((e) => e.kind === "message" && e.isUnread)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      guestName: e.guestName ?? "Guest",
      vehicle: e.vehicle ?? "—",
      preview: toPreview(e),
      urgency: urgencyFor(e),
      receivedAgo: formatRelativeTime(e.occurredAt),
    }));
}

/**
 * Companion has no "read" timestamp — synced_at (when the extension last
 * pulled this thread) is the best age signal available, so urgency and
 * "received ago" both key off it rather than the raw scraped time-of-day
 * string, which carries no date.
 */
function companionAttentionMessages(conversations: GuestConversation[]): AttentionMessage[] {
  return conversations
    .filter((c) => c.unread)
    .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      guestName: c.guestName,
      vehicle: c.vehicle,
      preview: c.preview,
      urgency: urgencyFromAge(Date.now() - new Date(c.syncedAt).getTime(), c.preview),
      receivedAgo: formatRelativeTime(c.syncedAt),
    }));
}

const ACTIVITY_KIND: Partial<Record<TuroEvent["kind"], ActivityKind>> = {
  booking: "booking",
  message: "message",
  payment: "payment",
  review: "review",
  verification: "maintenance",
  cancellation: "booking",
  pickup: "booking",
  return: "booking",
};

function describe(event: TuroEvent): string {
  const guest = event.guestName ?? "A guest";
  const vehicle = event.vehicle ? ` · ${event.vehicle}` : "";

  switch (event.kind) {
    case "booking":
      return `New booking from ${guest}${vehicle}`;
    case "pickup":
      return `Trip started with ${guest}${vehicle}`;
    case "return":
      return `Trip ended with ${guest}${vehicle}`;
    case "cancellation":
      return `${guest} cancelled${vehicle}`;
    case "review":
      return `${guest} left a review${vehicle}`;
    case "payment":
      return cleanSubject(event.subject) || "Payment activity";
    case "verification":
      return `${guest} completed verification`;
    case "message":
      return `${guest} sent a message${vehicle}`;
    default:
      return cleanSubject(event.subject) || "Gmail activity";
  }
}

function toActivity(events: TuroEvent[]): ActivityEntry[] {
  return events
    .slice()
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      kind: ACTIVITY_KIND[e.kind] ?? "message",
      description: describe(e),
      timeAgo: formatRelativeTime(e.occurredAt),
    }));
}

/**
 * Companion wins here too, same as pickups/returns/vehicles — a host with
 * no Gmail connected still has real unread guest messages via Companion,
 * and Fleet Health showing "0 unread" while Guest Messages shows otherwise
 * is exactly the cross-card disagreement this app can't afford.
 */
function computeFleetHealth(
  events: TuroEvent[],
  reservations: TuroReservation[],
  companionConversations: GuestConversation[]
): FleetHealth {
  const hasCompanionMessages = companionConversations.length > 0;
  const unreadConversations = companionConversations.filter((c) => c.unread);

  const unreadCount = hasCompanionMessages
    ? unreadConversations.length
    : events.filter((e) => e.isUnread).length;

  const activeReservations = reservations.filter((r) => r.status === "active").length;
  const pendingTrips = reservations.filter((r) => r.status === "upcoming").length;

  // Backlog = guest messages still unread after 2 hours. That's the number a
  // host actually feels, and it's the one thing here that maps to an SLA.
  const responseBacklog = hasCompanionMessages
    ? unreadConversations.filter((c) => Date.now() - new Date(c.syncedAt).getTime() > 2 * HOUR_MS).length
    : events.filter(
        (e) =>
          e.kind === "message" &&
          e.isUnread &&
          Date.now() - new Date(e.occurredAt).getTime() > 2 * HOUR_MS
      ).length;

  // Start at 100 and deduct for things needing attention, so an empty inbox
  // reads as healthy rather than as a suspiciously perfect hardcoded number.
  const score = Math.max(
    0,
    Math.min(100, 100 - responseBacklog * 8 - Math.max(0, unreadCount - 3) * 2)
  );

  return { score, unreadCount, activeReservations, pendingTrips, responseBacklog };
}

function buildVehicles(events: TuroEvent[], reservations: TuroReservation[]): FleetVehicle[] {
  const names = new Map<string, TuroEvent[]>();

  for (const event of events) {
    if (!event.vehicle) continue;
    const bucket = names.get(event.vehicle);
    if (bucket) bucket.push(event);
    else names.set(event.vehicle, [event]);
  }

  return Array.from(names.entries())
    .map(([name, vehicleEvents]) => {
      const sorted = vehicleEvents.sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
      const vehicleReservations = reservations.filter((r) => r.vehicle === name);
      const active = vehicleReservations.find((r) => r.status === "active");
      const upcoming = vehicleReservations
        .filter((r): r is TuroReservation & { startsAt: string } => r.status === "upcoming" && !!r.startsAt)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

      let status: VehicleStatus;
      let nextEventLabel: string | null = null;
      let nextEventAt: string | null = null;
      let nextEventKind: "pickup" | "return" | null = null;
      let priority: number;

      if (active) {
        status = "on_trip";
        if (active.endsAt) {
          nextEventLabel = describeUpcoming("return", active.endsAt);
          nextEventAt = active.endsAt;
          nextEventKind = "return";
        }
        priority = 0;
      } else if (upcoming) {
        status = "cleaning";
        nextEventLabel = describeUpcoming("pickup", upcoming.startsAt);
        nextEventAt = upcoming.startsAt;
        nextEventKind = "pickup";
        priority = isToday(upcoming.startsAt) ? 1 : 2;
      } else {
        status = "available";
        priority = 3;
      }

      return {
        id: name,
        name,
        status,
        lastActivity: sorted[0]?.occurredAt ?? null,
        tripCount: vehicleReservations.length,
        nextEventLabel,
        nextEventAt,
        nextEventKind,
        // Gmail always carries a real parsed timestamp, never a bare date label.
        nextEventExact: true,
        // Gmail-derived vehicles have no trip_messages join to key off —
        // only Companion vehicles (see buildCompanionVehicles) can know this.
        needsResponse: false,
        priority,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

/**
 * Companion doesn't send a stable per-vehicle id, only plate/make/model —
 * this builds the same "display name as join key" convention the Gmail
 * side already uses across vehicles/reservations/the [vehicle] detail page.
 * Known limitation: two vehicles that share a make+model with no distinct
 * plate signal collapse to one name, same pre-existing limitation the
 * Gmail-only version already had.
 */
function companionVehicleName(t: { plate: string | null; vehicleMake?: string | null; vehicleModel?: string | null; make?: string | null; model?: string | null }): string {
  const make = "vehicleMake" in t ? t.vehicleMake : t.make;
  const model = "vehicleModel" in t ? t.vehicleModel : t.model;
  return [make, model].filter(Boolean).join(" ").trim() || t.plate || "Vehicle";
}

function isCompanionCancelled(t: CompanionTrip): boolean {
  return t.action === "skip" && !!t.skipReason && /cancell?ed/i.test(t.skipReason);
}

/** How far out a checkout can be and still count as "currently out" rather than a booking that hasn't started. */
const ON_TRIP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * `action: "checkout"` means "this reservation's next scraped event is a
 * checkout" — it does NOT mean the trip has actually started. Companion
 * doesn't send a start time for checkout-classified entries, so a return
 * date months out (a booking that simply hasn't begun yet) would otherwise
 * be indistinguishable from a vehicle genuinely out right now. Using
 * return-date proximity as a stand-in: due back within a few days reads as
 * active, due back in December does not.
 */
function isCompanionOnTrip(t: CompanionTrip): boolean {
  if (t.action === "skip" && t.skipReason && /^(started|in progress)/i.test(t.skipReason)) return true;
  if (t.action === "checkout") {
    const resolved = resolveWhen(t.endsAt, t.dateLabel);
    if (resolved) return new Date(resolved.iso).getTime() - Date.now() <= ON_TRIP_WINDOW_MS;
  }
  return false;
}

function companionStatus(t: CompanionTrip): TuroReservation["status"] {
  if (isCompanionCancelled(t)) return "cancelled";
  if (isCompanionOnTrip(t)) return "active";
  // "checkin" (upcoming pickup) or an unrecognized action both read as
  // upcoming — there's no "completed with no further action" signal here.
  return "upcoming";
}

function buildCompanionReservations(trips: CompanionTrip[]): TuroReservation[] {
  return trips.map((t) => ({
    id: t.id,
    guestName: t.guestName,
    vehicle: companionVehicleName(t),
    status: companionStatus(t),
    // Companion records when a trip was first synced, not when it was
    // originally booked — leaving this null is more honest than guessing.
    bookedAt: null,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    events: [],
  }));
}

/**
 * `action` already encodes which list a trip currently sits in on Turo's
 * page ("checkin" = today/tomorrow's upcoming check-ins, "checkout" =
 * upcoming check-outs) — that plus a same-day timestamp is a more precise
 * "today" filter than Gmail's inferred trip dates.
 */
function companionScheduleEntries(
  trips: CompanionTrip[],
  kind: "pickup" | "return",
  unreadTripIds: Set<string>
): ScheduleEntry[] {
  const wantAction = kind === "pickup" ? "checkin" : "checkout";

  return trips
    .filter((t) => t.action === wantAction)
    .map((t) => ({ t, resolved: resolveWhen(kind === "pickup" ? t.startsAt : t.endsAt, t.dateLabel) }))
    .filter((x): x is { t: CompanionTrip; resolved: ResolvedWhen } => x.resolved !== null && isToday(x.resolved.iso))
    .sort((a, b) => new Date(a.resolved.iso).getTime() - new Date(b.resolved.iso).getTime())
    .map(({ t, resolved }) => ({
      id: `${kind}-${t.id}`,
      kind,
      guestName: t.guestName ?? "Guest",
      vehicle: companionVehicleName(t),
      // Real scraped time when Companion has one; an honest "Time TBD"
      // rather than a fabricated clock reading when it only has a date.
      time: resolved.exact ? formatClock(resolved.iso) : "Time TBD",
      location: "HostOS Companion",
      // Companion has no "already prepped" signal — defaulting to "needs
      // prep" is the safer bias for an ops checklist than false confidence.
      ready: false,
      needsResponse: unreadTripIds.has(t.id),
    }));
}

/**
 * A checkout is "overdue" the instant its scheduled return time is in the
 * past — including ones the day-scoped `returns` list already dropped
 * because they weren't dated "today" (a return due yesterday that never
 * got marked back is exactly the thing a host needs surfaced, not silently
 * excluded for falling outside a one-day window).
 */
function companionOverdueReturns(trips: CompanionTrip[], unreadTripIds: Set<string>): ScheduleEntry[] {
  const now = Date.now();
  const todayKey = hostDateKey(new Date().toISOString());

  return trips
    .map((t) => ({ t, resolved: resolveWhen(t.endsAt, t.dateLabel) }))
    .filter((x): x is { t: CompanionTrip; resolved: ResolvedWhen } => {
      if (x.t.action !== "checkout" || !x.resolved || isCompanionCancelled(x.t)) return false;
      if (x.resolved.exact) return new Date(x.resolved.iso).getTime() < now;
      // No real time to compare against "now" — only call a date-label-only
      // trip overdue once its labeled day has fully passed, not merely
      // "sometime today" with an unknown hour.
      return hostDateKey(x.resolved.iso) < todayKey;
    })
    .sort((a, b) => new Date(a.resolved.iso).getTime() - new Date(b.resolved.iso).getTime())
    .map(({ t, resolved }) => ({
      id: `overdue-${t.id}`,
      kind: "return" as const,
      guestName: t.guestName ?? "Guest",
      vehicle: companionVehicleName(t),
      time:
        resolved.exact && isToday(resolved.iso)
          ? formatClock(resolved.iso)
          : new Date(resolved.iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: HOST_TIMEZONE }),
      location: "HostOS Companion",
      ready: false,
      needsResponse: unreadTripIds.has(t.id),
    }));
}

function buildCompanionVehicles(
  vehicles: CompanionVehicle[],
  trips: CompanionTrip[],
  unreadTripIds: Set<string>
): FleetVehicle[] {
  const byPlate = new Map<string, CompanionVehicle | null>();
  for (const v of vehicles) byPlate.set(v.plate, v);
  for (const t of trips) {
    if (t.plate && !byPlate.has(t.plate)) byPlate.set(t.plate, null);
  }

  const draft = Array.from(byPlate.entries()).map(([plate, v]) => {
    const tripsForPlate = trips.filter((t) => t.plate === plate);
    const baseName = v ? companionVehicleName(v) : tripsForPlate[0] ? companionVehicleName(tripsForPlate[0]) : plate;
    const lastTripSync = tripsForPlate
      .map((t) => t.syncedAt)
      .sort()
      .at(-1);

    const onTripTrip = tripsForPlate.find(isCompanionOnTrip);
    const onTripResolved = onTripTrip ? resolveWhen(onTripTrip.endsAt, onTripTrip.dateLabel) : null;

    const nextPickup = tripsForPlate
      .map((t) => ({ t, resolved: t.action === "checkin" ? resolveWhen(t.startsAt, t.dateLabel) : null }))
      .filter((x): x is { t: CompanionTrip; resolved: ResolvedWhen } => x.resolved !== null)
      .sort((a, b) => new Date(a.resolved.iso).getTime() - new Date(b.resolved.iso).getTime())[0];

    // A checkout too far out to count as "on trip" (see isCompanionOnTrip)
    // is still worth showing — just as information, not urgency.
    const futureReturn = tripsForPlate
      .map((t) => ({ t, resolved: t.action === "checkout" ? resolveWhen(t.endsAt, t.dateLabel) : null }))
      .filter((x): x is { t: CompanionTrip; resolved: ResolvedWhen } => x.resolved !== null)
      .sort((a, b) => new Date(a.resolved.iso).getTime() - new Date(b.resolved.iso).getTime())[0];

    let status: VehicleStatus;
    let nextEventLabel: string | null = null;
    let nextEventAt: string | null = null;
    let nextEventKind: "pickup" | "return" | null = null;
    let nextEventExact = true;
    let priority: number;
    let relevantTripId: string | null = null;

    if (onTripTrip) {
      status = "on_trip";
      if (onTripResolved) {
        nextEventLabel = describeUpcoming("return", onTripResolved.iso, onTripResolved.exact);
        nextEventAt = onTripResolved.iso;
        nextEventKind = "return";
        nextEventExact = onTripResolved.exact;
      }
      priority = 0;
      relevantTripId = onTripTrip.id;
    } else if (nextPickup) {
      // No fuel/cleaning/maintenance signal comes from Companion yet — a
      // vehicle with a pickup on the books just isn't "on trip" yet.
      status = "available";
      nextEventLabel = describeUpcoming("pickup", nextPickup.resolved.iso, nextPickup.resolved.exact);
      nextEventAt = nextPickup.resolved.iso;
      nextEventKind = "pickup";
      nextEventExact = nextPickup.resolved.exact;
      priority = isToday(nextPickup.resolved.iso) ? 1 : 2;
      relevantTripId = nextPickup.t.id;
    } else if (futureReturn) {
      status = "available";
      nextEventLabel = describeUpcoming("return", futureReturn.resolved.iso, futureReturn.resolved.exact);
      nextEventAt = futureReturn.resolved.iso;
      nextEventKind = "return";
      nextEventExact = futureReturn.resolved.exact;
      priority = 2;
      relevantTripId = futureReturn.t.id;
    } else {
      status = "available";
      priority = 3;
    }

    return {
      plate,
      baseName,
      status,
      lastActivity: lastTripSync ?? v?.updatedAt ?? null,
      tripCount: tripsForPlate.length,
      nextEventLabel,
      nextEventAt,
      nextEventKind,
      nextEventExact,
      needsResponse: relevantTripId !== null && unreadTripIds.has(relevantTripId),
      priority,
    };
  });

  // Disambiguate vehicles that share a display name (e.g. two Mazda
  // CX-50s) by appending the plate — otherwise they'd collide on both the
  // card label and the /fleet/[vehicle] URL they'd link to.
  const nameCounts = new Map<string, number>();
  for (const d of draft) nameCounts.set(d.baseName, (nameCounts.get(d.baseName) ?? 0) + 1);

  return draft
    .map((d) => ({
      id: d.plate,
      name: (nameCounts.get(d.baseName) ?? 0) > 1 ? `${d.baseName} · ${d.plate}` : d.baseName,
      status: d.status,
      lastActivity: d.lastActivity,
      tripCount: d.tripCount,
      nextEventLabel: d.nextEventLabel,
      nextEventAt: d.nextEventAt,
      nextEventKind: d.nextEventKind,
      nextEventExact: d.nextEventExact,
      needsResponse: d.needsResponse,
      priority: d.priority,
    }))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

/**
 * Re-projects `vehicles` (already the single source of truth for status and
 * scheduling) into a day-by-day operations board — Today, Tomorrow, then
 * "August 8" etc. — instead of the flat, priority-sorted list that made the
 * fleet grid look shuffled rather than chronological. Vehicles with nothing
 * scheduled aren't forced into a day bucket; callers should show those
 * separately (see DashboardData.unscheduledVehicles).
 */
function buildOperationsTimeline(vehicles: FleetVehicle[]): OperationsDay[] {
  const days = new Map<string, { dateKey: string; label: string; entries: (OperationsVehicleEntry & { sortAt: string })[] }>();

  for (const v of vehicles) {
    if (!v.nextEventAt || !v.nextEventKind) continue;

    const dateKey = hostDateKey(v.nextEventAt);
    let day = days.get(dateKey);
    if (!day) {
      const label = isToday(v.nextEventAt)
        ? "Today"
        : isTomorrow(v.nextEventAt)
          ? "Tomorrow"
          : new Date(v.nextEventAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              timeZone: HOST_TIMEZONE,
            });
      day = { dateKey, label, entries: [] };
      days.set(dateKey, day);
    }

    day.entries.push({
      id: v.id,
      vehicle: v.name,
      status: v.status,
      kind: v.nextEventKind,
      // Real scraped time when we have one; an honest "Time TBD" rather
      // than a fabricated clock reading when only a date label synced.
      time: v.nextEventExact ? formatClock(v.nextEventAt) : "Time TBD",
      guestName: null,
      needsResponse: v.needsResponse,
      sortAt: v.nextEventAt,
    });
  }

  return Array.from(days.values())
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(({ entries, ...day }) => ({
      ...day,
      entries: entries
        .sort((a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime())
        .map((entry): OperationsVehicleEntry => ({
          id: entry.id,
          vehicle: entry.vehicle,
          status: entry.status,
          kind: entry.kind,
          time: entry.time,
          guestName: entry.guestName,
          needsResponse: entry.needsResponse,
        })),
    }));
}

function buildTimeline(events: TuroEvent[]): TimelineEvent[] {
  return events
    .filter((e) => ["pickup", "return", "message"].includes(e.kind))
    .filter((e) => isToday(e.tripStartsAt ?? e.occurredAt))
    .map((e): TimelineEvent => {
      const when = e.tripStartsAt ?? e.occurredAt;
      const kind: TimelineEvent["kind"] =
        e.kind === "pickup" ? "pickup" : e.kind === "return" ? "return" : "message";
      return {
        id: e.id,
        time: formatClock(when),
        sortKey: minutesOfDay(when),
        kind,
        title: [e.guestName, e.vehicle].filter(Boolean).join(" · ") || "Gmail event",
        subtitle: cleanSubject(e.subject),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);
}

/** Deterministic, rule-based prompts. Intentionally not AI-generated. */
function buildSuggestions(
  events: TuroEvent[],
  reservations: TuroReservation[],
  health: FleetHealth,
  companionConversations: GuestConversation[]
): Suggestion[] {
  const out: Suggestion[] = [];

  const oldestUnreadConversation = companionConversations
    .filter((c) => c.unread)
    .sort((a, b) => new Date(a.syncedAt).getTime() - new Date(b.syncedAt).getTime())[0];

  const oldestUnreadEmail = events
    .filter((e) => e.kind === "message" && e.isUnread)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())[0];

  if (oldestUnreadConversation) {
    out.push({
      id: `reply-${oldestUnreadConversation.id}`,
      title: `Reply to ${oldestUnreadConversation.guestName || "your oldest unread guest"}`,
      description: `Waiting since ${formatRelativeTime(oldestUnreadConversation.syncedAt)}. It's the longest-outstanding conversation in Guest Messages.`,
      priority: health.responseBacklog > 0 ? "high" : "medium",
      actionLabel: "Open messages",
    });
  } else if (oldestUnreadEmail) {
    out.push({
      id: `reply-${oldestUnreadEmail.id}`,
      title: `Reply to ${oldestUnreadEmail.guestName ?? "your oldest unread guest"}`,
      description: `Waiting since ${formatRelativeTime(oldestUnreadEmail.occurredAt)}. It's the longest-outstanding message in your inbox.`,
      priority: health.responseBacklog > 0 ? "high" : "medium",
      actionLabel: "Open inbox",
    });
  }

  const nextTrip = reservations
    .filter((r) => r.status === "upcoming" && r.startsAt)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())[0];

  if (nextTrip) {
    out.push({
      id: `prep-${nextTrip.id}`,
      title: `Prepare ${nextTrip.vehicle ?? "the next vehicle"}`,
      description: `Next trip${nextTrip.guestName ? ` with ${nextTrip.guestName}` : ""} is coming up. Confirm the car is cleaned and ready.`,
      priority: "medium",
      actionLabel: "View reservation",
    });
  }

  const completedNoReview = reservations.find(
    (r) => r.status === "completed" && !r.events.some((e) => e.kind === "review")
  );

  if (completedNoReview) {
    out.push({
      id: `review-${completedNoReview.id}`,
      title: "Ask for a review",
      description: `${completedNoReview.guestName ?? "A recent guest"} finished a trip with no review yet.`,
      priority: "low",
      actionLabel: "Send nudge",
    });
  }

  return out.slice(0, 3);
}

const EMPTY_HEALTH: FleetHealth = {
  score: 100,
  unreadCount: 0,
  activeReservations: 0,
  pendingTrips: 0,
  responseBacklog: 0,
};

/**
 * Single entry point for every dashboard page. Reads synced Gmail (when a
 * Google account is connected) and the Companion extension's trips/vehicles
 * (host_id-keyed, no Google account required) and derives every widget from
 * whichever is present. Never throws — an unsynced, un-migrated, or
 * not-yet-connected install renders empty states, not an error page.
 */
export async function getDashboardData(userEmail: string | null): Promise<DashboardData> {
  const [allEmails, companionTrips, companionVehiclesRaw, host, companionConversations] = await Promise.all([
    userEmail ? getSyncedEmails(userEmail, 200) : Promise.resolve([]),
    getCompanionTrips(DEFAULT_HOST_ID),
    getCompanionVehicles(DEFAULT_HOST_ID),
    getHost(),
    getGuestConversations(DEFAULT_HOST_ID, 200),
  ]);

  // The inbox this syncs is a general Gmail account, not a Turo-only one —
  // anything from another sender (a forum notification, a newsletter) can
  // sit in it too. classify()'s keyword rules are loose enough that
  // unrelated mail can coincidentally match a "message" pattern (e.g. any
  // email containing the word "replied"), so filtering by sender domain
  // happens here, first, before any classification runs — content-based
  // matching alone isn't a reliable enough gate on its own.
  const emails = allEmails.filter((e) => {
    const addr = (e.fromEmail ?? "").toLowerCase();
    return addr.endsWith("@turo.com") || addr.includes(".turo.com");
  });

  // Filtered by host ownership marker before anything downstream sees it —
  // an inbox that's been reused across host relationships can still hold a
  // previous client's emails (see filterToHost's own comment for why).
  // Guarded against the migration's generic seed name ("Host") — filtering
  // on that would exclude every real event, since it won't match any
  // actual "(NAME's vehicle)" marker. Filtering only activates once the
  // host record has been given a real name.
  const hostNameForFilter = host?.name && host.name !== "Host" ? host.name : null;
  const events = filterToHost(emails.length > 0 ? parseEmails(emails) : [], hostNameForFilter);
  const hasGmail = events.length > 0;
  const hasCompanion = companionTrips.length > 0 || companionVehiclesRaw.length > 0;

  if (!hasGmail && !hasCompanion) {
    return {
      hasSyncedData: false,
      fleetHealth: EMPTY_HEALTH,
      pickups: [],
      returns: [],
      messages: [],
      activity: [],
      suggestions: [],
      timeline: [],
      vehicles: [],
      operationsTimeline: [],
      unscheduledVehicles: [],
      overdueReturns: [],
      reservations: [],
      events: [],
    };
  }

  const gmailReservations = hasGmail ? buildReservations(events) : [];
  const unreadTripIds = new Set(companionConversations.filter((c) => c.unread).map((c) => c.tripId));

  const companionReservations = buildCompanionReservations(companionTrips);
  const companionPickups = companionScheduleEntries(companionTrips, "pickup", unreadTripIds);
  const companionReturns = companionScheduleEntries(companionTrips, "return", unreadTripIds);
  const companionVehicles = buildCompanionVehicles(companionVehiclesRaw, companionTrips, unreadTripIds);

  // Companion wins whenever it has an answer — see the module comment for why.
  const reservations = companionReservations.length > 0 ? companionReservations : gmailReservations;
  const pickups = companionPickups.length > 0 ? companionPickups : toScheduleEntries(gmailReservations, "pickup");
  const returns = companionReturns.length > 0 ? companionReturns : toScheduleEntries(gmailReservations, "return");
  const vehicles = companionVehicles.length > 0 ? companionVehicles : buildVehicles(events, gmailReservations);
  const messages =
    companionConversations.length > 0 ? companionAttentionMessages(companionConversations) : toAttentionMessages(events);

  const fleetHealth = computeFleetHealth(events, reservations, companionConversations);

  return {
    hasSyncedData: true,
    fleetHealth,
    pickups,
    returns,
    messages,
    activity: toActivity(events),
    suggestions: buildSuggestions(events, reservations, fleetHealth, companionConversations),
    timeline: buildTimeline(events),
    vehicles,
    operationsTimeline: buildOperationsTimeline(vehicles),
    unscheduledVehicles: vehicles.filter((v) => !v.nextEventAt),
    overdueReturns: companionOverdueReturns(companionTrips, unreadTripIds),
    reservations,
    events,
  };
}
