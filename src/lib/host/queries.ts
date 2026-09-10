import "server-only";
import { cache } from "react";
import { runQuery, runQueryOr, type SupabaseFailure } from "@/lib/supabase/server";

/** The single seeded host row for this deployment (see migration 0003_trips.sql). */
export const DEFAULT_HOST_ID = "00000000-0000-0000-0000-000000000001";

export interface Host {
  id: string;
  name: string | null;
  email: string | null;
  companionApiKey: string | null;
}

interface HostRow {
  id: string;
  name: string | null;
  email: string | null;
  companion_api_key: string | null;
}

const HOST_COLUMNS = "id, name, email, companion_api_key";

function rowToHost(row: HostRow): Host {
  return { id: row.id, name: row.name, email: row.email, companionApiKey: row.companion_api_key };
}

/**
 * The host record for this deployment. Called while rendering pages, so it
 * must never throw: an unconfigured, un-migrated, or unreachable Supabase
 * means "no host yet", not a broken page.
 *
 * React-cache()'d because (app)/layout.tsx reads it for the sidebar's fleet
 * name while getDashboardData reads it again for the same render — two
 * identical `hosts` round trips per page load before this.
 */
export const getHost = cache(async function getHost(hostId?: string): Promise<Host | null> {
  // Takes an explicit id rather than calling getCurrentHostId() itself, which
  // would make lib/host/context.ts and this module import each other. Callers
  // that already resolved the fleet pass it; the rest get the default, which is
  // what this did unconditionally before multi-fleet existed.
  const id = hostId ?? DEFAULT_HOST_ID;

  const { data } = await runQueryOr<HostRow | null>("hosts.current", null, (client) =>
    client.from("hosts").select(HOST_COLUMNS).eq("id", id).maybeSingle<HostRow>()
  );

  return data ? rowToHost(data) : null;
});

/**
 * Resolves a host from a Companion bearer token.
 *
 * Returns a discriminated result rather than a bare `Host | null` because the
 * caller is an API route, and the two failure modes need different HTTP
 * statuses: an unrecognised key is a genuine 401, but an unreachable database
 * is a 503. Collapsing both to `null` told the Companion extension its
 * pairing key had been revoked every time the backend hiccuped — which is
 * exactly the signal that makes a client stop retrying and unpair itself.
 */
export type HostAuthResult =
  | { status: "ok"; host: Host }
  | { status: "unknown_key" }
  | { status: "unavailable"; failure: SupabaseFailure };

export async function authenticateCompanion(token: string): Promise<HostAuthResult> {
  if (!token.trim()) return { status: "unknown_key" };

  const outcome = await runQuery<HostRow | null>("hosts.by_api_key", (client) =>
    client.from("hosts").select(HOST_COLUMNS).eq("companion_api_key", token).maybeSingle<HostRow>()
  );

  if (!outcome.ok) {
    // A missing table is a setup problem the operator can act on, but from
    // the extension's point of view the service simply isn't ready yet.
    return { status: "unavailable", failure: outcome.failure };
  }

  return outcome.data ? { status: "ok", host: rowToHost(outcome.data) } : { status: "unknown_key" };
}

/**
 * Back-compat wrapper for call sites that only care whether a key resolved.
 * Prefer `authenticateCompanion` in route handlers so an outage isn't
 * reported to the client as an authentication failure.
 */
export async function getHostByApiKey(token: string): Promise<Host | null> {
  const result = await authenticateCompanion(token);
  return result.status === "ok" ? result.host : null;
}
