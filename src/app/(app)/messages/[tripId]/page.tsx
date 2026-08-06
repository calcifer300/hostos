import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_HOST_ID } from "@/lib/host/queries";
import { getTripMessageThread } from "@/lib/messages/queries";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId: encodedTripId } = await params;
  const tripId = decodeURIComponent(encodedTripId);

  const thread = await getTripMessageThread(DEFAULT_HOST_ID, tripId);
  if (!thread) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/messages"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Messages
      </Link>

      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">{thread.guestName}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {thread.vehicle} &middot; {thread.messages.length}{" "}
          {thread.messages.length === 1 ? "message" : "messages"} &middot; Trip {thread.tripId}
        </p>
      </div>

      <div className="space-y-3">
        {thread.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.fromHost ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%]", m.fromHost ? "items-end" : "items-start", "flex flex-col")}>
              <div
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-[var(--shadow-card)]",
                  m.fromHost
                    ? "rounded-tr-sm bg-accent text-accent-foreground"
                    : "rounded-tl-sm border border-border bg-card"
                )}
              >
                {m.body}
              </div>
              <p className="mt-1 px-1 text-[11px] text-muted-foreground/70">
                {m.fromHost ? "Host" : thread.guestName}
                {" · "}
                {m.messageTime || formatRelativeTime(m.syncedAt)}
                {m.dateLabel ? ` · ${m.dateLabel}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
