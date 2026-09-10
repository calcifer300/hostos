"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation, runQueryOr } from "@/lib/supabase/server";
import { getFleetsForUser, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { OP_STATUSES, type OpStatus, type TripDraft } from "@/lib/board/bulk-paste";

/**
 * Writes for the cross-fleet board.
 *
 * The authorisation shape here is different from every other action in the
 * app, and deliberately. Elsewhere the fleet comes from the switcher cookie,
 * so an action only ever writes to "the current fleet". The board spans
 * fleets, so each write names the fleet it targets — and a fleet id from the
 * client is not evidence of anything. Every action re-derives the caller's
 * memberships and refuses ids that aren't in them.
 */

export interface BoardResult {
  ok: boolean;
  error?: string;
}

const WRITABLE_ROLES = new Set(["owner", "member"]);

/**
 * Confirms the caller may write to `hostId`.
 *
 * Returns the membership rather than a boolean so callers can log the actor,
 * and so there is exactly one place this check can be forgotten.
 */
async function requireWritableFleet(
  hostId: string
): Promise<{ ok: true; email: string | null } | { ok: false; error: string }> {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const fleets = await getFleetsForUser(email);

  // No membership row at all is local single-tenant mode, where the visitor is
  // effectively the owner — the same carve-out canEditCurrentFleet makes. On a
  // gated deployment getFleetsForUser has already provisioned or refused, so
  // this cannot hand a stranger someone else's fleet.
  if (fleets.length === 0) {
    if (await hasNoFleetAccess()) {
      return { ok: false, error: "Your fleet isn't set up yet. Reload and try again." };
    }
    return hostId === (await getCurrentHostId())
      ? { ok: true, email }
      : { ok: false, error: "You don't have access to that fleet." };
  }

  const membership = fleets.find((f) => f.hostId === hostId);
  if (!membership) return { ok: false, error: "You don't have access to that fleet." };
  if (!WRITABLE_ROLES.has(membership.role)) {
    return { ok: false, error: "You have read-only access to that fleet." };
  }

  return { ok: true, email };
}

/** Appends to the audit trail. Never fails the write it describes. */
async function logHistory(
  hostId: string,
  tripId: string,
  actorEmail: string | null,
  field: string,
  oldValue: string | null,
  newValue: string | null
): Promise<void> {
  const result = await runMutation("trip_history.insert", (client) =>
    client.from("trip_history").insert({
      host_id: hostId,
      trip_id: tripId,
      actor_email: actorEmail,
      field,
      old_value: oldValue,
      new_value: newValue,
    })
  );

  if (!result.ok) {
    // The status change itself already committed. Losing its history entry is
    // worth a log line, not an error the user has to act on.
    console.error(`[board] Couldn't log history for ${tripId}: ${result.error}`);
  }
}

/** Moves one trip through the co-host workflow. */
export async function setTripStatus(
  hostId: string,
  tripId: string,
  status: string
): Promise<BoardResult> {
  if (!OP_STATUSES.includes(status as OpStatus)) {
    return { ok: false, error: "Unknown status." };
  }

  const access = await requireWritableFleet(hostId);
  if (!access.ok) return { ok: false, error: access.error };

  const { data: before } = await runQueryOr<{ op_status: string | null } | null>(
    "trips.status_before",
    null,
    (client) =>
      client
        .from("trips")
        .select("op_status")
        .eq("host_id", hostId)
        .eq("id", tripId)
        .maybeSingle<{ op_status: string | null }>()
  );

  const result = await runMutation("trips.set_status", (client) =>
    client.from("trips").update({ op_status: status }).eq("host_id", hostId).eq("id", tripId)
  );

  if (!result.ok) return { ok: false, error: result.error };

  await logHistory(hostId, tripId, access.email, "status", before?.op_status ?? null, status);

  revalidatePath("/board");
  revalidatePath("/operations");
  return { ok: true };
}

/** Corrects a trip's timezone by hand, for the split states detection can't settle. */
export async function setTripTimezone(
  hostId: string,
  tripId: string,
  timezone: string
): Promise<BoardResult> {
  // An arbitrary string here would be stored and then thrown at Intl on every
  // render of that row.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { ok: false, error: "That isn't a recognised timezone." };
  }

  const access = await requireWritableFleet(hostId);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await runMutation("trips.set_timezone", (client) =>
    client
      .from("trips")
      // Set by a person, so it is no longer a guess.
      .update({ timezone, timezone_uncertain: false })
      .eq("host_id", hostId)
      .eq("id", tripId)
  );

  if (!result.ok) return { ok: false, error: result.error };

  await logHistory(hostId, tripId, access.email, "timezone", null, timezone);

  // Remember the correction, so the next paste of this address gets it right.
  {
    const { data: trip } = await runQueryOr<{ location: string | null } | null>(
      "trips.location_for_learn",
      null,
      (client) =>
        client
          .from("trips")
          .select("location")
          .eq("host_id", hostId)
          .eq("id", tripId)
          .maybeSingle<{ location: string | null }>()
    );

    if (trip?.location) {
      const { addressKey } = await import("@/lib/timezones");
      await runMutation("board_locations.learn", (client) =>
        client.from("board_locations").upsert(
          {
            host_id: hostId,
            address_key: addressKey(trip.location!),
            address: trip.location!,
            timezone,
          },
          { onConflict: "host_id,address_key" }
        )
      );
    }
  }

  revalidatePath("/board");
  return { ok: true };
}

