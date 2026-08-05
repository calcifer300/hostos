"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";
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

  try {
    const { error } = await getSupabaseAdmin()
      .from("hosts")
      .update({ companion_api_key: apiKey })
      .eq("id", host.id);

    if (error) {
      if (isUndefinedTableError(error)) {
        return {
          ok: false,
          error: "The hosts table doesn't exist yet. Run supabase/migrations/0003_trips.sql.",
        };
      }
      return { ok: false, error: `Could not save: ${error.message}` };
    }

    revalidatePath("/settings");
    return { ok: true, apiKey };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not generate a pairing code." };
  }
}
