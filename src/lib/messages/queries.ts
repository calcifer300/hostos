import "server-only";
import { cache } from "react";
import { runQueryOr } from "@/lib/supabase/server";

export interface TripMessage {
  id: string;
  tripId: string;
  guestName: string | null;
  plate: string | null;
  body: string;
  fromHost: boolean;
  messageTime: string | null;
  dateLabel: string | null;
  syncedAt: string;
  /** Real timestamp when dateLabel+messageTime parsed cleanly; synced_at otherwise. */
  resolvedAt: string;
}

interface TripMessageRow {
  id: string;
  trip_id: string;
  guest_name: string | null;
  plate: string | null;
  body: string;
  from_host: boolean;
  message_time: string | null;
  date_label: string | null;
  synced_at: string;
}

function rowToMessage(row: TripMessageRow): TripMessage {
  return {
    id: row.id,
    tripId: row.trip_id,
    guestName: row.guest_name,
    plate: row.plate,
    body: row.body,
    fromHost: row.from_host,
    messageTime: row.message_time,
    dateLabel: row.date_label,
    syncedAt: row.synced_at,
    resolvedAt: resolveMessageTimestamp(row.date_label, row.message_time, row.synced_at),
  };
}

/**
 * The Inbox scraper (performSyncInbox/scrapeInboxThreadMessages in the
 * extension) captures a real "Thu, Aug 6, 2026" + "8:35 PM" caption per
 * message — unlike the older reservation-detail scraper, which has no
 * timestamp signal at all (see the ingest route's comment). synced_at is a
 * synthetic per-batch sequence number, not a real clock reading: two
 * conversations synced in the same cycle get synced_at values that only
 * reflect their position in that batch's array, not which one actually
 * happened more recently on Turo. Ordering by synced_at alone was
 * surfacing whichever reservation happened to scrape last, not the
 * genuinely newest conversation. Resolving a real timestamp here whenever
 * one is available fixes that; synced_at remains the fallback for rows
 * from the older, timestamp-less scraper.
 */
function resolveMessageTimestamp(dateLabel: string | null, messageTime: string | null, fallback: string): string {
  if (!dateLabel || !messageTime) return fallback;

  const dateOnly = new Date(dateLabel);
  if (isNaN(dateOnly.getTime())) return fallback;

  const timeMatch = messageTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!timeMatch) return fallback;

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  if (hour === 12) hour = 0;
  if (/PM/i.test(timeMatch[3])) hour += 12;

  const guessUtc = Date.UTC(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), hour, minute);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(guessUtc)).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10)
  );

  return new Date(guessUtc - (asUtc - guessUtc)).toISOString();
}

/**
 * One row per reservation thread, not per message — a guest who sent three
 * messages on the same trip is one conversation, not three list entries.
 * `unread` means the newest message in the thread came from the guest and
 * the host hasn't sent anything since — the same "needs a reply" signal
 * used to flag vehicles/trips elsewhere on the dashboard (see
 * lib/dashboard/queries.ts), so the two surfaces never disagree.
 */
export interface GuestConversation {
  id: string;
  tripId: string;
  guestName: string;
  vehicle: string;
  preview: string;
  fromHost: boolean;
  unread: boolean;
  messageTime: string | null;
  dateLabel: string | null;
  syncedAt: string;
  /** Real timestamp when dateLabel+messageTime parsed cleanly; synced_at otherwise. What conversations are actually sorted by. */
  resolvedAt: string;
  messageCount: number;
  /** Turo's own reservation status (e.g. "Upcoming pickup", "In progress") — null when the trip lookup has nothing to report. */
  bookingStatus: string | null;
}

interface TripLookupRow {
  id: string;
  guest_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plate: string | null;
  action: string | null;
  skip_reason: string | null;
}

/** Turo's own status for this reservation, as scraped — not a HostOS interpretation. */
function bookingStatusOf(trip: TripLookupRow | null | undefined): string | null {
  if (!trip) return null;
  if (trip.action === "checkin") return "Upcoming pickup";
  if (trip.action === "checkout") return "Checkout due";
  if (trip.skip_reason) return trip.skip_reason;
  return null;
}

const HOST_TIMEZONE = "America/Denver";

interface TripContextRow extends TripLookupRow {
  start_ts: string | null;
  end_ts: string | null;
  date_label: string | null;
  license_confirmed: boolean | null;
  license_status_text: string | null;
}

/** So a reply doesn't require tab-hopping to Operations to see when this trip actually starts/ends. */
export interface TripContext {
  nextEventLabel: string | null;
  licenseConfirmed: boolean | null;
  licenseStatusText: string | null;
}

