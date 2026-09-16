import "server-only";
import { runQueryOr } from "@/lib/supabase/server";

/**
 * Read side of the Companion sync pipeline. `src/app/api/turo/sync/route.ts`
 * writes `trips`/`vehicles`; this is what reads them back for the
 * dashboard. Host_id-keyed, not user_email-keyed — Companion data doesn't
 * require a Google account, matching the public-shell architecture.
 */

export interface CompanionTrip {
  id: string;
  guestName: string | null;
  plate: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  action: "checkin" | "checkout" | "skip" | null;
  skipReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  dateLabel: string | null;
  syncedAt: string;
  /** From the Companion's background license-check loop — null means "not checked yet," not "not confirmed." See migration 0005. */
  licenseConfirmed: boolean | null;
  licenseStatusText: string | null;
}

export interface CompanionVehicle {
  plate: string;
  year: string | null;
  color: string | null;
  make: string | null;
  model: string | null;
  lockbox: string | null;
  permit: string | null;
  updatedAt: string;
}

/** From a one-time Vehicle Summary spreadsheet import (supabase/migrations/0007_vehicle_specs.sql), not the sync pipeline. */
export interface VehicleSpecs {
  vin: string | null;
  odometer: number | null;
  fuelType: string | null;
  tankSize: string | null;
  vehicleType: string | null;
}

interface TripRow {
  id: string;
  guest_name: string | null;
  plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  action: string | null;
  skip_reason: string | null;
  start_ts: string | null;
  end_ts: string | null;
  date_label: string | null;
  synced_at: string;
  license_confirmed: boolean | null;
  license_status_text: string | null;
}

interface VehicleRow {
  plate: string;
  year: string | null;
  color: string | null;
  make: string | null;
  model: string | null;
  lockbox: string | null;
  permit: string | null;
  updated_at: string;
}

function rowToTrip(row: TripRow): CompanionTrip {
  return {
    id: row.id,
    guestName: row.guest_name,
    plate: row.plate,
    vehicleMake: row.vehicle_make,
    vehicleModel: row.vehicle_model,
    vehicleYear: row.vehicle_year,
    action: row.action === "checkin" || row.action === "checkout" || row.action === "skip" ? row.action : null,
    skipReason: row.skip_reason,
    startsAt: row.start_ts,
    endsAt: row.end_ts,
    dateLabel: row.date_label,
    syncedAt: row.synced_at,
    licenseConfirmed: row.license_confirmed,
    licenseStatusText: row.license_status_text,
  };
}

function rowToVehicle(row: VehicleRow): CompanionVehicle {
  return {
    plate: row.plate,
    year: row.year,
    color: row.color,
    make: row.make,
    model: row.model,
    lockbox: row.lockbox,
    permit: row.permit,
    updatedAt: row.updated_at,
  };
}

/**
 * Called while rendering the dashboard, so it must never throw. An empty
 * array here means one of "no trips synced", "table not migrated", or
 * "backend unreachable" — `getBackendHealth()` is what distinguishes them,
 * and the shell reads it to explain an empty dashboard rather than implying
 * the fleet is idle.
 */
export async function getCompanionTrips(hostId: string): Promise<CompanionTrip[]> {
  const { data } = await runQueryOr<TripRow[]>("trips.list", [], (client) =>
    client
      .from("trips")
      .select(
        "id, guest_name, plate, vehicle_make, vehicle_model, vehicle_year, action, skip_reason, start_ts, end_ts, date_label, synced_at, license_confirmed, license_status_text"
      )
      .eq("host_id", hostId)
      .order("synced_at", { ascending: false })
      .returns<TripRow[]>()
  );

  return data.map(rowToTrip);
}

export async function getCompanionVehicles(hostId: string): Promise<CompanionVehicle[]> {
  const { data } = await runQueryOr<VehicleRow[]>("vehicles.list", [], (client) =>
    client
      .from("vehicles")
      .select("plate, year, color, make, model, lockbox, permit, updated_at")
      .eq("host_id", hostId)
      .returns<VehicleRow[]>()
  );

  return data.map(rowToVehicle);
}

/**
 * Deliberately separate from getCompanionVehicles/CompanionVehicle above:
 * these columns only exist once supabase/migrations/0007_vehicle_specs.sql
 * has been run, and a query for a genuinely missing *column* (unlike a
 * missing table) isn't something isUndefinedTableError recognizes — folding
 * this into the main vehicles select would silently break the whole Fleet
 * page for every install that hasn't run 0007 yet. Failing here only
 * blanks out the "Maintenance & documents" panel on one vehicle's detail
 * page, nothing else.
 */
