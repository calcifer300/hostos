import "server-only";
import { cache } from "react";
import { runQueryOr } from "@/lib/supabase/server";
import { baseRentalForTrip, computeEarnings, type EarningsBreakdown } from "@/lib/risk/earnings";
import { assessTrip, type RiskAssessment, type RiskTripInput } from "@/lib/risk/engine";

/**
 * Assembles the three operator queues — Unverified Licences, Profit Risk and
 * the Earnings Estimator — from what the Companion has synced.
 *
 * Everything here is read through runQueryOr, so a fleet that has not run
 * migration 0010 yet gets empty queues rather than a broken page. The columns
 * are selected in a separate query from the main trips read for the same reason
 * getVehicleSpecs is separate: a missing COLUMN is not caught by
 * isUndefinedTableError, and folding these into the dashboard's select would
 * blank the whole dashboard on an un-migrated install.
 */

export interface QueueTrip {
  id: string;
  guestName: string;
  vehicle: string;
  plate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  licenseConfirmed: boolean | null;
  licenseStatusText: string | null;
  protectionPlanName: string | null;
  guestRating: number | null;
  guestRatingCount: number | null;
  guestTripCount: number | null;
  includedMiles: number | null;
  /** Turo's OVERAGE rate — shown as information, never flagged on. */
  pricePerMile: number | null;
  /** Turo profile id, so a low rating links to the guest's actual reviews. */
  guestDriverId: string | null;
  /**
   * The HOST's own per-trip deductible — what the Premier play swaps to a lower
   * tier. Null on most trips: unlike protection level and guest rating, this is
   * only readable from rendered markup, so it exists for near-term check-ins
   * only. Render it when present; never infer a figure from its absence.
   */
  hostDamageResponsibility: number | null;
  /** Hours until pickup; negative once started, null when unscheduled. */
  hoursUntilPickup: number | null;
  earnings: EarningsBreakdown | null;
  /** True when the nightly rate was extrapolated past the calendar window. */
  earningsProjected: boolean;
  risk: RiskAssessment;
}

export interface RiskQueues {
  /** Unverified licence, pickup within 24h. */
  licenses: QueueTrip[];
  /** Below $0.20/mile decisively, or the guest holds a $0-liability plan. */
  profitRisk: QueueTrip[];
  /** Below the line, but an unread input could still clear it. */
  undecided: QueueTrip[];
  /** Trips returning today, with what each is worth. */
  returningToday: QueueTrip[];
  /** Every priced trip, richest first — "cars making money". */
  earners: QueueTrip[];
  /** True when migration 0010 has not been applied / nothing is priced yet. */
  pricingUnavailable: boolean;
}

interface RiskTripRow {
  id: string;
  guest_name: string | null;
  plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  action: string | null;
  start_ts: string | null;
  end_ts: string | null;
  extras: { label: string; quantity: number }[] | null;
  license_confirmed: boolean | null;
  license_status_text: string | null;
  protection_level: string | null;
  protection_plan_name: string | null;
  guest_max_out_of_pocket: number | null;
  guest_rating: number | null;
  guest_rating_count: number | null;
  guest_trip_count: number | null;
  included_miles: number | null;
  price_per_mile: number | null;
  host_take_rate: number | null;
  length_discount_percent: number | null;
  cancellation_policy_type: string | null;
  delivery_fee: number | null;
  pricing_checked_at: string | null;
  guest_driver_id: string | null;
  host_damage_responsibility: number | null;
}

interface CalendarRow {
  plate: string;
  daily_prices: number[] | null;
  calendar_scanned_at: string | null;
}

const RISK_COLUMNS =
  "id, guest_name, plate, vehicle_make, vehicle_model, action, start_ts, end_ts, extras, " +
  "license_confirmed, license_status_text, protection_level, protection_plan_name, guest_max_out_of_pocket, " +
  "guest_rating, guest_rating_count, guest_trip_count, included_miles, price_per_mile, host_take_rate, " +
  "length_discount_percent, cancellation_policy_type, delivery_fee, pricing_checked_at, " +
  "guest_driver_id, host_damage_responsibility";

function vehicleName(row: RiskTripRow): string {
  const name = [row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ");
  return name || row.plate || "Vehicle";
}

function isSameDay(iso: string | null, timezone: string): boolean {
  if (!iso) return false;
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: timezone });
  return key(new Date(iso)) === key(new Date());
}

