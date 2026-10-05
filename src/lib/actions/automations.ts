"use server";

import { revalidatePath } from "next/cache";
import { runMutation } from "@/lib/supabase/server";
import { AUTOMATIONS } from "@/lib/automations/definitions";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";

export interface ToggleAutomationResult {
  ok: boolean;
  error?: string;
}

/**
 * Turns one automation on or off for the current FLEET.
 *
 * Fleet-scoped rather than account-scoped since migration 0013 — see
 * lib/automations/queries.ts. The authorisation question changed with it:
 * "may this person write to this fleet", not "is anyone signed in".
 */
export async function setAutomationEnabled(
  automationId: string,
  enabled: boolean
): Promise<ToggleAutomationResult> {
  if (await hasNoFleetAccess()) {
    return { ok: false, error: "Your fleet isn't set up yet. Reload the page and try again." };
  }

  if (!(await canEditCurrentFleet())) {
    return { ok: false, error: "You have read-only access to this fleet." };
  }

  // Only ids from the catalog may be written — the client shouldn't be able
  // to create arbitrary rows.
  if (!AUTOMATIONS.some((a) => a.id === automationId)) {
    return { ok: false, error: "Unknown automation." };
  }

  const hostId = await getCurrentHostId();

  const result = await runMutation("automation_settings.upsert", (client) =>
    client.from("automation_settings").upsert(
      {
        host_id: hostId,
        automation_id: automationId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host_id,automation_id" }
    )
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/automations");
  revalidatePath("/app/butler");
  return { ok: true };
}
