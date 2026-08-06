import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";
import { defaultKnowledgeBase } from "@/lib/mock/seed-emails";
import type { HostKnowledgeBase } from "@/types/ihost";

interface KnowledgeRow {
  user_email: string;
  check_in_process: string;
  house_rules: string;
  policy: string;
  tone: string;
  updated_at: string;
}

/**
 * Reads the host's knowledge base, falling back to the shipped defaults when
 * nothing has been saved yet. Never throws: iHost still needs grounding text
 * even if Supabase is unreachable.
 */
export async function getKnowledgeBase(userEmail: string): Promise<HostKnowledgeBase> {
  if (!isSupabaseConfigured()) return defaultKnowledgeBase;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("knowledge_base")
      .select("*")
      .eq("user_email", userEmail)
      .maybeSingle<KnowledgeRow>();

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[knowledge] Failed to load knowledge base:", error.message);
      }
      return defaultKnowledgeBase;
    }

    if (!data) return defaultKnowledgeBase;

    return {
      checkInProcess: data.check_in_process,
      houseRules: data.house_rules,
      policy: data.policy,
      tone: data.tone,
    };
  } catch (err) {
    console.error("[knowledge] Failed to load knowledge base:", err);
    return defaultKnowledgeBase;
  }
}

/** True when the host has saved their own knowledge base rather than using defaults. */
export async function hasSavedKnowledgeBase(userEmail: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("knowledge_base")
      .select("user_email")
      .eq("user_email", userEmail)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}
