import "server-only";
import { runQueryOr } from "@/lib/supabase/server";
import { defaultKnowledgeBase } from "@/lib/mock/seed-emails";
import type { HostKnowledgeBase } from "@/types/ihost";

/**
 * The knowledge base belongs to a FLEET, not to a Google account.
 *
 * It was keyed on user_email because migration 0002 predates the hosts table.
 * That produced two wrong behaviours: a co-host invited to a fleet got their
 * own blank knowledge base (so Butler grounded replies in different text
 * depending on who was signed in), and a Companion-only operator with no
 * Google session could never save one at all. Migration 0013 adds host_id and
 * backfills it through fleet ownership.
 */

interface KnowledgeRow {
  host_id: string | null;
  check_in_process: string;
  house_rules: string;
  policy: string;
  tone: string;
  updated_at: string;
}

const COLUMNS = "host_id, check_in_process, house_rules, policy, tone, updated_at";

/**
 * Reads the fleet's knowledge base, falling back to the shipped defaults when
 * nothing has been saved yet. Never throws: iHost still needs grounding text
 * even if Supabase is unreachable.
 */
export async function getKnowledgeBase(hostId: string): Promise<HostKnowledgeBase> {
  const { data } = await runQueryOr<KnowledgeRow | null>("knowledge_base.get", null, (client) =>
    client.from("knowledge_base").select(COLUMNS).eq("host_id", hostId).maybeSingle<KnowledgeRow>()
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
 * True when this fleet has saved its own knowledge base rather than using
 * defaults. A failed read answers "false", which only softens the copy on the
 * Knowledge page ("showing the starting defaults") — never a wrong claim that
 * unreachable data was saved.
 */
export async function hasSavedKnowledgeBase(hostId: string): Promise<boolean> {
  const { data } = await runQueryOr<{ host_id: string } | null>("knowledge_base.exists", null, (client) =>
    client
      .from("knowledge_base")
      .select("host_id")
      .eq("host_id", hostId)
      .maybeSingle<{ host_id: string }>()
  );

  return Boolean(data);
}
