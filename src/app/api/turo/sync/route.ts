import { NextRequest, NextResponse } from "next/server";
import { ingestFailureResponse, requireCompanionHost } from "@/lib/api/companion-auth";
import { isUndefinedTableError } from "@/lib/supabase/server";
import {
  diffTrip,
  mergeIncomingTrips,
  resolveTripTimestamp,
  type ExistingTripRow,
  type IncomingTrip,
} from "@/lib/trips/sync";

/**
 * Ingests a HostOS Companion sync payload. Authenticated by a bearer
 * pairing key (issued in Settings), not a session cookie — this is a
 * machine-to-machine endpoint the extension calls on a timer, so it does
 * its own auth rather than relying on the app's session gate (which is
 * intentionally optional/public — see Project Aurora Phase 1).
 */

interface FleetPayloadEntry {
  plate?: string;
  /** Fleet-calendar nightly prices, index 0 = calendarScannedAt. See migration 0010. */
  dailyPrices?: number[] | null;
  bookedDayFlags?: boolean[] | null;
  calendarScannedAt?: string | null;
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

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host, supabase } = auth.ctx;

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

  // One reservation produces TWO cards on Turo's Booked list — one under its
  // start date, one under its end date — and a single upsert() batch cannot
  // touch the same conflict key twice, so they must be collapsed before the
  // write. They are MERGED rather than deduped: see mergeReservationCards for
  // what last-wins cost, which was every pickup on the board.
  const trackable = mergeIncomingTrips(reservationBearing, new Date(), host.timezone);

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
      const tripRows = trackable.map((t) => {
        // Both halves come from the merge, each resolved against its own
        // date label. The fallback covers a card that carried no label at all.
        const derivedTs = resolveTripTimestamp(t.dateLabel, t.time, host.timezone);
        const merged = existingById.get(t.reservation) ?? null;

        const startTs = t.resolvedStartTs ?? (t.action === "checkin" ? derivedTs : null);
        const endTs = t.resolvedEndTs ?? (t.action === "checkout" ? derivedTs : null);

        // NEVER null a timestamp this scan simply did not see.
        //
        // The board only reaches a few weeks out, so a trip whose pickup has
        // scrolled off it arrives as a check-out card alone. Writing null for
        // the missing half would erase a start time that was correct, and the
        // row would silently stop being a pickup that ever happened.
        const finalStart = startTs ?? merged?.start_ts ?? null;
        const finalEnd = endTs ?? merged?.end_ts ?? null;

        return {
          id: t.reservation,
          host_id: host.id,
          guest_name: t.guestName ?? null,
          plate: t.plate ?? null,
          vehicle_make: t.vehicleMake ?? null,
          vehicle_model: t.vehicleModel ?? null,
          vehicle_year: t.vehicleYear ?? null,
          action: t.action ?? null,
          skip_reason: t.skipReason ?? null,
          start_ts: finalStart,
          end_ts: finalEnd,
          date_label: t.dateLabel ?? null,
          // Stored so the board can render each trip in its own wall time
          // without re-deriving it (migration 0014).
          timezone: host.timezone,
          extras: t.extras ?? [],
          raw: t,
          synced_at: new Date().toISOString(),
        };
      });

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
        // Only written when the calendar actually produced them — a vehicle
        // synced from a hand-entered roster has no prices, and overwriting a
        // previous scan with null would silently un-price its trips.
        ...(Array.isArray(v.dailyPrices) ? { daily_prices: v.dailyPrices } : {}),
        ...(Array.isArray(v.bookedDayFlags) ? { booked_day_flags: v.bookedDayFlags } : {}),
        ...(v.calendarScannedAt ? { calendar_scanned_at: v.calendarScannedAt } : {}),
        updated_at: new Date().toISOString(),
      }));

    if (vehicleRows.length > 0) {
      // Read the roster BEFORE writing this payload.
      //
      // This used to run after the upsert, which quietly defeated the
      // safety check below: the freshly-inserted rows inflated `storedCount`,
      // so the stale fraction was measured against "old roster + everything
      // just added" instead of against the roster actually at risk. A sync
      // carrying 13 vehicles against 5 stored produced 5 stale out of 18 —
      // 28%, under the 50% limit — so the guard stood down and deleted all
      // five, every one of them still referenced by live trips.
      const { data: rosterBefore } = await supabase
        .from("vehicles")
        .select("plate")
        .eq("host_id", host.id);

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
        const storedCount = (rosterBefore ?? []).length;
        const currentPlates = new Set(vehicleRows.map((v) => v.plate));
        const stalePlates = (rosterBefore ?? [])
          .map((v) => v.plate as string)
          .filter((plate) => !currentPlates.has(plate));

        // Retiring a car is a trickle; losing most of the roster in one sync is
        // a scrape that went wrong. The Companion now builds `fleet` largely
        // from the Fleet Calendar, whose grid is virtualized and can legitimately
        // come back partial (page still loading, host paged the calendar, a
        // selector drifted after a Turo deploy) — and "partial roster" is
        // indistinguishable from "these cars were retired" at this layer.
        //
        // Deleting is the only irreversible thing this endpoint does, so it
        // refuses to do it wholesale: a sync that would remove more than half
        // of a non-trivial roster is treated as bad input and skipped, loudly.
        // Genuine retirements still prune on the next sync once the payload is
        // complete again.
        const PRUNE_RATIO_LIMIT = 0.5;
        const wouldPruneMost = storedCount >= 4 && stalePlates.length > storedCount * PRUNE_RATIO_LIMIT;

        // A ratio is only a heuristic. This is a fact: a vehicle with trips on
        // the board has not been retired, whatever the fleet payload says.
        // Every one of the five vehicles wrongly deleted before this existed
        // was carrying 3-5 live trips at the time.
        const { data: platesInUse } = await supabase
          .from("trips")
          .select("plate")
          .eq("host_id", host.id)
          .not("plate", "is", null);

        const inUse = new Set((platesInUse ?? []).map((t) => String(t.plate).toUpperCase()));
        const retirable = stalePlates.filter((plate) => !inUse.has(plate));
        const protectedByTrips = stalePlates.length - retirable.length;

        if (wouldPruneMost) {
          console.warn(
            `[turo/sync] Skipped pruning ${stalePlates.length}/${storedCount} vehicles — the payload carried only ${vehicleRows.length}. ` +
              "That looks like an incomplete fleet scrape rather than a retirement, so the roster was left intact."
          );
        } else if (retirable.length > 0) {
          const { error: pruneError } = await supabase
            .from("vehicles")
            .delete()
            .eq("host_id", host.id)
            .in("plate", retirable);

          if (pruneError) {
            console.error("[turo/sync] Failed to prune stale vehicles:", pruneError.message);
          }
        }

        if (protectedByTrips > 0) {
          console.warn(
            `[turo/sync] Kept ${protectedByTrips} vehicle(s) absent from the fleet payload because trips still reference them.`
          );
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
    return ingestFailureResponse("turo/sync", err);
  }
}
