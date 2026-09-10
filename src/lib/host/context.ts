import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { runQueryOr } from "@/lib/supabase/server";
import { DEFAULT_HOST_ID } from "@/lib/host/queries";
import { requiresAuth } from "@/lib/access";

/**
 * Resolves which fleet the current request is operating on.
 *
 * Every table has been host_id-keyed since migration 0003, but the app passed a
 * hardcoded DEFAULT_HOST_ID at all 19 call sites, so one deployment could only
 * ever serve one fleet. This is the single place that decision now lives.
 *
 * TWO MODES, BY DEPLOYMENT
 * ------------------------
 * Locally HostOS is an open shell (Project Aurora Phase 1) — Companion data
 * needs no Google account, so a visitor with no membership gets the default
 * fleet, exactly as before multi-tenancy existed.
 *
 * On a hosted deployment that is unsafe: the Google provider accepts any
 * Google account, so a session proves identity, not authorisation. There, a
 * user with no membership resolves to NO_FLEET_HOST_ID and every host-scoped
 * query returns empty. This never throws and never demands a session, so it
 * stays safe to call from any render path.
 */

const SELECTED_HOST_COOKIE = "hostos_fleet";

export interface FleetMembership {
  hostId: string;
  name: string | null;
  slug: string | null;
  timezone: string;
  role: string;
}

interface MembershipRow {
  host_id: string;
  role: string;
  hosts: { name: string | null; slug: string | null; timezone: string | null } | null;
}

/**
 * Every fleet this email may see. Empty for a signed-out visitor, and empty for
 * a signed-in user nobody has invited yet — both fall back to the default
 * fleet, so an install that never creates a membership behaves as it always did.
 */
export const getFleetsForUser = cache(async function getFleetsForUser(
  email: string | null
): Promise<FleetMembership[]> {
  if (!email) return [];

  const { data } = await runQueryOr<MembershipRow[]>("host_members.for_user", [], (client) =>
    client
      .from("host_members")
      .select("host_id, role, hosts(name, slug, timezone)")
      .eq("user_email", email)
      .returns<MembershipRow[]>()
  );

  return data.map((row) => ({
    hostId: row.host_id,
    name: row.hosts?.name ?? null,
    slug: row.hosts?.slug ?? null,
    timezone: row.hosts?.timezone ?? "America/Denver",
    role: row.role,
  }));
});

/**
 * The fleet for this request.
 *
 * Order: the fleet picked in the switcher (if the user is still a member of it),
 * then their first membership, then the default fleet. The cookie is validated
 * against membership on every read rather than trusted — a cookie is
 * user-controlled input, and without that check anyone could read another
 * fleet's data by editing it.
 */
export const getCurrentHostId = cache(async function getCurrentHostId(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const fleets = await getFleetsForUser(email);

  if (fleets.length === 0) {
    // Locally the app is an open shell, so no membership means the default
    // fleet — exactly how this behaved before multi-tenancy.
    if (!requiresAuth()) return DEFAULT_HOST_ID;

    // On a hosted deployment it must not. The Google provider accepts ANY
    // Google account, so "signed in" is not "authorised" — without this,
    // anyone on the internet could sign in and read the default fleet.
    //
    // Returning a sentinel rather than throwing or gating in a layout is
    // deliberate: every query in the app is host_id-scoped, so a host id that
    // matches no row makes each one return empty by construction. There is no
    // render path that can leak, which is not true of a layout-level check —
    // see src/middleware.ts for how that failed twice.
    return NO_FLEET_HOST_ID;
  }

  const selected = (await cookies()).get(SELECTED_HOST_COOKIE)?.value ?? null;
  if (selected && fleets.some((f) => f.hostId === selected)) return selected;

  return fleets[0].hostId;
});

/**
 * A syntactically valid uuid that is never a real fleet. Used for a signed-in
 * user with no membership on a hosted deployment: queries run and return
 * nothing instead of being skipped, so no code path has to remember to check.
 */
export const NO_FLEET_HOST_ID = "00000000-0000-0000-0000-000000000000";

/** True when the viewer is signed in but belongs to no fleet on this deployment. */
export async function hasNoFleetAccess(): Promise<boolean> {
  return (await getCurrentHostId()) === NO_FLEET_HOST_ID;
}

/** The current fleet's full record, for display. Null when on the default fleet. */
export const getCurrentFleet = cache(async function getCurrentFleet(): Promise<FleetMembership | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const hostId = await getCurrentHostId();

  const fleets = await getFleetsForUser(email);
  return fleets.find((f) => f.hostId === hostId) ?? null;
});

/** True when this user may write to the fleet they are currently viewing. */
export async function canEditCurrentFleet(): Promise<boolean> {
  // Signed in but invited to nothing: read-only, and there is nothing to read.
  if (await hasNoFleetAccess()) return false;

  const fleet = await getCurrentFleet();
  // No membership row at all is single-tenant local mode, which stays
  // writable — the pre-multi-tenancy behaviour. hasNoFleetAccess() above has
  // already excluded the hosted case, so this cannot grant write access to a
  // stranger on the internet.
  if (!fleet) return true;
  return fleet.role === "owner" || fleet.role === "member";
}

export { SELECTED_HOST_COOKIE };
