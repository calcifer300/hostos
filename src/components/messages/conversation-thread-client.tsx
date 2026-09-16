"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { fetchJson, useLivePoll } from "@/lib/hooks/use-live-poll";
import type { TripMessageThread } from "@/lib/messages/queries";

const POLL_INTERVAL_MS = 20_000;

/**
 * "8:35 PM" alone is ambiguous once a thread spans more than one day — the
 * real dateLabel Turo showed alongside it (see resolveMessageTimestamp)
 * disambiguates that without fabricating precision old canned-message rows
 * (no messageTime/dateLabel at all) don't actually have.
 */
function formatMessageTimestamp(m: { messageTime: string | null; dateLabel: string | null; syncedAt: string }): string {
  if (m.messageTime && m.dateLabel) return `${m.dateLabel} · ${m.messageTime}`;
  if (m.messageTime) return m.messageTime;
  return formatRelativeTime(m.syncedAt);
}

/**
 * Live thread view — polls this one reservation's messages so a new guest
 * reply appears without a manual refresh. Renders body text with
 * whitespace-pre-wrap (never touched here) so line breaks, bullets, and
 * emoji placement stay exactly as scraped — this never rewrites body text,
 * only decides bubble side/timestamp.
 */
export function ConversationThreadClient({ initialThread }: { initialThread: TripMessageThread }) {
  const [thread, setThread] = React.useState(initialThread);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const tripId = initialThread.tripId;

  // A failed poll leaves the thread as-is rather than blanking it; the loop
  // backs off and picks up again once the endpoint recovers.
  useLivePoll<{ thread?: TripMessageThread | null }>({
    intervalMs: POLL_INTERVAL_MS,
    fetcher: async (signal) => {
      const data = await fetchJson<{ thread?: TripMessageThread | null; degraded?: boolean }>(
        `/api/turo/messages/${encodeURIComponent(tripId)}`,
        signal
      );
      // Don't let an unreadable backend look like a thread that lost its
      // messages — back off and keep what's on screen.
      if (data.degraded) throw new Error("Backend degraded");
      return data;
    },
    onData: (data) => {
      if (data.thread) setThread(data.thread);
    },
  });

  if (thread.messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-[12.5px] text-muted-foreground">
        No messages synced for this trip yet. Once the Companion scrapes this conversation, it&rsquo;ll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {thread.messages.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn("flex", m.fromHost ? "justify-end" : "justify-start")}
          >
            <div className={cn("max-w-[80%] sm:max-w-md", m.fromHost ? "items-end" : "items-start", "flex flex-col")}>
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-[13px] leading-snug",
                  m.fromHost
                    ? "rounded-tr-sm bg-accent text-accent-foreground"
                    : "rounded-tl-sm border border-border bg-card"
                )}
              >
                {m.body}
              </div>
              <p className="mt-0.5 px-1 text-[10.5px] text-muted-foreground/85">
                {m.fromHost ? "Host" : thread.guestName}
                {" · "}
                {formatMessageTimestamp(m)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
