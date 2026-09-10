"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { fetchJson, useLivePoll } from "@/lib/hooks/use-live-poll";
import type { GuestConversation } from "@/lib/messages/queries";

const POLL_INTERVAL_MS = 20_000;

/**
 * One row per reservation thread (never per message — see
 * lib/messages/queries.ts's getGuestConversations for the dedup), newest
 * first. No AI involved anywhere in this card. Polls /api/turo/messages
 * (GET) on an interval for a near-real-time feed without standing up a
 * websocket/SSE server for it.
 */
export function GuestMessagesCard({ initialMessages }: { initialMessages: GuestConversation[] }) {
  const [conversations, setConversations] = React.useState(initialMessages);

  // A failed poll never clears what's already on screen — stale messages beat
  // an empty card. The status indicator below is what tells the host that
  // what they're looking at may no longer be current.
  const { status, lastSuccessAt } = useLivePoll<{ conversations?: GuestConversation[] }>({
    intervalMs: POLL_INTERVAL_MS,
    fetcher: async (signal) => {
      const data = await fetchJson<{ conversations?: GuestConversation[]; degraded?: boolean }>(
        "/api/turo/messages",
        signal
      );
      // The endpoint answers 200 with an empty list when the read failed, so
      // treat a degraded response as a failed poll: back off, show the real
      // status, and don't overwrite good data with an empty array.
      if (data.degraded) throw new Error("Backend degraded");
      return data;
    },
    onData: (data) => {
      if (Array.isArray(data.conversations)) setConversations(data.conversations);
    },
  });

  const lastPolledAt = lastSuccessAt;
  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <DashboardCard
      icon={MessageCircle}
      title="Guest messages"
      action={
        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">
              {unreadCount} unread
            </span>
          )}
          {/* Reflects the poll loop's real state. A fixed green "Live" pulse
              kept claiming freshness while every request was failing. */}
          <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              {status === "live" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  status === "live" ? "bg-success" : status === "reconnecting" ? "bg-warning" : "bg-muted-foreground"
                )}
              />
            </span>
            {status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline"}
          </span>
          <Link href="/messages" className="text-[12px] font-medium text-accent hover:opacity-80">
            View all &rarr;
          </Link>
        </div>
      }
      className="h-full"
    >
      {conversations.length === 0 ? (
        <CardEmptyState
          icon={MessageCircle}
          message="No guest messages synced yet. Pair the HostOS Companion extension from Connectors to start pulling these in."
        />
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {conversations.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/messages/${encodeURIComponent(c.tripId)}`}
                  className="group -mx-1.5 block rounded-lg px-1.5 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-medium">
                      {c.unread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                      )}
                      <span className="truncate">
                        {c.guestName}
                        {c.vehicle && <span className="text-muted-foreground"> &middot; {c.vehicle}</span>}
                      </span>
                    </p>
                    {c.messageTime && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {c.messageTime}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 flex items-start gap-1 text-[12.5px] leading-relaxed text-muted-foreground",
                      c.unread && "text-foreground/80"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {c.fromHost && <span className="text-muted-foreground/70">You: </span>}
                      {c.preview}
                    </span>
                    <CopyButton
                      value={c.preview}
                      label="message"
                      className="mt-0.5 opacity-0 group-hover:opacity-100"
                    />
                  </p>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
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
