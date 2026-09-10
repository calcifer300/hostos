import "server-only";
import { runQueryOr } from "@/lib/supabase/server";
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
  const { data } = await runQueryOr<KnowledgeRow | null>("knowledge_base.get", null, (client) =>
    client.from("knowledge_base").select("*").eq("user_email", userEmail).maybeSingle<KnowledgeRow>()
  );

  if (!data) return defaultKnowledgeBase;

  return {
    checkInProcess: data.check_in_process,
    houseRules: data.house_rules,
    policy: data.policy,
    tone: data.tone,
  };
}

/**
 * True when the host has saved their own knowledge base rather than using
 * defaults. A failed read answers "false", which only softens the copy on the
 * Knowledge page ("showing the starting defaults") — never a wrong claim that
 * unreachable data was saved.
 */
export async function hasSavedKnowledgeBase(userEmail: string): Promise<boolean> {
  const { data } = await runQueryOr<{ user_email: string } | null>("knowledge_base.exists", null, (client) =>
    client
      .from("knowledge_base")
      .select("user_email")
      .eq("user_email", userEmail)
      .maybeSingle<{ user_email: string }>()
  );

  return Boolean(data);
}
