"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/gmail/tokens";
import { listRecentMessageIds, fetchMessage } from "@/lib/gmail/client";
import { UpstreamResponseError, UpstreamUnavailableError } from "@/lib/http";

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

    // allSettled, not all: one message that Gmail 404s or times out used to
    // reject the whole batch, so a single unreadable email meant zero synced
    // messages. Partial progress is strictly better than none here.
    const settled = await Promise.allSettled(ids.map((id) => fetchMessage(accessToken, email, id)));
    const messages = settled
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchMessage>>> => r.status === "fulfilled")
      .map((r) => r.value);

    const skipped = settled.length - messages.length;
    if (skipped > 0) {
      console.warn(`[gmail] ${skipped}/${settled.length} messages could not be fetched; syncing the rest.`);
    }

    // Every message failing is an outage, not a partial sync — reporting
    // "ok: 0 synced" would read as "your inbox is empty".
    if (settled.length > 0 && messages.length === 0) {
      return { ok: false, error: "Couldn't read any messages from Gmail. Check the connection and try again." };
    }

    if (messages.length > 0) {
      const result = await runMutation("synced_emails.upsert", (client) =>
        client.from("synced_emails").upsert(
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
        )
      );

      if (!result.ok) {
        return { ok: false, error: `Fetched Gmail but couldn't save it. ${result.error}` };
      }
    }

    revalidatePath("/app");
    revalidatePath("/app/inbox");

    return { ok: true, count: messages.length };
  } catch (err) {
    // Named upstream errors already read well; anything else is summarised so
    // a raw `TypeError: fetch failed` never reaches the Inbox toast.
    if (err instanceof UpstreamUnavailableError) {
      return { ok: false, error: `${err.service} is unreachable right now. Try again in a moment.` };
    }
    if (err instanceof UpstreamResponseError) {
      return { ok: false, error: err.message };
    }
    console.error("[gmail] Sync failed:", err);
    return { ok: false, error: "Gmail sync failed. The problem has been logged." };
  }
}
