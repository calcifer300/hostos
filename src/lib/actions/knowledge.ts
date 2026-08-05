"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";

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

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    };
  }

  try {
    const { error } = await getSupabaseAdmin().from("knowledge_base").upsert(
      {
        user_email: email,
        check_in_process: input.checkInProcess,
        house_rules: input.houseRules,
        policy: input.policy,
        tone: input.tone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    );

    if (error) {
      if (isUndefinedTableError(error)) {
        return {
          ok: false,
          error: "The knowledge_base table doesn't exist yet. Run supabase/migrations/0002_knowledge_automations.sql.",
        };
      }
      return { ok: false, error: `Could not save: ${error.message}` };
    }

    revalidatePath("/knowledge");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}
