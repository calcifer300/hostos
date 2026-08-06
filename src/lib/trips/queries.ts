import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";

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

/** Called while rendering the dashboard, so it must never throw. */
export async function getCompanionTrips(hostId: string): Promise<CompanionTrip[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trips")
      .select("id, guest_name, plate, vehicle_make, vehicle_model, vehicle_year, action, skip_reason, start_ts, end_ts, date_label, synced_at")
      .eq("host_id", hostId)
      .order("synced_at", { ascending: false });

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[trips] Failed to load Companion trips:", error.message);
      }
      return [];
    }

    return (data ?? []).map(rowToTrip);
  } catch (err) {
    console.error("[trips] Failed to load Companion trips:", err);
    return [];
  }
}

export async function getCompanionVehicles(hostId: string): Promise<CompanionVehicle[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("vehicles")
      .select("plate, year, color, make, model, lockbox, permit, updated_at")
      .eq("host_id", hostId);

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[trips] Failed to load Companion vehicles:", error.message);
      }
      return [];
    }

    return (data ?? []).map(rowToVehicle);
  } catch (err) {
    console.error("[trips] Failed to load Companion vehicles:", err);
    return [];
  }
}
