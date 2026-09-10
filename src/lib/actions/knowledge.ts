"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";

export interface SaveKnowledgeResult {
  ok: boolean;
  error?: string;
}

export async function saveKnowledgeBase(input: {
  checkInProcess: string;
  houseRules: string;
  policy: string;
  tone: string;
}): Promise<SaveKnowledgeResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, error: "You must be signed in to edit your knowledge base." };
  }

  const result = await runMutation("knowledge_base.upsert", (client) =>
    client.from("knowledge_base").upsert(
      {
        user_email: email,
        check_in_process: input.checkInProcess,
        house_rules: input.houseRules,
        policy: input.policy,
        tone: input.tone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    )
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/knowledge");
  return { ok: true };
}
