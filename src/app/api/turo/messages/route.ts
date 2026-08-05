import { NextRequest, NextResponse } from "next/server";
import { getHostByApiKey, DEFAULT_HOST_ID } from "@/lib/host/queries";
import { getSupabaseAdmin, isUndefinedTableError } from "@/lib/supabase/server";
import { getRecentGuestMessages } from "@/lib/messages/queries";

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
}

interface MessagesPayload {
  reservations?: IncomingReservationMessages[];
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <pairing key> header." },
      { status: 401 }
    );
  }

  const host = await getHostByApiKey(token);
  if (!host) {
    return NextResponse.json({ error: "Invalid or unknown pairing key." }, { status: 401 });
  }

  let payload: MessagesPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const reservations = Array.isArray(payload.reservations) ? payload.reservations : [];

  const rows = reservations.flatMap((r) => {
    if (typeof r?.reservation !== "string" || !r.reservation.trim()) return [];
    const messages = Array.isArray(r.messages) ? r.messages : [];

    return messages
      .filter((m): m is IncomingMessage & { body: string } => typeof m?.body === "string" && m.body.trim().length > 0)
      .map((m) => ({
        host_id: host.id,
        trip_id: r.reservation as string,
        guest_name: r.guestName ?? null,
        plate: r.plate ?? null,
        body: m.body.trim(),
        from_host: Boolean(m.fromHost),
        message_time: m.time ?? null,
        date_label: m.dateLabel ?? null,
        synced_at: new Date().toISOString(),
      }));
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, messagesStored: 0 });
  }

  try {
    const { error } = await getSupabaseAdmin()
      .from("trip_messages")
      .upsert(rows, { onConflict: "host_id,trip_id,body,message_time" });

    if (error) {
      const message = isUndefinedTableError(error)
        ? "The trip_messages table doesn't exist yet. Run supabase/migrations/0004_trip_messages.sql."
        : `Failed to store messages: ${error.message}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, messagesStored: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Polled client-side by the Overview guest-messages card for a near-real-time feed. */
export async function GET() {
  const messages = await getRecentGuestMessages(DEFAULT_HOST_ID, 30);
  return NextResponse.json({ messages });
}
