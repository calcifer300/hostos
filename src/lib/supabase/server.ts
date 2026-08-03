import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so this must only ever be
 * imported from server-only code (server actions, route handlers) — the
 * `server-only` import above turns an accidental client-bundle import into
 * a build error rather than a leaked secret.
 *
 * Deliberately lazy: creating the client at module scope meant a missing
 * env var threw during import, and anything that transitively imported this
 * (including the auth config, via Gmail token storage) failed to load at
 * all. Callers ask for the client only when they actually need it, so a
 * Supabase misconfiguration degrades one feature instead of breaking login
 * and the dashboard.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local for Gmail sync to work."
    );
  }

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cached;
}

/** True when Supabase is configured well enough to attempt a query. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
