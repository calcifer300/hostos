"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";
import { AUTOMATIONS } from "@/lib/automations/definitions";

export interface ToggleAutomationResult {
  ok: boolean;
  error?: string;
}

export async function setAutomationEnabled(
  automationId: string,
  enabled: boolean
): Promise<ToggleAutomationResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "You must be signed in to change automations." };
  }

  // Only ids from the catalog may be written — the client shouldn't be able
  // to create arbitrary rows.
  if (!AUTOMATIONS.some((a) => a.id === automationId)) {
    return { ok: false, error: "Unknown automation." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    };
  }

  try {
    const { error } = await getSupabaseAdmin().from("automation_settings").upsert(
      {
        user_email: email,
        automation_id: automationId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email,automation_id" }
    );

    if (error) {
      if (isUndefinedTableError(error)) {
        return {
          ok: false,
          error: "The automation_settings table doesn't exist yet. Run supabase/migrations/0002_knowledge_automations.sql.",
        };
      }
      return { ok: false, error: `Could not save: ${error.message}` };
    }

    revalidatePath("/automations");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}
