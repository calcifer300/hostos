"use server";

import { revalidatePath } from "next/cache";
import { runMutation } from "@/lib/supabase/server";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";

export interface SaveKnowledgeResult {
  ok: boolean;
  error?: string;
}

/**
 * Saves the current FLEET's knowledge base.
 *
 * Previously keyed on the signed-in Google address, which meant every member
 * of a fleet quietly maintained their own copy and a Companion-only operator
 * could not save at all. Now it writes the fleet's single row — so the check
 * is "may this person write to this fleet", not "is this person signed in".
 */
export async function saveKnowledgeBase(input: {
  checkInProcess: string;
  houseRules: string;
  policy: string;
  tone: string;
}): Promise<SaveKnowledgeResult> {
  if (await hasNoFleetAccess()) {
    return { ok: false, error: "Your fleet isn't set up yet. Reload the page and try again." };
  }

  if (!(await canEditCurrentFleet())) {
    return { ok: false, error: "You have read-only access to this fleet." };
  }

  const hostId = await getCurrentHostId();

  const result = await runMutation("knowledge_base.upsert", (client) =>
    client.from("knowledge_base").upsert(
      {
        host_id: hostId,
        check_in_process: input.checkInProcess,
        house_rules: input.houseRules,
        policy: input.policy,
        tone: input.tone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host_id" }
    )
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/knowledge");
  // Knowledge is a step on the Overview setup checklist.
  revalidatePath("/");
  return { ok: true };
}
