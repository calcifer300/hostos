import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";
import type { SyncedEmail } from "@/types/gmail";

interface SyncedEmailRow {
  id: string;
  user_email: string;
  thread_id: string | null;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string;
  is_unread: boolean;
  guest_name: string | null;
  vehicle: string | null;
  synced_at: string;
}

function rowToSyncedEmail(row: SyncedEmailRow): SyncedEmail {
  return {
    id: row.id,
    userEmail: row.user_email,
    threadId: row.thread_id,
    fromName: row.from_name,
    fromEmail: row.from_email,
    subject: row.subject,
    snippet: row.snippet,
    body: row.body,
    receivedAt: row.received_at,
    isUnread: row.is_unread,
    guestName: row.guest_name,
    vehicle: row.vehicle,
    syncedAt: row.synced_at,
  };
}

/**
 * These are called while rendering the dashboard and inbox, so they must
 * never throw: an unconfigured or un-migrated Supabase means "nothing
 * synced yet", not a broken page.
 */
export async function getSyncedEmails(userEmail: string, limit = 30): Promise<SyncedEmail[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("synced_emails")
      .select("*")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[gmail] Failed to load synced emails:", error.message);
      }
      return [];
    }

    return (data ?? []).map(rowToSyncedEmail);
  } catch (err) {
    console.error("[gmail] Failed to load synced emails:", err);
    return [];
  }
}

export async function getLatestUnreadEmail(userEmail: string): Promise<SyncedEmail | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("synced_emails")
      .select("*")
      .eq("user_email", userEmail)
      .eq("is_unread", true)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle<SyncedEmailRow>();

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[gmail] Failed to load the latest unread email:", error.message);
      }
      return null;
    }

    return data ? rowToSyncedEmail(data) : null;
  } catch (err) {
    console.error("[gmail] Failed to load the latest unread email:", err);
    return null;
  }
}
