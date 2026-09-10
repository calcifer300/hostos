"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured, runMutation } from "@/lib/supabase/server";
import { getHost } from "@/lib/host/queries";

export interface RegenerateKeyResult {
  ok: boolean;
  apiKey?: string;
  error?: string;
}

/**
 * Issues a new Companion pairing key, invalidating any previous one. The
 * key is returned once for display/copy — callers must not assume it can be
 * re-read later (the DB only ever holds the current key, matching the
 * "keep the DB the source of truth, show a secret exactly once" pattern).
 */
export async function regenerateCompanionApiKey(): Promise<RegenerateKeyResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    };
  }

  const host = await getHost();
  if (!host) {
    return {
      ok: false,
      error: "No host record found. Run supabase/migrations/0003_trips.sql against your Supabase project.",
    };
  }

  const apiKey = `hostos_live_${crypto.randomUUID().replace(/-/g, "")}`;

  // The key is only ever shown once, so a failed write must not report
  // success — the host would copy a key the database never stored.
  const result = await runMutation("hosts.rotate_api_key", (client) =>
    client.from("hosts").update({ companion_api_key: apiKey }).eq("id", host.id)
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true, apiKey };
}
