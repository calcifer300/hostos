import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { DEFAULT_HOST_ID } from "@/lib/host/queries";
import { getGuestConversations } from "@/lib/messages/queries";

/**
 * Every reservation thread the Companion extension has synced, raw —
 * guest messages and host/co-host replies exactly as scraped, not
 * summarized. The Overview dashboard's Guest Messages card only ever shows
 * the latest message per conversation; this is the full list, and each row
 * opens the complete back-and-forth at /messages/[tripId].
 */
export default async function MessagesPage() {
  const conversations = await getGuestConversations(DEFAULT_HOST_ID, 200);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Every guest conversation synced through the HostOS Companion, raw and unfiltered.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <MessageCircle className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No conversations synced yet</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Pair the HostOS Companion extension to start pulling in guest message threads.
          </p>
          <Link
            href="/connectors"
            className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Open Connectors
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${encodeURIComponent(c.tripId)}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-accent/40 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[13.5px] font-medium text-accent">
                {c.guestName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[14px] font-medium">
                    {c.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    <span className="truncate">{c.guestName}</span>
                    {c.vehicle && (
                      <span className="truncate text-muted-foreground"> &middot; {c.vehicle}</span>
                    )}
                  </p>
                  {c.messageTime && (
                    <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                      {c.messageTime}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  {c.fromHost && <span className="text-muted-foreground/70">You: </span>}
                  {c.preview}
                </p>
              </div>
              <span className="shrink-0 text-[11.5px] text-muted-foreground/70">
                {c.messageCount} {c.messageCount === 1 ? "message" : "messages"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
