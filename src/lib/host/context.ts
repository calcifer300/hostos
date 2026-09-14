import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { runQueryOr } from "@/lib/supabase/server";
import { DEFAULT_HOST_ID } from "@/lib/host/queries";
import { provisionFleetForUser } from "@/lib/host/provision";
import { requiresAuth } from "@/lib/access";
import { can, type Permission } from "@/lib/roles/permissions";

/**
 * Resolves which fleet the current request is operating on.
 *
 * Every table has been host_id-keyed since migration 0003, but the app passed a
 * hardcoded DEFAULT_HOST_ID at all 19 call sites, so one deployment could only
 * ever serve one fleet. This is the single place that decision now lives.
 *
 * WHO GETS WHICH FLEET
 * --------------------
 * A signed-in user gets their own. Their first request provisions a fleet
 * named from their Google profile and makes them its owner, so the Google
 * provider accepting any account is no longer a problem: a stranger signing
 * in lands on their own empty fleet, never anyone else's data.
 *
 * A signed-OUT visitor still gets the default fleet, but only where the app
 * runs as an open shell (Project Aurora Phase 1) — locally. On a hosted
 * deployment middleware has already redirected them to /login, and if they
 * somehow reach here they resolve to NO_FLEET_HOST_ID instead.
 *
 * This never throws and never demands a session, so it stays safe to call
 * from any render path.
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
 * Every fleet this email may see, provisioning one on first sign-in.
 *
 * Empty for a signed-out visitor. For a signed-in user with no membership it
 * creates their own fleet rather than returning nothing — see
 * lib/host/provision.ts for why that happens here, in one React-cache()'d
 * function, rather than in a layout or in middleware.
 *
 * The short version: a layout provisioning on render races the pages beneath
 * it, which render in parallel and would resolve their host id before the
 * fleet existed. Middleware can't do it either — it runs on the edge and the
 * Supabase client is `server-only`. Doing it inside the cached read means
 * every caller in a request, whatever order they run in, awaits the same
 * single provisioning promise and sees the same answer.
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

  if (data.length > 0) {
    return data.map((row) => ({
      hostId: row.host_id,
      name: row.hosts?.name ?? null,
      slug: row.hosts?.slug ?? null,
      timezone: row.hosts?.timezone ?? "America/Denver",
      role: row.role,
    }));
  }

  // Nobody has invited this person and they own nothing yet. Provision only
  // for the account actually signed in on this request: this function is also
  // called with other people's addresses (the team list on Settings), and
  // reading someone's memberships must never create a fleet for them.
  const session = await auth();
  if (session?.user?.email !== email) return [];

  const created = await provisionFleetForUser(email, session.user?.name ?? null);
  if (!created) return [];

  return [
    {
      hostId: created.hostId,
      name: created.name,
      slug: created.slug,
      timezone: created.timezone,
      role: created.role,
    },
  ];
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
    // A signed-in user reaching here means provisioning failed — the database
    // was unreachable, or migration 0012 hasn't been applied. Fall through to
    // the sentinel rather than the default fleet: "we couldn't set you up" is
    // an empty app, never someone else's data.
    if (email) return NO_FLEET_HOST_ID;

    // Signed out. Locally the app is an open shell, so this is the default
    // fleet — exactly how it behaved before multi-tenancy.
    if (!requiresAuth()) return DEFAULT_HOST_ID;

    // On a hosted deployment it must not be. Middleware already redirects
    // anonymous traffic to /login, so this is defence in depth for any path
    // that skips it (the /api/turo GETs are exempted there by necessity).
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
 * A syntactically valid uuid that is never a real fleet. Queries run against
 * it and return nothing, instead of being skipped, so no code path has to
 * remember to check first.
 *
 * Reached in two cases now: an anonymous request on a gated deployment, and a
 * signed-in user whose fleet could not be provisioned (database down, or
 * migration 0012 not applied). Both are "show an empty app", never "show
 * whatever the default fleet has".
 */
export const NO_FLEET_HOST_ID = "00000000-0000-0000-0000-000000000000";

/**
 * True when this request resolved to no fleet at all — see NO_FLEET_HOST_ID.
 * For a signed-in user this means provisioning failed, which is a backend
 * problem worth telling them about rather than rendering as "no data yet".
 */
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

/**
 * Whether the signed-in person holds `permission` on the workspace they are
 * viewing. The matrix lives in lib/roles/permissions.ts.
 *
 * No membership row at all is single-tenant local mode, which stays fully
 * permitted — the pre-multi-tenancy behaviour. hasNoFleetAccess() excludes
 * the hosted case first, so this cannot grant anything to a stranger.
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  if (await hasNoFleetAccess()) return false;
  const fleet = await getCurrentFleet();
  if (!fleet) return true;
  return can(fleet.role, permission);
}

/** True when this user may write operational data to the workspace they are viewing. */
export async function canEditCurrentFleet(): Promise<boolean> {
  return hasPermission("workspace.write");
}

export async function canManageSettings(): Promise<boolean> {
  return hasPermission("workspace.settings");
}

export async function canManageIntegrations(): Promise<boolean> {
  return hasPermission("workspace.integrations");
}

export async function canManageMembers(): Promise<boolean> {
  return hasPermission("workspace.members");
}

export interface FleetMember {
  email: string;
  role: string;
  displayName: string | null;
  invitedBy: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

/**
 * Everyone on one fleet, for the Settings roster.
 *
 * Takes the host id from the caller rather than resolving it, so a caller
 * cannot accidentally list a fleet it did not first prove access to. Reading
 * it with NO_FLEET_HOST_ID returns nothing, by construction.
 */
export async function getFleetMembers(hostId: string): Promise<FleetMember[]> {
  interface Row {
    user_email: string;
    role: string;
    created_at: string;
    display_name?: string | null;
    invited_by?: string | null;
    invited_at?: string | null;
    accepted_at?: string | null;
  }

  const read = (columns: string) =>
    runQueryOr<Row[]>("host_members.for_fleet", [], (client) =>
      client.from("host_members").select(columns).eq("host_id", hostId).order("created_at", { ascending: true }).returns<Row[]>()
    );

  // The invitation columns arrive with migration 0024; before it, fall back
  // to the columns that have existed since 0009 rather than an empty roster.
  let { data, degraded } = await read("user_email, role, created_at, display_name, invited_by, invited_at, accepted_at");
  if (degraded && data.length === 0) {
    const fallback = await read("user_email, role, created_at");
    data = fallback.data;
    degraded = fallback.degraded;
  }

  return data.map((row) => ({
    email: row.user_email,
    role: row.role,
    displayName: row.display_name ?? null,
    invitedBy: row.invited_by ?? null,
    invitedAt: row.invited_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at,
  }));
}

export { SELECTED_HOST_COOKIE };
