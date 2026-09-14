import "server-only";
import { getAiProvider, isAiConfigured, AiNotConfiguredError } from "@/lib/ai";
import { buildGrounding } from "@/lib/butler/grounding";
import { answerPrompt, briefingPrompt, fleetAnalysisPrompt, restaurantReplyPrompt } from "@/lib/butler/prompts";
import type { ButlerAnalysis, ButlerAnswer, ButlerBriefing, ButlerDraft, ButlerSource, InboundTuroEmail, TuroEventType } from "@/types/butler";

/**
 * The HostOS AI Butler — the one orchestrator every AI surface calls.
 *
 * Skills:
 *   analyzeFleetMessage  classify + summarise + draft a Turo guest message
 *   draftRestaurantReply draft a DoorDash customer reply for a store
 *   briefing             the morning digest from workspace signals
 *   answer               a grounded answer to an operations/policy question
 *
 * Each skill grounds itself through buildGrounding, so a draft on the
 * Companion, a draft on the restaurant page and an answer in the Butler chat
 * are all reading the same knowledge base, the same templates and the same
 * policy library. There is deliberately no other place that calls the
 * provider — lib/ai is the vendor layer, this is the product layer.
 */

export { AiNotConfiguredError, isAiConfigured };

const EVENT_TYPES = new Set<TuroEventType>(["guest_message", "id_verification", "reservation_time_change", "new_booking", "cancellation", "other"]);

function parseJson<T>(text: string, what: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Models occasionally wrap JSON in fences despite the instruction.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error(`The Butler's ${what} could not be parsed.`);
  }
}

const asString = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

/* ------------------------------------------------------------ fleet */

export async function analyzeFleetMessage(hostId: string, email: InboundTuroEmail): Promise<ButlerAnalysis & { sources: ButlerSource[] }> {
  const grounding = await buildGrounding(hostId, `${email.subject}\n${email.body}`, { module: "fleet" });

  const text = await getAiProvider().generateJson({
    system: fleetAnalysisPrompt(grounding.knowledge, grounding.policy, grounding.templates),
    user: `Guest name: ${email.guestName}\nVehicle: ${email.vehicle}\nSubject: ${email.subject}\n\nBody:\n${email.body}`,
    maxOutputTokens: 1000,
  });

  const raw = parseJson<Record<string, unknown>>(text, "analysis");
  const eventType = asString(raw.eventType) as TuroEventType;

  return {
    eventType: EVENT_TYPES.has(eventType) ? eventType : "other",
    summary: asString(raw.summary, "A message arrived."),
    actionRequired: Boolean(raw.actionRequired),
    actionReason: asString(raw.actionReason),
    draftReply: typeof raw.draftReply === "string" && raw.draftReply.trim() ? raw.draftReply : null,
    escalate: Boolean(raw.escalate),
    escalateReason: typeof raw.escalateReason === "string" && raw.escalateReason.trim() ? raw.escalateReason : null,
    sources: grounding.sources,
  };
}

/* ------------------------------------------------------- restaurants */

export async function draftRestaurantReply(
  hostId: string,
  restaurant: { name: string; notes: string | null; status: string },
  message: string,
  customerName: string | null
): Promise<ButlerDraft> {
  const grounding = await buildGrounding(hostId, message, { module: "restaurants", policy: false });

  const text = await getAiProvider().generateJson({
    system: restaurantReplyPrompt(grounding.knowledge, restaurant, grounding.templates),
    user: `Customer: ${customerName ?? "Unknown"}\n\nMessage:\n${message}`,
    maxOutputTokens: 700,
  });

  const raw = parseJson<Record<string, unknown>>(text, "draft");
  return {
    draft: asString(raw.draftReply),
    summary: asString(raw.summary),
    escalate: Boolean(raw.escalate),
    escalateReason: typeof raw.escalateReason === "string" && raw.escalateReason.trim() ? raw.escalateReason : null,
    sources: grounding.sources,
  };
}

/* ---------------------------------------------------------- briefing */

export interface BriefingSignal {
  /** Short category, e.g. "pickup", "risk", "store", "menu", "task", "email". */
  kind: string;
  text: string;
}

export async function briefing(signals: BriefingSignal[]): Promise<ButlerBriefing> {
  const text = await getAiProvider().generateJson({
    system: briefingPrompt(),
    user: signals.length
      ? signals.map((s, i) => `${i + 1}. [${s.kind}] ${s.text}`).join("\n")
      : "No signals today. The workspace is quiet.",
    maxOutputTokens: 700,
  });

  const raw = parseJson<Record<string, unknown>>(text, "briefing");
  return {
    headline: asString(raw.headline).trim() || `${signals.length} signals today.`,
    highlights: asStringArray(raw.highlights),
    priorities: asStringArray(raw.priorities),
    signalCount: signals.length,
  };
}

/* ------------------------------------------------------------ answer */

export async function answer(hostId: string, question: string): Promise<ButlerAnswer> {
  const grounding = await buildGrounding(hostId, question, { module: "fleet", policy: true });

  const text = await getAiProvider().generateJson({
    system: answerPrompt(grounding.knowledge, grounding.policy),
    user: question,
    maxOutputTokens: 700,
  });

  const raw = parseJson<Record<string, unknown>>(text, "answer");
  const cited = new Set(asStringArray(raw.citedTitles).map((t) => t.toLowerCase()));
  const sources = grounding.sources.filter((s) => s.kind === "knowledge" || cited.has(s.title.toLowerCase()));

  return {
    answer: asString(raw.answer).trim() || "I couldn't find that in your knowledge base or Turo's policy library.",
    uncertain: Boolean(raw.uncertain),
    sources: sources.length ? sources : grounding.sources.filter((s) => s.kind !== "template"),
  };
}
