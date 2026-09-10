"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";
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

  const result = await runMutation("automation_settings.upsert", (client) =>
    client.from("automation_settings").upsert(
      {
        user_email: email,
        automation_id: automationId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email,automation_id" }
    )
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/automations");
  return { ok: true };
}