function tripContextOf(trip: TripContextRow | null | undefined): TripContext | null {
  if (!trip) return null;

  const ts = trip.action === "checkin" ? trip.start_ts : trip.action === "checkout" ? trip.end_ts : null;
  const verb = trip.action === "checkin" ? "Picks up" : trip.action === "checkout" ? "Returns" : null;

  let nextEventLabel: string | null = null;
  if (verb) {
    if (ts) {
      nextEventLabel = `${verb} ${new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: HOST_TIMEZONE,
      })}`;
    } else if (trip.date_label) {
      // No real time synced yet — an honest date-only label rather than a guessed clock reading.
      nextEventLabel = `${verb} ${trip.date_label}`;
    }
  }

  return {
    nextEventLabel,
    licenseConfirmed: trip.license_confirmed,
    licenseStatusText: trip.license_status_text,
  };
}

interface HostMessagesAndTrips {
  messages: TripMessage[];
  tripById: Map<string, TripLookupRow>;
}

/**
 * Shared fetch behind getGuestConversations/getRecentGuestMessages — every
 * trip_messages row for this host plus a lookup of the trips they belong
 * to. No DB-level order() on the messages — synced_at is a synthetic
 * per-batch sequence, not a real clock reading (see
 * resolveMessageTimestamp), so callers sort by each row's resolved
 * timestamp themselves. Returns null on a real query error; a missing
 * table resolves to an empty result instead, same as every other query
 * module here.
 */
const loadHostMessages = cache(async function loadHostMessages(
  hostId: string,
  rowLimit = 600
): Promise<HostMessagesAndTrips | null> {
  // Both halves go through runQueryOr, which never rejects — so Promise.all
  // here can't turn one failed leg into an unhandled rejection that takes the
  // other down with it. Each leg degrades independently: messages without
  // trip context still render, they just show the bare plate.
  const [messages, trips] = await Promise.all([
    runQueryOr<TripMessageRow[]>("trip_messages.list", [], (client) =>
      client.from("trip_messages").select("*").eq("host_id", hostId).limit(rowLimit).returns<TripMessageRow[]>()
    ),
    runQueryOr<TripLookupRow[]>("trips.lookup", [], (client) =>
      client
        .from("trips")
        .select("id, guest_name, vehicle_make, vehicle_model, plate, action, skip_reason")
        .eq("host_id", hostId)
        .returns<TripLookupRow[]>()
    ),
  ]);

  // Only the messages leg is load-bearing: with no message rows there is no
  // conversation to show, and returning null (rather than an empty result)
  // keeps "we couldn't read this" distinct from "this host has no messages".
  if (messages.failure) return null;

  const tripById = new Map<string, TripLookupRow>(trips.data.map((t) => [t.id, t]));
  return { messages: messages.data.map(rowToMessage), tripById };
});

/**
 * Guest message threads, newest first, deduped to one row per reservation.
 * Enriches with the trip's real vehicle name (Companion's scraped
 * make/model, e.g. "Volkswagen Tiguan") instead of the bare plate a message
 * row carries on its own — the same display name the rest of the dashboard
 * uses, so a conversation and its vehicle card always match. Never throws.
 */
