"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/gmail/tokens";
import { listRecentMessageIds, fetchMessage } from "@/lib/gmail/client";

export interface SyncGmailResult {
  ok: boolean;
  count?: number;
  error?: string;
}

export async function syncGmail(): Promise<SyncGmailResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "You must be signed in to sync Gmail." };
  }

  if (process.env.GMAIL_SYNC_ENABLED !== "true") {
    return {
      ok: false,
      error:
        "Gmail sync is turned off. Enable the Gmail API in Google Cloud, run the Supabase migration, then set GMAIL_SYNC_ENABLED=true in .env.local and sign in again.",
    };
  }

  try {
    const accessToken = await getValidAccessToken(email);
    const ids = await listRecentMessageIds(accessToken, 15);
    const messages = await Promise.all(ids.map((id) => fetchMessage(accessToken, email, id)));

    if (messages.length > 0) {
      const { error } = await getSupabaseAdmin().from("synced_emails").upsert(
        messages.map((m) => ({
          id: m.id,
          user_email: m.userEmail,
          thread_id: m.threadId,
          from_name: m.fromName,
          from_email: m.fromEmail,
          subject: m.subject,
          snippet: m.snippet,
          body: m.body,
          received_at: m.receivedAt,
          is_unread: m.isUnread,
          guest_name: m.guestName,
          vehicle: m.vehicle,
          synced_at: m.syncedAt,
        })),
        { onConflict: "id" }
      );

      if (error) {
        return { ok: false, error: `Fetched Gmail but failed to store in Supabase: ${error.message}` };
      }
    }

    revalidatePath("/");
    revalidatePath("/inbox");

    return { ok: true, count: messages.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gmail sync failed." };
  }
}
