import { NextRequest, NextResponse } from "next/server";
import { ingestFailureResponse, requireCompanionHost } from "@/lib/api/companion-auth";
import { isUndefinedColumnError, isUndefinedTableError } from "@/lib/supabase/server";

/**
 * Guest risk signals from the Companion's enrichment loop — the protection
 * plan and the guest's track record, both read from Turo's JSON APIs rather
 * than scraped markup (see the extension's enrichment.js for why the
 * reservation page's own "Damage responsibility" figure is the wrong number).
 *
 * Same bearer-pairing-key auth as the other Companion endpoints. Patches
 * existing `trips` rows only: this loop never creates a trip, because the
 * trips list scan owns that and a reservation Turo will answer for but hasn't
 * listed shouldn't materialise here as a row with no dates or plate.
 */

interface IncomingEnrichment {
  reservation?: string;
  protectionLevel?: string | null;
  protectionPlanName?: string | null;
  guestMaxOutOfPocket?: number | null;
  plate?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  guestRating?: number | null;
  guestRatingCount?: number | null;
  guestTripCount?: number | null;
  guestMemberSince?: string | null;
  /** Turo profile id — the link to the guest s review history. See migration 0011. */
  driverId?: string | null;
  // Earnings inputs — see supabase/migrations/0010_earnings_and_risk.sql.
  includedMiles?: number | null;
  pricePerMile?: number | null;
  hostTakeRate?: number | null;
  lengthDiscountPercent?: number | null;
  cancellationPolicyType?: string | null;
  deliveryFee?: number | null;
}

interface EnrichmentPayload {
  reservations?: IncomingEnrichment[];
}

const MIGRATION_HINT = "Run supabase/migrations/0008_trip_enrichment.sql against your Supabase project.";

/** Numbers only — a string or NaN would fail the column type at insert time. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host, supabase } = auth.ctx;

  let payload: EnrichmentPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", retryable: false }, { status: 400 });
  }

  const incoming = (Array.isArray(payload.reservations) ? payload.reservations : []).filter(
    (r): r is IncomingEnrichment & { reservation: string } =>
      typeof r?.reservation === "string" && r.reservation.trim().length > 0
  );

  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const checkedAt = new Date().toISOString();
  let updated = 0;
  let failed = 0;

  try {
    for (const entry of incoming) {
      // Built field by field rather than spread wholesale, so a key the
      // extension starts sending that has no column here can't fail the write.
      const patch: Record<string, string | number | null> = {
        protection_level: str(entry.protectionLevel),
        protection_plan_name: str(entry.protectionPlanName),
        guest_max_out_of_pocket: num(entry.guestMaxOutOfPocket),
        protection_checked_at: checkedAt,
      };

      // Turo's registration record is more reliable than the plate text
      // scraped off a trip card — but only fill gaps, never overwrite what the
      // trips list already established, so one odd payload can't rewrite a
      // vehicle's identity across the dashboard.
      const plate = str(entry.plate);
      const make = str(entry.vehicleMake);
      const model = str(entry.vehicleModel);
      const year = str(entry.vehicleYear);

      // The guest lookup is only requested once per trip, so an absent block
      // means "not asked for this cycle" — it must not blank a stored rating.
      const hasGuest =
        entry.guestRating !== undefined ||
        entry.guestRatingCount !== undefined ||
        entry.guestTripCount !== undefined;

      // Pricing is quoted per trip window, so it only arrives once the trip
      // has dates. An absent block means "not quoted this cycle" and must not
      // blank what a previous cycle resolved — same rule as the guest block.
      const hasPricing =
        entry.hostTakeRate !== undefined ||
        entry.includedMiles !== undefined ||
        entry.pricePerMile !== undefined;

      if (hasPricing) {
        patch.included_miles = num(entry.includedMiles);
        patch.price_per_mile = num(entry.pricePerMile);
        patch.host_take_rate = num(entry.hostTakeRate);
        patch.length_discount_percent = num(entry.lengthDiscountPercent);
        patch.cancellation_policy_type = str(entry.cancellationPolicyType);
        // A real 0 means Turo said this is not a delivery. Null means we never
        // read it — and an unknown spent as a zero understates the trip by the
        // whole fee, which is how a healthy trip drops under the $0.20 line.
        patch.delivery_fee = num(entry.deliveryFee);
        patch.pricing_checked_at = checkedAt;
      }

      // Kept out of the hasGuest block: the profile id comes back on EVERY
      // reservation lookup, while the rating block is only requested once per
      // trip. Gating it on hasGuest would mean most trips never store it.
      const driverId = str(entry.driverId);
      if (driverId) patch.guest_driver_id = driverId;

      if (hasGuest) {
        patch.guest_rating = num(entry.guestRating);
        patch.guest_rating_count = num(entry.guestRatingCount);
        patch.guest_trip_count = num(entry.guestTripCount);
        patch.guest_member_since = str(entry.guestMemberSince);
        patch.guest_checked_at = checkedAt;
      }

      const { error, count } = await supabase
        .from("trips")
        .update(patch, { count: "exact" })
        .eq("host_id", host.id)
        .eq("id", entry.reservation);

      if (error) {
        if (isUndefinedTableError(error) || isUndefinedColumnError(error)) {
          return NextResponse.json(
            { error: `The trips table is missing its enrichment columns. ${MIGRATION_HINT}`, retryable: false },
            { status: 503, headers: { "Retry-After": "300" } }
          );
        }
        failed += 1;
        console.warn(`[turo/enrichment] Failed to update ${entry.reservation}: ${error.message}`);
        continue;
      }

      updated += count ?? 0;

      if (plate || make || model || year) {
        const identity: Record<string, string> = {};
        if (plate) identity.plate = plate.toUpperCase();
        if (make) identity.vehicle_make = make;
        if (model) identity.vehicle_model = model;
        if (year) identity.vehicle_year = year;

        // One statement per column because each is gated on that column still
        // being null — this genuinely fills gaps and never contradicts what the
        // trips list scan already established.
        for (const [column, value] of Object.entries(identity)) {
          const { error: identityError } = await supabase
            .from("trips")
            .update({ [column]: value })
            .eq("host_id", host.id)
            .eq("id", entry.reservation)
            .is(column, null);

          if (identityError) {
            console.warn(
              `[turo/enrichment] Could not backfill ${column} for ${entry.reservation}: ${identityError.message}`
            );
          }
        }
      }
    }

    // A whole batch failing is an outage, not a no-op — reporting ok:0 would
    // let the extension mark every reservation as checked and move on.
    if (failed === incoming.length) {
      return ingestFailureResponse(
        "turo/enrichment",
        new Error(`All ${failed} enrichment updates failed.`)
      );
    }

    return NextResponse.json({ ok: true, updated, failed });
  } catch (err) {
    return ingestFailureResponse("turo/enrichment", err);
  }
}
