"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { REPLY_TEMPLATES, renderReplyTemplate } from "@/lib/knowledge/reply-templates";

/**
 * Straight from Colorado Cruisers' handbook, filled in with this
 * conversation's real guest/vehicle. Copy, then paste into Turo — HostOS
 * doesn't send guest messages itself, Turo stays the actual send channel.
 */
export function QuickReplies({ guestName, vehicle }: { guestName: string; vehicle: string }) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-[12.5px] font-medium">Quick replies</p>
      </div>
      <div className="p-1.5">
        {REPLY_TEMPLATES.map((template) => {
          const rendered = renderReplyTemplate(template, { guestName, vehicle });
          const open = openId === template.id;
          return (
            <div key={template.id} className="rounded-lg px-2.5 py-1">
              <div className="flex w-full items-center justify-between gap-2 py-1.5">
                <button
                  onClick={() => setOpenId(open ? null : template.id)}
                  className="flex-1 text-left text-[12.5px] font-medium transition-colors hover:text-accent"
                >
                  {template.label}
                </button>
                <CopyButton value={rendered} label={template.label} />
              </div>
              {open && (
                <p className="mb-1.5 whitespace-pre-wrap rounded-lg bg-muted/60 p-2.5 text-[12px] leading-relaxed text-muted-foreground">
                  {rendered}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
