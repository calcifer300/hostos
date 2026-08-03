"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { SyncedEmail } from "@/types/gmail";

export function InboxList({ messages }: { messages: SyncedEmail[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const isOpen = expandedId === m.id;
        const sender = m.fromName || m.fromEmail || "Unknown sender";

        return (
          <div
            key={m.id}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
          >
            <button
              onClick={() => setExpandedId(isOpen ? null : m.id)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[13px] font-medium text-accent">
                {sender.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {m.isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  <p
                    className={cn(
                      "truncate text-[13.5px]",
                      m.isUnread ? "font-semibold" : "font-medium"
                    )}
                  >
                    {sender}
                  </p>
                </div>
                <p className="truncate text-[13px] text-muted-foreground">
                  {m.subject || "(no subject)"}
                </p>
                {!isOpen && m.snippet && (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground/70">
                    {m.snippet}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                  {formatRelativeTime(m.receivedAt)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="whitespace-pre-wrap border-t border-border px-5 py-4 text-[13.5px] leading-relaxed text-foreground">
                    {m.body || m.snippet || "No content."}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
