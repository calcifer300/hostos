import "server-only";
import { getSyncedEmails } from "@/lib/gmail/queries";
import { buildReservations, filterToHost, parseEmails } from "@/lib/turo/parse";
import { DEFAULT_HOST_ID, getHost } from "@/lib/host/queries";
import { getCompanionTrips, getCompanionVehicles, type CompanionTrip, type CompanionVehicle } from "@/lib/trips/queries";
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
  reservations: TuroReservation[];
  events: TuroEvent[];
}

const HOUR_MS = 3_600_000;

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** "Picks up 4:45 PM" / "Returns tomorrow 10:00 AM" / "Returns Aug 6" — degrades gracefully as the date moves further out. */
function describeUpcoming(kind: "pickup" | "return", whenIso: string): string {
  const verb = kind === "pickup" ? "Picks up" : "Returns";
  if (isToday(whenIso)) return `${verb} ${formatClock(whenIso)}`;

  const when = new Date(whenIso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    when.getFullYear() === tomorrow.getFullYear() &&
    when.getMonth() === tomorrow.getMonth() &&
    when.getDate() === tomorrow.getDate();

  if (isTomorrow) return `${verb} tomorrow ${formatClock(whenIso)}`;
  return `${verb} ${when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
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

function urgencyFor(event: TuroEvent): MessageUrgency {
  const age = Date.now() - new Date(event.occurredAt).getTime();
  const text = `${event.subject ?? ""} ${event.snippet ?? ""}`;

  if (/\basap\b|\burgent\b|\bemergency\b|\bstranded\b|\baccident\b|\blocked out\b/i.test(text)) {
    return "high";
  }
  if (age < 2 * HOUR_MS) return "high";
  if (age < 12 * HOUR_MS) return "medium";
  return "low";
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

function computeFleetHealth(events: TuroEvent[], reservations: TuroReservation[]): FleetHealth {
  const unreadCount = events.filter((e) => e.isUnread).length;
  const activeReservations = reservations.filter((r) => r.status === "active").length;
  const pendingTrips = reservations.filter((r) => r.status === "upcoming").length;

  // Backlog = guest messages still unread after 2 hours. That's the number a
  // host actually feels, and it's the one thing here that maps to an SLA.
  const responseBacklog = events.filter(
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
      let priority: number;

      if (active) {
        status = "on_trip";
        nextEventLabel = active.endsAt ? describeUpcoming("return", active.endsAt) : null;
        priority = 0;
      } else if (upcoming) {
        status = "cleaning";
        nextEventLabel = describeUpcoming("pickup", upcoming.startsAt);
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
  if (t.action === "checkout" && t.endsAt) {
    return new Date(t.endsAt).getTime() - Date.now() <= ON_TRIP_WINDOW_MS;
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
function companionScheduleEntries(trips: CompanionTrip[], kind: "pickup" | "return"): ScheduleEntry[] {
  const wantAction = kind === "pickup" ? "checkin" : "checkout";

  return trips
    .filter((t) => t.action === wantAction)
    .map((t) => ({ t, when: kind === "pickup" ? t.startsAt : t.endsAt }))
    .filter((x): x is { t: CompanionTrip; when: string } => isToday(x.when))
    .map(({ t, when }) => ({
      id: `${kind}-${t.id}`,
      kind,
      guestName: t.guestName ?? "Guest",
      vehicle: companionVehicleName(t),
      time: formatClock(when),
      location: "HostOS Companion",
      // Companion has no "already prepped" signal — defaulting to "needs
      // prep" is the safer bias for an ops checklist than false confidence.
      ready: false,
    }))
    .sort((a, b) => new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime());
}

function buildCompanionVehicles(vehicles: CompanionVehicle[], trips: CompanionTrip[]): FleetVehicle[] {
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
    const nextPickup = tripsForPlate
      .filter((t): t is CompanionTrip & { startsAt: string } => t.action === "checkin" && !!t.startsAt)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
    // A checkout too far out to count as "on trip" (see isCompanionOnTrip)
    // is still worth showing — just as information, not urgency.
    const futureReturn = tripsForPlate
      .filter((t): t is CompanionTrip & { endsAt: string } => t.action === "checkout" && !!t.endsAt)
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0];

    let status: VehicleStatus;
    let nextEventLabel: string | null = null;
    let priority: number;

    if (onTripTrip) {
      status = "on_trip";
      nextEventLabel = onTripTrip.endsAt ? describeUpcoming("return", onTripTrip.endsAt) : null;
      priority = 0;
    } else if (nextPickup) {
      // No fuel/cleaning/maintenance signal comes from Companion yet — a
      // vehicle with a pickup on the books just isn't "on trip" yet.
      status = "available";
      nextEventLabel = describeUpcoming("pickup", nextPickup.startsAt);
      priority = isToday(nextPickup.startsAt) ? 1 : 2;
    } else if (futureReturn) {
      status = "available";
      nextEventLabel = describeUpcoming("return", futureReturn.endsAt);
      priority = 2;
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
      priority: d.priority,
    }))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
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
  health: FleetHealth
): Suggestion[] {
  const out: Suggestion[] = [];

  const oldestUnread = events
    .filter((e) => e.kind === "message" && e.isUnread)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())[0];

  if (oldestUnread) {
    out.push({
      id: `reply-${oldestUnread.id}`,
      title: `Reply to ${oldestUnread.guestName ?? "your oldest unread guest"}`,
      description: `Waiting since ${formatRelativeTime(oldestUnread.occurredAt)}. It's the longest-outstanding message in your inbox.`,
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
  const [allEmails, companionTrips, companionVehiclesRaw, host] = await Promise.all([
    userEmail ? getSyncedEmails(userEmail, 200) : Promise.resolve([]),
    getCompanionTrips(DEFAULT_HOST_ID),
    getCompanionVehicles(DEFAULT_HOST_ID),
    getHost(),
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
      reservations: [],
      events: [],
    };
  }

  const gmailReservations = hasGmail ? buildReservations(events) : [];

  const companionReservations = buildCompanionReservations(companionTrips);
  const companionPickups = companionScheduleEntries(companionTrips, "pickup");
  const companionReturns = companionScheduleEntries(companionTrips, "return");
  const companionVehicles = buildCompanionVehicles(companionVehiclesRaw, companionTrips);

  // Companion wins whenever it has an answer — see the module comment for why.
  const reservations = companionReservations.length > 0 ? companionReservations : gmailReservations;
  const pickups = companionPickups.length > 0 ? companionPickups : toScheduleEntries(gmailReservations, "pickup");
  const returns = companionReturns.length > 0 ? companionReturns : toScheduleEntries(gmailReservations, "return");
  const vehicles = companionVehicles.length > 0 ? companionVehicles : buildVehicles(events, gmailReservations);

  const fleetHealth = computeFleetHealth(events, reservations);

  return {
    hasSyncedData: true,
    fleetHealth,
    pickups,
    returns,
    messages: toAttentionMessages(events),
    activity: toActivity(events),
    suggestions: buildSuggestions(events, reservations, fleetHealth),
    timeline: buildTimeline(events),
    vehicles,
    reservations,
    events,
  };
}
