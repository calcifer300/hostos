"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import type { TripMessage } from "@/lib/messages/queries";

const POLL_INTERVAL_MS = 20_000;

/**
 * Raw guest messages, newest first — no AI involved anywhere in this card.
 * Polls /api/turo/messages (GET) on an interval for a near-real-time feed
 * without standing up a websocket/SSE server for it.
 */
export function GuestMessagesCard({ initialMessages }: { initialMessages: TripMessage[] }) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [lastPolledAt, setLastPolledAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/turo/messages", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        setLastPolledAt(new Date());
      } catch {
        // Silent — the next tick tries again. A failed poll shouldn't
        // replace real messages on screen with an error state.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <DashboardCard
      icon={MessageCircle}
      title="Guest messages"
      action={
        <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      }
      className="h-full"
    >
      {messages.length === 0 ? (
        <CardEmptyState message="No guest messages synced yet. Pair the HostOS Companion extension from Connectors to start pulling these in." />
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className="-mx-1.5 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13.5px] font-medium">
                  {m.guestName || "Guest"}
                  {m.plate && <span className="text-muted-foreground"> &middot; {m.plate}</span>}
                </p>
                {m.messageTime && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {m.messageTime}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      )}
      {lastPolledAt && (
        <p className="mt-3 text-[11px] text-muted-foreground/60">
          Checked {lastPolledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </DashboardCard>
  );
}
