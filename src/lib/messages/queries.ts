import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";

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
  };
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
  messageCount: number;
}

interface TripLookupRow {
  id: string;
  guest_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plate: string | null;
}

/**
 * Guest message threads, newest first, deduped to one row per reservation.
 * Enriches with the trip's real vehicle name (Companion's scraped
 * make/model, e.g. "Volkswagen Tiguan") instead of the bare plate a message
 * row carries on its own — the same display name the rest of the dashboard
 * uses, so a conversation and its vehicle card always match. Never throws.
 */
export async function getGuestConversations(hostId: string, limit = 30): Promise<GuestConversation[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const [messagesRes, tripsRes] = await Promise.all([
      getSupabaseAdmin()
        .from("trip_messages")
        .select("*")
        .eq("host_id", hostId)
        .order("synced_at", { ascending: false })
        .limit(400),
      getSupabaseAdmin()
        .from("trips")
        .select("id, guest_name, vehicle_make, vehicle_model, plate")
        .eq("host_id", hostId),
    ]);

    if (messagesRes.error) {
      if (!isUndefinedTableError(messagesRes.error)) {
        console.error("[messages] Failed to load guest conversations:", messagesRes.error.message);
      }
      return [];
    }

    const tripById = new Map<string, TripLookupRow>(
      (tripsRes.data ?? []).map((t: TripLookupRow) => [t.id, t])
    );

    const allMessages = (messagesRes.data ?? []).map(rowToMessage);
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
        messageCount: countByTrip.get(row.tripId) ?? 1,
      });

      if (conversations.length >= limit) break;
    }

    return conversations;
  } catch (err) {
    console.error("[messages] Failed to load guest conversations:", err);
    return [];
  }
}

export interface TripMessageThread {
  tripId: string;
  guestName: string;
  vehicle: string;
  messages: TripMessage[];
}

/**
 * Every message on one reservation, oldest first — the raw thread, not the
 * latest-message-only preview getGuestConversations feeds the dashboard
 * card. Ordered by synced_at, which the ingest route (see
 * api/turo/messages/route.ts) assigns as a synthetic per-batch sequence
 * matching scraped DOM order, since Companion doesn't reliably capture a
 * real per-message timestamp. Never throws.
 */
export async function getTripMessageThread(hostId: string, tripId: string): Promise<TripMessageThread | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const [messagesRes, tripRes] = await Promise.all([
      getSupabaseAdmin()
        .from("trip_messages")
        .select("*")
        .eq("host_id", hostId)
        .eq("trip_id", tripId)
        .order("synced_at", { ascending: true }),
      getSupabaseAdmin()
        .from("trips")
        .select("id, guest_name, vehicle_make, vehicle_model, plate")
        .eq("host_id", hostId)
        .eq("id", tripId)
        .maybeSingle<TripLookupRow>(),
    ]);

    if (messagesRes.error) {
      if (!isUndefinedTableError(messagesRes.error)) {
        console.error("[messages] Failed to load thread:", messagesRes.error.message);
      }
      return null;
    }

    const messages = (messagesRes.data ?? []).map(rowToMessage);
    if (messages.length === 0) return null;

    const trip = tripRes.data;
    const vehicleName = trip ? [trip.vehicle_make, trip.vehicle_model].filter(Boolean).join(" ") : "";

    return {
      tripId,
      guestName: trip?.guest_name || messages[0].guestName || "Guest",
      vehicle: vehicleName || messages[0].plate || trip?.plate || "Vehicle",
      messages,
    };
  } catch (err) {
    console.error("[messages] Failed to load thread:", err);
    return null;
  }
}