export const getRiskQueues = cache(async function getRiskQueues(
  hostId: string,
  timezone = "America/Denver"
): Promise<RiskQueues> {
  const [tripsResult, calendarResult] = await Promise.all([
    runQueryOr<RiskTripRow[]>("trips.risk_queue", [], (client) =>
      client.from("trips").select(RISK_COLUMNS).eq("host_id", hostId).returns<RiskTripRow[]>()
    ),
    runQueryOr<CalendarRow[]>("vehicles.calendar", [], (client) =>
      client
        .from("vehicles")
        .select("plate, daily_prices, calendar_scanned_at")
        .eq("host_id", hostId)
        .returns<CalendarRow[]>()
    ),
  ]);

  // A missing column here means migration 0010 hasn't run. Say so plainly
  // rather than rendering three confident empty queues, which would read as
  // "nothing needs attention".
  const pricingUnavailable = Boolean(tripsResult.failure);

  const calendarByPlate = new Map(calendarResult.data.map((v) => [v.plate, v]));
  const now = Date.now();

  const trips: QueueTrip[] = tripsResult.data.map((row) => {
    const calendar = row.plate ? calendarByPlate.get(row.plate) : undefined;
    const { base, projected } = baseRentalForTrip(
      calendar?.daily_prices ?? null,
      calendar?.calendar_scanned_at ?? null,
      row.start_ts,
      row.end_ts
    );

    const dayMs = 24 * 60 * 60 * 1000;
    const tripDays =
      row.start_ts && row.end_ts
        ? Math.max(1, Math.ceil((new Date(row.end_ts).getTime() - new Date(row.start_ts).getTime()) / dayMs - 1e-9))
        : null;

    const earnings = computeEarnings({
      baseRental: base,
      hostTakeRate: row.host_take_rate,
      includedMiles: row.included_miles,
      lengthDiscountPercent: row.length_discount_percent,
      cancellationPolicyType: row.cancellation_policy_type,
      deliveryFee: row.delivery_fee,
      extras: row.extras,
      // The trips-list payload always carries an extras array, but it is only
      // *valued* by the detail scan. Treat it as read only once pricing ran.
      extrasChecked: row.pricing_checked_at !== null,
      tripDays,
    });

    const input: RiskTripInput = {
      id: row.id,
      guestName: row.guest_name,
      vehicle: vehicleName(row),
      plate: row.plate,
      startsAt: row.start_ts,
      endsAt: row.end_ts,
      action: row.action,
      licenseConfirmed: row.license_confirmed,
      protectionLevel: row.protection_level,
      protectionPlanName: row.protection_plan_name,
      guestMaxOutOfPocket: row.guest_max_out_of_pocket,
      guestRating: row.guest_rating,
      guestRatingCount: row.guest_rating_count,
      guestTripCount: row.guest_trip_count,
      includedMiles: row.included_miles,
      pricePerMile: row.price_per_mile,
      hostTakeRate: row.host_take_rate,
      earnings,
    };

    return {
      id: row.id,
      guestName: row.guest_name || "Guest",
      vehicle: input.vehicle,
      plate: row.plate,
      startsAt: row.start_ts,
      endsAt: row.end_ts,
      licenseConfirmed: row.license_confirmed,
      licenseStatusText: row.license_status_text,
      protectionPlanName: row.protection_plan_name,
      guestRating: row.guest_rating,
      guestRatingCount: row.guest_rating_count,
      guestTripCount: row.guest_trip_count,
      includedMiles: row.included_miles,
      pricePerMile: row.price_per_mile,
      guestDriverId: row.guest_driver_id,
      hostDamageResponsibility: row.host_damage_responsibility,
      // The Premier play is contact -> cancel -> swap plan -> rebook, and every
      // step needs the guest reachable. How much runway is left is the thing
      // that decides whether it is even attemptable, so it is computed once
      // here rather than re-derived in each consumer.
      hoursUntilPickup: row.start_ts
        ? (new Date(row.start_ts).getTime() - now) / 3_600_000
        : null,
      earnings,
      earningsProjected: projected,
      risk: assessTrip(input, now),
    };
  });

  const byStart = (a: QueueTrip, b: QueueTrip) =>
    new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime();

  return {
    licenses: trips.filter((t) => t.risk.licenseRequiresAttention).sort(byStart),
    // A trip already under way can't be cancelled, so its economics are no
    // longer actionable — only genuinely upcoming trips belong in this queue.
    profitRisk: trips
      .filter((t) => t.risk.earningsRisk && (!t.startsAt || new Date(t.startsAt).getTime() > now))
      .sort(byStart),
    undecided: trips
      .filter((t) => t.risk.earningsUndecided && (!t.startsAt || new Date(t.startsAt).getTime() > now))
      .sort(byStart),
    returningToday: trips.filter((t) => isSameDay(t.endsAt, timezone)).sort(byStart),
    earners: trips
      .filter((t) => t.earnings !== null)
      .sort((a, b) => (b.earnings?.earnings ?? 0) - (a.earnings?.earnings ?? 0)),
    pricingUnavailable,
  };
});
