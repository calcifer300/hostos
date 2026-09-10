import { NextRequest, NextResponse } from "next/server";
import { resolveScheduleWallTime } from "@/lib/timezones";
import { ingestFailureResponse, requireCompanionHost } from "@/lib/api/companion-auth";
import { denyUnauthenticatedBrowserRequest } from "@/lib/api/browser-auth";
import { getCurrentHostId } from "@/lib/host/context";
import { getBackendHealth, isUndefinedTableError } from "@/lib/supabase/server";
import { getGuestConversations } from "@/lib/messages/queries";

/**
 * Guest message threads scraped from Turo reservation detail pages by the
 * Companion extension. Same bearer-pairing-key auth as /api/turo/sync — a
 * machine-to-machine endpoint the extension calls on its own timer, not
 * gated by the app's (intentionally optional) session.
 */

interface IncomingMessage {
  body?: string;
  time?: string | null;
  dateLabel?: string | null;
  fromHost?: boolean;
}

interface IncomingReservationMessages {
  reservation?: string;
  guestName?: string | null;
  plate?: string | null;
  messages?: IncomingMessage[];
  /**
   * Real pickup/return timestamps read straight off the reservation detail
   * page's own schedule fields (see scrapeReservationScheduleTimes in the
   * Companion extension's content.js) — a far more reliable source than the
   * trips-list card text the main /api/turo/sync payload depends on, which
   * Turo only renders a clock time on for reservations acting today. Either
   * side can be absent; each is applied to the trips row independently.
   */
  scheduleStartTs?: number | null;
  scheduleEndTs?: number | null;
  /**
   * The same two fields as the page PRINTED them — "Thu, Sep 10, 2026" and
   * "6:00 PM" — which is what actually gets used.
   *
   * The numerics above are resolved extension-side in Pacific, so on any
   * fleet outside that zone they land an hour or more off and overwrite a
   * correct value. Strings carry no zone assumption, so the server can
   * resolve them against the fleet's own.
   */
  scheduleStart?: { date?: string | null; time?: string | null } | null;
  scheduleEnd?: { date?: string | null; time?: string | null } | null;
}

interface MessagesPayload {
  reservations?: IncomingReservationMessages[];
}

/**
 * A NUL can't occur inside a scraped message body, which makes it a safe
 * separator for the (reservation, body) dedupe key.
 *
 * Built with `String.fromCharCode` rather than embedded directly: the two
 * call sites below used to carry a literal NUL byte in the source, which made
 * this file register as binary — `grep` skipped it entirely and diffs were
 * unreadable. The runtime value is identical.
 */
const KEY_SEPARATOR = String.fromCharCode(0);