export async function getGuestConversations(hostId: string, limit = 30): Promise<GuestConversation[]> {
  try {
    const loaded = await loadHostMessages(hostId);
    if (!loaded) return [];

    const { tripById } = loaded;
    const allMessages = loaded.messages.sort(
      (a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime()
    );

    const countByTrip = new Map<string, number>();
    for (const row of allMessages) {
      countByTrip.set(row.tripId, (countByTrip.get(row.tripId) ?? 0) + 1);
    }

    const seenTrips = new Set<string>();
    const conversations: GuestConversation[] = [];

    for (const row of allMessages) {
      if (seenTrips.has(row.tripId)) continue;
      seenTrips.add(row.tripId);

      const trip = tripById.get(row.tripId);
      const vehicleName = trip ? [trip.vehicle_make, trip.vehicle_model].filter(Boolean).join(" ") : "";

      conversations.push({
        id: row.tripId,
        tripId: row.tripId,
        guestName: trip?.guest_name || row.guestName || "Guest",
        vehicle: vehicleName || row.plate || trip?.plate || "Vehicle",
        preview: row.body,
        fromHost: row.fromHost,
        unread: !row.fromHost,
        messageTime: row.messageTime,
        dateLabel: row.dateLabel,
        syncedAt: row.syncedAt,
        resolvedAt: row.resolvedAt,
        messageCount: countByTrip.get(row.tripId) ?? 1,
        bookingStatus: bookingStatusOf(trip),
      });

      if (conversations.length >= limit) break;
    }

    return conversations;
  } catch (err) {
    console.error("[messages] Unexpected error assembling guest conversations (not a connectivity issue — reads already degrade cleanly):", err);
    return [];
  }
}

export interface RecentGuestMessage {
  id: string;
  tripId: string;
  guestName: string;
  vehicle: string;
  body: string;
  resolvedAt: string;
  bookingStatus: string | null;
}

/**
 * Every guest-authored message (never the host's own replies) synced within
 * the past `windowHours`, across every trip — unlike getGuestConversations,
 * which dedupes to one row per trip and would hide something like a Tesla
 * access request or a lost-item mention if a later, unrelated message
 * became that thread's newest row. Feeds the Butler priority engine
 * (src/lib/butler/priority.ts), which scans this for guest asks that need
 * a human to act. Never throws.
 */
export async function getRecentGuestMessages(hostId: string, windowHours = 72): Promise<RecentGuestMessage[]> {
  try {
    const loaded = await loadHostMessages(hostId);
    if (!loaded) return [];

    const cutoff = Date.now() - windowHours * 3_600_000;

    return loaded.messages
      .filter((m) => !m.fromHost && new Date(m.resolvedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime())
      .map((m) => {
        const trip = loaded.tripById.get(m.tripId);
        const vehicleName = trip ? [trip.vehicle_make, trip.vehicle_model].filter(Boolean).join(" ") : "";
        return {
          id: m.id,
          tripId: m.tripId,
          guestName: trip?.guest_name || m.guestName || "Guest",
          vehicle: vehicleName || m.plate || trip?.plate || "Vehicle",
          body: m.body,
          resolvedAt: m.resolvedAt,
          bookingStatus: bookingStatusOf(trip),
        };
      });
  } catch (err) {
    console.error("[messages] Unexpected error assembling recent guest messages (not a connectivity issue):", err);
    return [];
  }
}

export interface TripMessageThread {
  tripId: string;
  guestName: string;
  vehicle: string;
  messages: TripMessage[];
  bookingStatus: string | null;
  context: TripContext | null;
}

/**
 * Every message on one reservation, oldest first — the raw thread, not the
 * latest-message-only preview getGuestConversations feeds the dashboard
 * card. Ordered by resolveMessageTimestamp's real dateLabel+messageTime
 * reading when the Inbox scraper captured one, falling back to synced_at
 * (a synthetic per-batch sequence, not a real clock reading) only for
 * rows from the older reservation-detail scraper, which has no timestamp
 * signal at all. Never throws.
 *
 * Returns null only when the trip itself is unknown (no `trips` row and no
 * message ever synced for it) — genuinely nothing to show. A real trip with
 * zero messages so far (e.g. Operations links every overdue return here,
 * including ones the Companion never scraped a conversation for) still
 * resolves, with an empty `messages` array, rather than 404ing a link the
 * app itself generated.
 */
export async function getTripMessageThread(hostId: string, tripId: string): Promise<TripMessageThread | null> {
  try {
    // Both legs are failure-tolerant (see loadHostMessages), so neither can
    // reject the pair. The thread still renders if only the trip-context leg
    // fails — it just loses the schedule/licence panel.
    const [messagesRes, tripRes] = await Promise.all([
      runQueryOr<TripMessageRow[]>("trip_messages.thread", [], (client) =>
        client
          .from("trip_messages")
          .select("*")
          .eq("host_id", hostId)
          .eq("trip_id", tripId)
          .returns<TripMessageRow[]>()
      ),
      runQueryOr<TripContextRow | null>("trips.context", null, (client) =>
        client
          .from("trips")
          .select(
            "id, guest_name, vehicle_make, vehicle_model, plate, action, skip_reason, start_ts, end_ts, date_label, license_confirmed, license_status_text"
          )
          .eq("host_id", hostId)
          .eq("id", tripId)
          .maybeSingle<TripContextRow>()
      ),
    ]);

    if (messagesRes.failure) return null;

    const messages = messagesRes.data
      .map(rowToMessage)
      .sort((a, b) => new Date(a.resolvedAt).getTime() - new Date(b.resolvedAt).getTime());

    const trip = tripRes.data;
    if (messages.length === 0 && !trip) return null;

    const vehicleName = trip ? [trip.vehicle_make, trip.vehicle_model].filter(Boolean).join(" ") : "";

    return {
      tripId,
      guestName: trip?.guest_name || messages[0]?.guestName || "Guest",
      vehicle: vehicleName || messages[0]?.plate || trip?.plate || "Vehicle",
      messages,
      bookingStatus: bookingStatusOf(trip),
      context: tripContextOf(trip),
    };
  } catch (err) {
    console.error("[messages] Unexpected error assembling a message thread (not a connectivity issue):", err);
    return null;
  }
}
