"use client";

import * as React from "react";
import { syncGmail } from "@/lib/actions/gmail";

const SYNC_INTERVAL_MS = 60_000;

/**
 * Gmail has no push channel into this app the way the Companion extension
 * does (it POSTs on its own timer) — someone has to actually call the
 * syncGmail server action for new mail to land in Supabase at all. Runs
 * only while mounted — AppShell only renders this when a Google account is
 * signed in — and already scoped to Turo's own sending domains server-side
 * (see TURO_SENDER_QUERY in lib/gmail/client.ts) so this never pulls in
 * the rest of a host's personal inbox. Paired with AutoRefresh, which
 * re-reads whatever this just wrote.
 */
export function GmailAutoSync() {
  React.useEffect(() => {
    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        await syncGmail();
      } catch {
        // Silent — the next tick tries again, same pattern as GuestMessagesCard's poll.
      }
    }

    tick();
    const interval = setInterval(tick, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