export interface ImportResult extends BoardResult {
  imported?: number;
  updated?: number;
  skipped?: number;
}

/**
 * Imports parsed drafts from a pasted Turo list.
 *
 * Upserted on the reservation number, which is Turo's own id and the same key
 * the Companion writes — so pasting a list for a fleet the extension already
 * syncs enriches those rows (location, timezone, host label) rather than
 * duplicating them.
 *
 * A draft with no reservation number is skipped rather than given a generated
 * id. Karl's earlier parser invented one from Math.random(), which produces a
 * new row on every re-paste of the same trip.
 */
export async function importTripDrafts(
  hostId: string,
  drafts: TripDraft[]
): Promise<ImportResult> {
  const access = await requireWritableFleet(hostId);
  if (!access.ok) return { ok: false, error: access.error };

  const usable = drafts.filter((d) => d.reservationId.trim().length > 0);
  const skipped = drafts.length - usable.length;

  if (usable.length === 0) {
    return {
      ok: false,
      error: skipped > 0
        ? "None of those rows had a reservation number, so there's nothing to key them on."
        : "Nothing to import.",
      skipped,
    };
  }

  // Which of these already exist, so the result can say what changed rather
  // than reporting everything as new.
  const { data: existing } = await runQueryOr<{ id: string }[]>("trips.existing_for_import", [], (client) =>
    client
      .from("trips")
      .select("id")
      .eq("host_id", hostId)
      .in("id", usable.map((d) => d.reservationId))
      .returns<{ id: string }[]>()
  );
  const existingIds = new Set(existing.map((r) => r.id));

  const rows = usable.map((d) => {
    // "2026 Toyota Corolla Cross" — split so the board and the existing fleet
    // pages read the same columns.
    const vehicleMatch = d.vehicle.match(/^(.*?)\s*(\d{4})\s*$/);
    const year = vehicleMatch ? vehicleMatch[2] : null;
    const nameParts = (vehicleMatch ? vehicleMatch[1] : d.vehicle).trim().split(/\s+/);

    return {
      id: d.reservationId,
      host_id: hostId,
      guest_name: d.guest || null,
      plate: d.plate || null,
      vehicle_make: nameParts[0] ?? null,
      vehicle_model: nameParts.slice(1).join(" ") || null,
      vehicle_year: year,
      start_ts: d.startsAt,
      end_ts: d.endsAt,
      op_status: d.status,
      source: "manual",
      timezone: d.timezone,
      timezone_uncertain: d.timezoneUncertain,
      location: d.location || null,
      host_label: d.hostLabel || null,
      notes: d.tags.length ? d.tags.join(" · ") : null,
      synced_at: new Date().toISOString(),
    };
  });

  const result = await runMutation("trips.import", (client) =>
    client.from("trips").upsert(rows, { onConflict: "id" })
  );

  if (!result.ok) return { ok: false, error: result.error };

  const updated = rows.filter((r) => existingIds.has(r.id)).length;

  await Promise.all(
    rows.map((r) =>
      logHistory(
        hostId,
        r.id,
        access.email,
        "import",
        existingIds.has(r.id) ? "existing" : null,
        `pasted from Turo · ${r.op_status}`
      )
    )
  );

  revalidatePath("/board");
  revalidatePath("/operations");
  revalidatePath("/");

  return { ok: true, imported: rows.length - updated, updated, skipped };
}
