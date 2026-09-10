import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { runQueryOr } from "@/lib/supabase/server";
import { getFleetsForUser } from "@/lib/host/context";
import { computeTimer, type TimerReading } from "@/lib/board/countdown";
import { detectTimezone } from "@/lib/timezones";
import type { OpStatus } from "@/lib/board/bulk-paste";

/**
 * The cross-fleet operations board.
 *
 * Every other surface in HostOS shows ONE fleet — the one the switcher is set
 * to. That is right for an owner and wrong for the person Karl built his
 * trackers for: a co-host watching nine hosts across five timezones needs them
 * in one list, sorted by what blows up next, or the switcher becomes nine tabs
 * they check in rotation.
 *
 * host_members already allows one person on many fleets, so this needs no new
 * tenancy concept. It reads every fleet the viewer belongs to and merges the
 * result.
 */

export interface BoardTrip {
  id: string;
  hostId: string;
  /** The fleet's name, for the column header and the filter. */
  fleetName: string;
  /** Per-trip attribution from a pasted list — "(Ethan's vehicle)". */
  hostLabel: string | null;
  guestName: string | null;
  vehicle: string;
  plate: string | null;
  location: string | null;
  timezone: string;
  timezoneUncertain: boolean;
  startsAt: string | null;
  endsAt: string | null;
  status: OpStatus;
  source: string;
  notes: string | null;
  timer: TimerReading;
}

interface TripRow {
  id: string;
  host_id: string;
  guest_name: string | null;
  plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  start_ts: string | null;
  end_ts: string | null;
  op_status: string | null;
  action: string | null;
  source: string | null;
  timezone: string | null;
  timezone_uncertain: boolean | null;
  location: string | null;
  host_label: string | null;
  notes: string | null;
}

const COLUMNS =
  "id, host_id, guest_name, plate, vehicle_make, vehicle_model, vehicle_year, " +
  "start_ts, end_ts, op_status, action, source, timezone, timezone_uncertain, " +
  "location, host_label, notes";

const VALID_STATUSES = new Set<string>([
  "Not Checked-In", "Pending DL", "Checked-In", "Extended", "Late",
  "Not Checked-Out", "Returned", "Checked-Out", "Canceled",
]);

/**
 * The operational status to work from.
 *
 * Companion-synced trips have never had one — the extension scrapes `action`
 * ("checkin" / "checkout" / "skip"), which is where Turo is in ITS workflow,
 * not where the co-host is in theirs. Deriving a starting status from it means
 * a synced trip lands on the board usable rather than blank, and the moment
 * someone sets a real status by hand that wins.
 */
function resolveStatus(row: TripRow): OpStatus {
  if (row.op_status && VALID_STATUSES.has(row.op_status)) return row.op_status as OpStatus;
  if (row.action === "checkout") return "Checked-In";
  return "Not Checked-In";
}

function vehicleLabel(row: TripRow): string {
  const parts = [row.vehicle_year, row.vehicle_make, row.vehicle_model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle";
}

function rowToTrip(row: TripRow, fleetName: string, fleetTimezone: string, now: number): BoardTrip {
  // Per-trip zone first; then whatever the address implies; then the fleet's
  // own. A fleet-wide zone is the wrong answer for a fleet that delivers to
  // two states, but it beats rendering the viewer's clock as if it were the
  // car's.
  let timezone = row.timezone;
  let uncertain = row.timezone_uncertain ?? false;

  if (!timezone && row.location) {
    const detected = detectTimezone(row.location);
    timezone = detected.zone;
    uncertain = !detected.confident;
  }
  if (!timezone) {
    timezone = fleetTimezone;
    uncertain = true;
  }

  const status = resolveStatus(row);

  return {
    id: row.id,
    hostId: row.host_id,
    fleetName,
    hostLabel: row.host_label,
    guestName: row.guest_name,
    vehicle: vehicleLabel(row),
    plate: row.plate,
    location: row.location,
    timezone,
    timezoneUncertain: uncertain,
    startsAt: row.start_ts,
    endsAt: row.end_ts,
    status,
    source: row.source ?? "companion",
    notes: row.notes,
    timer: computeTimer({ startsAt: row.start_ts, endsAt: row.end_ts, status }, now),
  };
}

export interface BoardFleet {
  hostId: string;
  name: string;
  timezone: string;
  role: string;
}

export interface BoardData {
  trips: BoardTrip[];
  fleets: BoardFleet[];
  /** True when a fleet's trips couldn't be read — an empty board that isn't "no trips". */
  degraded: boolean;
}

/**
 * Every trip across every fleet the viewer belongs to.
 *
 * Fleets are queried with a single `in` rather than one request each: a VA on
 * nine fleets would otherwise pay nine round trips on every board render, and
 * the board refreshes on a timer.
 *
 * Settled trips are excluded past a day old. A board is a worklist, and a
 * co-host does not need last month's returns in it — Operations and the trip
 * pages still hold the full history.
 */
export const getBoardData = cache(async function getBoardData(
  now: number = Date.now()
): Promise<BoardData> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const memberships = await getFleetsForUser(email);

  const fleets: BoardFleet[] = memberships.map((m) => ({
    hostId: m.hostId,
    name: m.name ?? m.slug ?? `Fleet ${m.hostId.slice(0, 8)}`,
    timezone: m.timezone,
    role: m.role,
  }));

  if (fleets.length === 0) {
    return { trips: [], fleets: [], degraded: false };
  }

  const cutoff = new Date(now - 36 * 3600 * 1000).toISOString();

  const { data, degraded } = await runQueryOr<TripRow[]>("trips.board", [], (client) =>
    client
      .from("trips")
      .select(COLUMNS)
      .in("host_id", fleets.map((f) => f.hostId))
      // A trip with no times at all still belongs on the board — it is exactly
      // the row someone needs to finish filling in — so the cutoff only
      // excludes rows that HAVE an end and it is old.
      .or(`end_ts.is.null,end_ts.gte.${cutoff}`)
      .limit(500)
      .returns<TripRow[]>()
  );

  const byId = new Map(fleets.map((f) => [f.hostId, f]));

  const trips = data
    .map((row) => {
      const fleet = byId.get(row.host_id);
      return rowToTrip(row, fleet?.name ?? "Unknown fleet", fleet?.timezone ?? "America/Denver", now);
    })
    // Worst first. See computeTimer — overdue weights are negative and grow
    // more negative the longer they run.
    .sort((a, b) => a.timer.sortWeight - b.timer.sortWeight);

  return { trips, fleets, degraded };
});

export interface TripHistoryEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actorEmail: string | null;
  createdAt: string;
}

/** Who changed what on one trip, newest first. */
export async function getTripHistory(hostId: string, tripId: string): Promise<TripHistoryEntry[]> {
  const { data } = await runQueryOr<
    { id: string; field: string; old_value: string | null; new_value: string | null; actor_email: string | null; created_at: string }[]
  >("trip_history.for_trip", [], (client) =>
    client
      .from("trip_history")
      .select("id, field, old_value, new_value, actor_email, created_at")
      .eq("host_id", hostId)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<{ id: string; field: string; old_value: string | null; new_value: string | null; actor_email: string | null; created_at: string }[]>()
  );

  return data.map((row) => ({
    id: row.id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
  }));
}
