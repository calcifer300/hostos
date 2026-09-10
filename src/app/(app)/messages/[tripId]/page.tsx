import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import { getCurrentHostId } from "@/lib/host/context";
import { getTripMessageThread } from "@/lib/messages/queries";
import { getTripRiskSignals, isPremierProtection } from "@/lib/trips/queries";
import { getBackendHealth } from "@/lib/supabase/server";
import { ConversationThreadClient } from "@/components/messages/conversation-thread-client";
import { DetailUnavailable } from "@/components/shell/detail-unavailable";
import { QuickReplies } from "@/components/messages/quick-replies";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId: encodedTripId } = await params;
  const tripId = decodeURIComponent(encodedTripId);

  const thread = await getTripMessageThread(await getCurrentHostId(), tripId);

  if (!thread) {
    // A null thread means either "no such trip" or "the read failed". Only the
    // first is a 404 — telling a host their live reservation doesn't exist
    // because the database blinked is much worse than saying so plainly.
    if (getBackendHealth().state !== "ok") {
      return (
        <DetailUnavailable
          backHref="/messages"
          backLabel="Messages"
          title="Can't load this conversation right now"
          description="HostOS can't reach its database, so this thread can't be read. Nothing has been lost — try again in a moment."
        />
      );
    }
    notFound();
  }

  // Fetched separately from the thread because these columns only exist after
  // migration 0008 — see getTripRiskSignals for why folding them into the main
  // trips select would blank the dashboard on an un-migrated install. A failure
  // here costs only the badges below.
  const risk = (await getTripRiskSignals(await getCurrentHostId())).get(tripId) ?? null;
  const premier = isPremierProtection(risk);

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/messages"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Messages
      </Link>

      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight">{thread.guestName}</h1>
          {thread.bookingStatus && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {thread.bookingStatus}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {thread.vehicle} &middot; {thread.messages.length}{" "}
          {thread.messages.length === 1 ? "message" : "messages"} &middot; Trip {thread.tripId}
        </p>
        {(thread.context?.nextEventLabel || thread.context?.licenseStatusText || risk) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            {thread.context?.nextEventLabel && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
                {thread.context.nextEventLabel}
              </span>
            )}
            {thread.context?.licenseStatusText && (
              <span
                className={
                  "flex items-center gap-1.5 " +
                  (thread.context.licenseConfirmed ? "text-success" : "text-warning")
                }
              >
                {thread.context.licenseConfirmed ? (
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {thread.context.licenseStatusText}
              </span>
            )}

            {/* Premier means a $0 out-of-pocket cap: damage can't be billed to
                this guest. Worth seeing while deciding how to reply, which is
                why it sits with the licence badge rather than on its own page. */}
            {premier && (
              <span className="flex items-center gap-1.5 text-danger">
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
                {risk?.protectionPlanName || "Premier"} &middot; $0 guest liability
              </span>
            )}

            {risk && risk.guestTripCount !== null && (
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" strokeWidth={1.75} />
                {/* "No ratings yet" is deliberately distinct from a low score —
                    an unrated guest is unknown, not bad. */}
                {risk.guestRating === null
                  ? "No ratings yet"
                  : `${risk.guestRating.toFixed(1)}★ from ${risk.guestRatingCount ?? 0} ${
                      risk.guestRatingCount === 1 ? "host" : "hosts"
                    }`}
                {` · ${risk.guestTripCount} ${risk.guestTripCount === 1 ? "trip" : "trips"}`}
                {risk.guestMemberSince ? ` · joined ${risk.guestMemberSince}` : ""}
              </span>
            )}
          </div>
        )}
      </div>

      <ConversationThreadClient initialThread={thread} />

      <QuickReplies guestName={thread.guestName} vehicle={thread.vehicle} />
    </div>
  );
}