export async function getVehicleSpecs(hostId: string, plate: string): Promise<VehicleSpecs | null> {
  interface SpecsRow {
    vin: string | null;
    odometer: number | null;
    fuel_type: string | null;
    tank_size: string | null;
    vehicle_type: string | null;
  }

  const { data } = await runQueryOr<SpecsRow | null>("vehicles.specs", null, (client) =>
    client
      .from("vehicles")
      .select("vin, odometer, fuel_type, tank_size, vehicle_type")
      .eq("host_id", hostId)
      .eq("plate", plate)
      .maybeSingle<SpecsRow>()
  );

  if (!data) return null;
  if (!data.vin && data.odometer === null && !data.fuel_type && !data.tank_size && !data.vehicle_type) return null;

  return {
    vin: data.vin,
    odometer: data.odometer,
    fuelType: data.fuel_type,
    tankSize: data.tank_size,
    vehicleType: data.vehicle_type,
  };
}

/** Guest risk signals from the Companion's enrichment loop (migration 0008). */
export interface TripRiskSignals {
  /**
   * Turo's raw enum. Values observed live on 2026-09-08, cheapest cover first:
   *
   *   DECLINED -> "Not protected", cap null   (guest took no cover)
   *   BASIC    -> "Minimum",       cap $3000
   *   PREMIUM  -> "Standard",      cap $500
   *   SUPREME  -> Premier,         cap $0     (not yet seen on this fleet)
   *
   * NOTE the trap: `PREMIUM` is the mid-tier "Standard" plan, NOT Premier.
   * Premier is `SUPREME`, and it is the one that matters — a $0 cap means
   * damage cannot be billed to the guest at all. Use isPremierProtection()
   * rather than testing this string, since it also keys on the $0 cap and so
   * survives Turo renaming the enum.
   */
  protectionLevel: string | null;
  protectionPlanName: string | null;
  /** A genuine 0 is the meaningful value — that IS Premier. Null means "not checked yet". */
  guestMaxOutOfPocket: number | null;
  /** Null when nobody has rated this guest — distinct from a rating of zero. */
  guestRating: number | null;
  guestRatingCount: number | null;
  guestTripCount: number | null;
  guestMemberSince: string | null;
}

interface RiskRow {
  id: string;
  protection_level: string | null;
  protection_plan_name: string | null;
  guest_max_out_of_pocket: number | null;
  guest_rating: number | null;
  guest_rating_count: number | null;
  guest_trip_count: number | null;
  guest_member_since: string | null;
}

const RISK_COLUMNS =
  "id, protection_level, protection_plan_name, guest_max_out_of_pocket, guest_rating, guest_rating_count, guest_trip_count, guest_member_since";

function rowToRisk(row: RiskRow): TripRiskSignals {
  return {
    protectionLevel: row.protection_level,
    protectionPlanName: row.protection_plan_name,
    guestMaxOutOfPocket: row.guest_max_out_of_pocket,
    guestRating: row.guest_rating,
    guestRatingCount: row.guest_rating_count,
    guestTripCount: row.guest_trip_count,
    guestMemberSince: row.guest_member_since,
  };
}

/**
 * A guest on Turo's Premier plan has a $0 out-of-pocket maximum, so damage
 * can't be billed to them — the signal worth acting on before a trip starts.
 *
 * Deliberately kept OUT of getCompanionTrips' select, for the same reason
 * getVehicleSpecs is separate from getCompanionVehicles: these columns only
 * exist once supabase/migrations/0008_trip_enrichment.sql has been run, and a
 * missing *column* (unlike a missing table) is not something
 * isUndefinedTableError recognises. Folding them into the main trips select
 * would return zero trips — a blank dashboard — on every install that hasn't
 * migrated yet. Failing here costs only the risk badges.
 */
export async function getTripRiskSignals(hostId: string): Promise<Map<string, TripRiskSignals>> {
  const { data } = await runQueryOr<RiskRow[]>("trips.risk_signals", [], (client) =>
    client.from("trips").select(RISK_COLUMNS).eq("host_id", hostId).returns<RiskRow[]>()
  );

  const byTripId = new Map<string, TripRiskSignals>();
  for (const row of data) {
    // Skip rows the enrichment loop hasn't reached — an all-null entry would
    // render as "checked, nothing found", which is a different claim.
    if (row.protection_level === null && row.guest_rating === null && row.guest_trip_count === null) continue;
    byTripId.set(row.id, rowToRisk(row));
  }
  return byTripId;
}

/** True when the guest's plan leaves the host unable to bill them for damage. */
export function isPremierProtection(risk: TripRiskSignals | null | undefined): boolean {
  if (!risk) return false;
  return risk.protectionLevel === "SUPREME" || risk.guestMaxOutOfPocket === 0;
}
