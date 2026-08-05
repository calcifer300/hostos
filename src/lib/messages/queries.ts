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
 * Newest guest-sent messages (host's own replies excluded — this feeds a
 * "what needs a response" view, not a full transcript). Called while
 * rendering the dashboard, so it must never throw.
 */
export async function getRecentGuestMessages(hostId: string, limit = 30): Promise<TripMessage[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trip_messages")
      .select("*")
      .eq("host_id", hostId)
      .eq("from_host", false)
      .order("synced_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[messages] Failed to load guest messages:", error.message);
      }
      return [];
    }

    return (data ?? []).map(rowToMessage);
  } catch (err) {
    console.error("[messages] Failed to load guest messages:", err);
    return [];
  }
}