function messageKey(tripId: string, body: string): string {
  return tripId + KEY_SEPARATOR + body;
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host, supabase } = auth.ctx;

  let payload: MessagesPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const reservations = Array.isArray(payload.reservations) ? payload.reservations : [];

  // Turo's reservation-instructions panel scrapes with no time/date signal
  // at all in practice (message_time/date_label come back null), which
  // means the table's (host_id, trip_id, body, message_time) unique
  // constraint can never match on resync — NULL is never equal to NULL in
  // Postgres, so upsert() silently inserted a fresh duplicate of every
  // message on every sync cycle instead of recognizing it'd been seen
  // before. Dedup on (trip_id, body) is done here, in application code,
  // against what's already stored, rather than depending on that
  // constraint at all.
  const batchTime = Date.now();
  let cursor = 0;

  const incoming = reservations.flatMap((r) => {
    if (typeof r?.reservation !== "string" || !r.reservation.trim()) return [];
    const messages = Array.isArray(r.messages) ? r.messages : [];

    return messages
      .filter((m): m is IncomingMessage & { body: string } => typeof m?.body === "string" && m.body.trim().length > 0)
      .map((m) => {
        // Messages arrive in scraped DOM order (oldest to newest, per
        // content.js's top-to-bottom avatar walk). synced_at has no other
        // reliable ordering signal available, so a message's position in
        // the batch becomes a millisecond offset — enough to keep the
        // thread in the order it was actually scraped, without requiring
        // message_time/date_label to be populated.
        const orderedAt = new Date(batchTime + cursor).toISOString();
        cursor += 1;
        return {
          host_id: host.id,
          trip_id: r.reservation as string,
          guest_name: r.guestName ?? null,
          plate: r.plate ?? null,
          body: m.body.trim(),
          from_host: Boolean(m.fromHost),
          message_time: m.time ?? null,
          date_label: m.dateLabel ?? null,
          synced_at: orderedAt,
        };
      });
  });

  /**
   * Refines a trip's start/end from its reservation detail page.
   *
   * THE WALL TIME WINS OVER THE EXTENSION'S NUMBER.
   *
   * The extension resolves its own timestamps in Pacific — every helper in it
   * does — and this patch writes straight over `start_ts` on a row
   * /api/turo/sync had already stored correctly in the FLEET's zone. On a
   * Denver fleet that moved every refreshed pickup an hour later, and it was
   * invisible because only the handful of reservations whose detail page had
   * been opened were affected: seven trips right, one wrong, same second.
   *
   * So the strings the page actually printed are resolved here, against the
   * fleet's timezone, exactly as the board is. The numeric is still accepted
   * so an extension that hasn't updated yet keeps working — it is just no
   * longer preferred.
   */
  const scheduleUpdates = reservations.flatMap((r) => {
    if (typeof r?.reservation !== "string" || !r.reservation.trim()) return [];

    const fromWall = (wall: { date?: string | null; time?: string | null } | null | undefined) =>
      wall?.date && wall?.time
        ? resolveScheduleWallTime(wall.date, wall.time, host.timezone)
        : null;

    const startIso = fromWall(r.scheduleStart) ??
      (typeof r.scheduleStartTs === "number" ? new Date(r.scheduleStartTs).toISOString() : null);
    const endIso = fromWall(r.scheduleEnd) ??
      (typeof r.scheduleEndTs === "number" ? new Date(r.scheduleEndTs).toISOString() : null);

    if (startIso === null && endIso === null) return [];
    return [{ tripId: r.reservation, startIso, endIso }];
  });

  if (incoming.length === 0 && scheduleUpdates.length === 0) {
    return NextResponse.json({ ok: true, messagesStored: 0 });
  }

  // Schedule timestamps are supplementary: they refine trips rows the main
  // /api/turo/sync payload already created. allSettled (not all) because one
  // reservation failing must not discard the message batch below, and because
  // an unsettled rejection here used to escape the try block further down
  // entirely — a database blip mid-request surfaced as a bare 500.
  let scheduleUpdated = 0;
  if (scheduleUpdates.length > 0) {
    const results = await Promise.allSettled(
      scheduleUpdates.map(async ({ tripId, startIso, endIso }) => {
        const patch: Record<string, string> = {};
        if (startIso !== null) patch.start_ts = startIso;
        if (endIso !== null) patch.end_ts = endIso;

        const { error } = await supabase.from("trips").update(patch).eq("host_id", host.id).eq("id", tripId);
        if (error) throw new Error(error.message);
      })
    );

    scheduleUpdated = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - scheduleUpdated;
    // These were previously dropped on the floor: supabase-js resolves with
    // an `error` rather than throwing, so nothing ever noticed them.
    if (failed > 0) {
      console.warn(`[turo/messages] ${failed}/${results.length} schedule updates failed; continuing with message ingest.`);
    }
  }

  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, messagesStored: 0, scheduleUpdated });
  }

  try {
    const tripIds = Array.from(new Set(incoming.map((row) => row.trip_id)));

    const { data: existingRows, error: fetchError } = await supabase
      .from("trip_messages")
      .select("trip_id, body")
      .eq("host_id", host.id)
      .in("trip_id", tripIds);

    if (fetchError) {
      if (isUndefinedTableError(fetchError)) {
        return NextResponse.json(
          {
            error: "The trip_messages table doesn't exist yet. Run supabase/migrations/0004_trip_messages.sql.",
            retryable: false,
          },
          { status: 503, headers: { "Retry-After": "300" } }
        );
      }
      return ingestFailureResponse("turo/messages", new Error(fetchError.message));
    }

    const seen = new Set((existingRows ?? []).map((r) => messageKey(r.trip_id, r.body)));
    const newRows = incoming.filter((row) => {
      const key = messageKey(row.trip_id, row.body);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (newRows.length === 0) {
      return NextResponse.json({ ok: true, messagesStored: 0, scheduleUpdated });
    }

    const { error: insertError } = await supabase.from("trip_messages").insert(newRows);
    if (insertError) {
      return ingestFailureResponse("turo/messages", new Error(insertError.message));
    }

    return NextResponse.json({ ok: true, messagesStored: newRows.length, scheduleUpdated });
  } catch (err) {
    return ingestFailureResponse("turo/messages", err);
  }
}

/**
 * Polled client-side by the Overview guest-messages card for a
 * near-real-time feed. This app is an intentionally public shell (no route
 * hard-gates on a session — see PROJECT_STATE.md), so this can't require a
 * signed-in user without breaking that model. What it can do is refuse
 * requests that didn't originate from a page load of this same app: modern
 * browsers attach `Sec-Fetch-Site` to every request, and same-origin
 * `fetch()` calls (the only legitimate caller) always report
 * "same-origin". A bare URL visit, a cross-site page, or a script hitting
 * this endpoint directly reports something else — that's the raw-JSON
 * guest-data exposure this used to allow with zero gate at all.
 */
export async function GET(req: NextRequest) {
  // Same-origin check plus a real session on hosted deployments — see
  // lib/api/browser-auth.ts for why the header alone was not a gate.
  const denied = await denyUnauthenticatedBrowserRequest(req);
  if (denied) return denied;

  const requested = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 30;

  const conversations = await getGuestConversations(await getCurrentHostId(), limit);

  // `conversations: []` is ambiguous on its own — it means both "no threads"
  // and "we couldn't read them". Without this flag the polling card kept a
  // green "Live" pulse over an empty list while the database was unreachable,
  // directly contradicting the outage banner above it.
  const degraded = getBackendHealth().state === "degraded";

  return NextResponse.json({ conversations, degraded });
}
