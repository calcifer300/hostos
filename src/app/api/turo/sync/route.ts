import { NextRequest, NextResponse } from "next/server";
import { getHostByApiKey } from "@/lib/host/queries";
import { getSupabaseAdmin, isUndefinedTableError } from "@/lib/supabase/server";
import { diffTrip, type ExistingTripRow, type IncomingTrip } from "@/lib/trips/sync";

/**
 * Ingests a HostOS Companion sync payload. Authenticated by a bearer
 * pairing key (issued in Settings), not a session cookie — this is a
 * machine-to-machine endpoint the extension calls on a timer, so it does
 * its own auth rather than relying on the app's session gate (which is
 * intentionally optional/public — see Project Aurora Phase 1).
 */

interface FleetPayloadEntry {
  plate?: string;
  year?: string | null;
  color?: string | null;
  make?: string | null;
  model?: string | null;
  lockbox?: string | null;
  permit?: string | null;
}

interface SyncPayload {
  trips?: IncomingTrip[];
  fleet?: FleetPayloadEntry[];
}

const MIGRATION_HINT = "Run supabase/migrations/0003_trips.sql against your Supabase project.";

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

  let payload: SyncPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incomingTrips = Array.isArray(payload.trips) ? payload.trips : [];
  const fleet = Array.isArray(payload.fleet) ? payload.fleet : [];

  // Only reservation-bearing trips are tracked — mirrors the extension's
  // own tripWatch.js, which never guesses at trips it can't independently
  // identify across scans.
  const reservationBearing = incomingTrips.filter(
    (t): t is IncomingTrip => typeof t?.reservation === "string" && t.reservation.trim().length > 0
  );

  // The same reservation can legitimately appear twice in one scan — e.g.
  // once as a check-in card, once as a check-out card (see popup.js's own
  // dedup comments on the extension side). A single upsert() batch can't
  // apply itself to the same conflict key twice ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time"), so collapse to one entry per
  // reservation before anything downstream reads it. Last occurrence wins,
  // since a check-out card is a more current state than an earlier
  // check-in card for the same trip.
  const trackable = Array.from(
    new Map(reservationBearing.map((t) => [t.reservation, t])).values()
  );

  const supabase = getSupabaseAdmin();
  let eventsCreated = 0;

  try {
    const ids = trackable.map((t) => t.reservation);

    const { data: existingRows, error: fetchError } = ids.length
      ? await supabase
          .from("trips")
          .select("id, action, skip_reason, plate, date_label, start_ts, end_ts")
          .eq("host_id", host.id)
          .in("id", ids)
      : { data: [] as ExistingTripRow[], error: null };

    if (fetchError) {
      const message =
        isUndefinedTableError(fetchError)
          ? `The trips table doesn't exist yet. ${MIGRATION_HINT}`
          : `Failed to read existing trips: ${fetchError.message}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const existingById = new Map((existingRows ?? []).map((r) => [r.id, r as ExistingTripRow]));

    const eventRows = trackable
      .map((trip) => {
        const candidate = diffTrip(existingById.get(trip.reservation) ?? null, trip);
        return candidate
          ? {
              host_id: host.id,
              trip_id: trip.reservation,
              kind: candidate.kind,
              description: candidate.description,
              payload: candidate.payload,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (eventRows.length > 0) {
      const { error: eventError } = await supabase.from("trip_events").insert(eventRows);
      if (eventError) {
        console.error("[turo/sync] Failed to write trip_events:", eventError.message);
      } else {
        eventsCreated = eventRows.length;
      }
    }

    if (trackable.length > 0) {
      const tripRows = trackable.map((t) => ({
        id: t.reservation,
        host_id: host.id,
        guest_name: t.guestName ?? null,
        plate: t.plate ?? null,
        vehicle_make: t.vehicleMake ?? null,
        vehicle_model: t.vehicleModel ?? null,
        vehicle_year: t.vehicleYear ?? null,
        action: t.action ?? null,
        skip_reason: t.skipReason ?? null,
        start_ts: t.startTs ? new Date(t.startTs).toISOString() : null,
        end_ts: t.endTs ? new Date(t.endTs).toISOString() : null,
        date_label: t.dateLabel ?? null,
        extras: t.extras ?? [],
        raw: t,
        synced_at: new Date().toISOString(),
      }));

      const { error: tripError } = await supabase.from("trips").upsert(tripRows, { onConflict: "id" });
      if (tripError) {
        const message =
          isUndefinedTableError(tripError)
            ? `The trips table doesn't exist yet. ${MIGRATION_HINT}`
            : `Failed to store trips: ${tripError.message}`;
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const vehicleRows = fleet
      .filter((v): v is FleetPayloadEntry & { plate: string } => typeof v?.plate === "string" && v.plate.trim().length > 0)
      .map((v) => ({
        host_id: host.id,
        plate: v.plate.trim().toUpperCase(),
        year: v.year ?? null,
        color: v.color ?? null,
        make: v.make ?? null,
        model: v.model ?? null,
        lockbox: v.lockbox ?? null,
        permit: v.permit ?? null,
        updated_at: new Date().toISOString(),
      }));

    if (vehicleRows.length > 0) {
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .upsert(vehicleRows, { onConflict: "host_id,plate" });

      if (vehicleError) {
        console.error("[turo/sync] Failed to store vehicles:", vehicleError.message);
      } else {
        // The extension sends its complete current roster every sync, not a
        // partial update — so a previously-stored plate missing from this
        // payload has been retired/removed there (e.g. a former client's
        // fleet that shouldn't linger after the relationship ends). Prune
        // it rather than leaving upsert-only writes to accumulate stale
        // vehicles forever.
        const { data: existingVehicles } = await supabase
          .from("vehicles")
          .select("plate")
          .eq("host_id", host.id);

        const currentPlates = new Set(vehicleRows.map((v) => v.plate));
        const stalePlates = (existingVehicles ?? [])
          .map((v) => v.plate as string)
          .filter((plate) => !currentPlates.has(plate));

        if (stalePlates.length > 0) {
          const { error: pruneError } = await supabase
            .from("vehicles")
            .delete()
            .eq("host_id", host.id)
            .in("plate", stalePlates);

          if (pruneError) {
            console.error("[turo/sync] Failed to prune stale vehicles:", pruneError.message);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tripsProcessed: trackable.length,
      eventsCreated,
      // Small enough to return inline — lets the Companion popup show what
      // changed without a second round trip to list trip_events itself.
      events: eventRows.map((row) => ({ kind: row.kind, description: row.description })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
