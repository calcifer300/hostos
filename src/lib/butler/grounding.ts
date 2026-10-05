import "server-only";
import { getKnowledgeBase } from "@/lib/knowledge/queries";
import { findRelevantPolicy, type TuroArticle } from "@/lib/library/queries";
import { getReplyTemplates, type ReplyTemplate } from "@/lib/templates/queries";
import type { ButlerSource, HostKnowledgeBase } from "@/types/butler";

/**
 * What the Butler is allowed to know, assembled per request.
 *
 * Three sources, each with a different authority:
 *   - the workspace's own knowledge base (how THEY operate);
 *   - saved reply templates (their own words, reused);
 *   - Turo's published policy (what the platform allows), retrieved only when
 *     the message looks like it needs it.
 *
 * Every draft and answer cites which of these it used, so a person can check
 * the claim rather than trust it.
 */

export interface Grounding {
  knowledge: HostKnowledgeBase;
  policy: TuroArticle[];
  templates: ReplyTemplate[];
  sources: ButlerSource[];
}

function knowledgeIsCustom(kb: HostKnowledgeBase): boolean {
  return Boolean(kb.checkInProcess || kb.houseRules || kb.policy);
}

export async function buildGrounding(
  hostId: string,
  message: string,
  options: { module?: "fleet" | "restaurants"; policy?: boolean } = {}
): Promise<Grounding> {
  const wantPolicy = options.policy ?? options.module !== "restaurants";

  const [knowledge, policy, allTemplates] = await Promise.all([
    getKnowledgeBase(hostId),
    wantPolicy ? findRelevantPolicy(message) : Promise.resolve([] as TuroArticle[]),
    getReplyTemplates(hostId),
  ]);

  const templates = allTemplates.filter((t) => !options.module || t.module === options.module || t.module === "other");

  const sources: ButlerSource[] = [];
  if (knowledgeIsCustom(knowledge)) sources.push({ title: "Workspace knowledge base", url: null, kind: "knowledge" });
  for (const p of policy) sources.push({ title: p.title, url: p.url, kind: "policy" });
  for (const t of templates.slice(0, 6)) sources.push({ title: `Template: ${t.title}`, url: null, kind: "template" });

  return { knowledge, policy, templates, sources };
}
