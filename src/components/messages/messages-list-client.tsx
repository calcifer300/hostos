"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { fetchJson, useLivePoll } from "@/lib/hooks/use-live-poll";
import type { GuestConversation } from "@/lib/messages/queries";

const POLL_INTERVAL_MS = 20_000;

/** "11:42 AM" / "Yesterday 4:18 PM" / "Aug 5 · 2:16 PM" — Turo's own preview-timestamp style. */
function formatPreviewTime(resolvedAt: string): string {
  const d = new Date(resolvedAt);
  const now = new Date();
  const clock = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const dayKey = d.toLocaleDateString("en-CA");
  const todayKey = now.toLocaleDateString("en-CA");
  const yesterdayKey = new Date(now.getTime() - 86_400_000).toLocaleDateString("en-CA");

  if (dayKey === todayKey) return clock;
  if (dayKey === yesterdayKey) return `Yesterday ${clock}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${clock}`;
}

/**
 * Full conversation list, live — polls the same endpoint the Overview
 * card does, so a guest's new message moves their thread to the top here
 * too without a manual refresh. Sort order is whatever getGuestConversations
 * already resolved server-side (real last-message time when the Inbox
 * scraper has one, see lib/messages/queries.ts) — this never re-sorts
 * client-side, so a poll can't visually reorder rows a differently than
 * the server would.
 */
export function MessagesListClient({ initialConversations }: { initialConversations: GuestConversation[] }) {
  const [conversations, setConversations] = React.useState(initialConversations);

  // Keeps showing what's already on screen when a poll fails, and backs off
  // instead of retrying a dead endpoint at full rate.
  useLivePoll<{ conversations?: GuestConversation[] }>({
    intervalMs: POLL_INTERVAL_MS,
    fetcher: async (signal) => {
      const data = await fetchJson<{ conversations?: GuestConversation[]; degraded?: boolean }>(
        "/api/turo/messages?limit=200",
        signal
      );
      // Degraded means the server couldn't read, not that the list is empty.
      if (data.degraded) throw new Error("Backend degraded");
      return data;
    },
    onData: (data) => {
      if (Array.isArray(data.conversations)) setConversations(data.conversations);
    },
  });

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          <MessageCircle className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No conversations synced yet</h2>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Pair the HostOS Companion extension to start pulling in guest message threads.
        </p>
        <Link
          href="/app/connectors"
          className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Open Connectors
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <AnimatePresence initial={false}>
        {conversations.map((c, i) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/app/messages/${encodeURIComponent(c.tripId)}`}
              className={
                "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50" +
                (i > 0 ? " border-t border-border" : "")
              }
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12.5px] font-medium text-accent">
                {c.guestName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-medium">
                    {c.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    <span className="truncate">{c.guestName}</span>
                    {c.vehicle && <span className="truncate font-normal text-muted-foreground"> · {c.vehicle}</span>}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatPreviewTime(c.resolvedAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {c.bookingStatus && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {c.bookingStatus}
                    </span>
                  )}
                  <p className="min-w-0 flex-1 truncate text-[12px] leading-relaxed text-muted-foreground">
                    {c.fromHost && <span className="text-muted-foreground/70">You: </span>}
                    {c.preview}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10.5px] text-muted-foreground/70">{c.messageCount}</span>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
