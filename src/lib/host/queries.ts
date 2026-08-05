import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";

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

function rowToHost(row: HostRow): Host {
  return { id: row.id, name: row.name, email: row.email, companionApiKey: row.companion_api_key };
}

/**
 * The host record for this deployment. Called while rendering pages, so it
 * must never throw: an unconfigured or un-migrated Supabase means "no host
 * yet", not a broken page.
 */
export async function getHost(): Promise<Host | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("hosts")
      .select("id, name, email, companion_api_key")
      .limit(1)
      .maybeSingle<HostRow>();

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[host] Failed to load host:", error.message);
      }
      return null;
    }

    return data ? rowToHost(data) : null;
  } catch (err) {
    console.error("[host] Failed to load host:", err);
    return null;
  }
}

/**
 * Resolves a host from a Companion bearer token. Feeds an API auth check —
 * returns null on no match rather than throwing, so the route can turn that
 * into a plain 401.
 */
export async function getHostByApiKey(token: string): Promise<Host | null> {
  if (!token || !isSupabaseConfigured()) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("hosts")
      .select("id, name, email, companion_api_key")
      .eq("companion_api_key", token)
      .maybeSingle<HostRow>();

    if (error) return null;
    return data ? rowToHost(data) : null;
  } catch {
    return null;
  }
}
