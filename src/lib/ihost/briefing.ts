import "server-only";
import { getAiProvider } from "@/lib/ai";
import type { IHostBriefing } from "@/types/ihost";
import type { SyncedEmail } from "@/types/gmail";

const BRIEFING_SYSTEM_PROMPT = `You are iHost, the AI co-host inside HostOS, briefing a Turo host at the start of their day.

You will receive the host's most recently synced email messages. Summarize them into a short operational briefing and respond with JSON only.

STYLE (binding — see the iHost Personality Specification)
- Lead with facts. No greetings, no "I hope this finds you well".
- No exclamation points. No emoji. No corporate filler.
- One short sentence per highlight. Name the guest and what they want.
- Never invent details that are not in the messages.
- If something is ambiguous, describe it plainly rather than guessing.

CONTENT
- headline: one sentence covering the batch as a whole, e.g. "You received four guest messages today."
- highlights: one line per noteworthy message, in the order they matter. Skip pure noise (newsletters, receipts unrelated to hosting) rather than padding the list.
- priorities: concrete next actions for the host, most urgent first. Only include actions the messages actually justify. If nothing needs doing, return an empty array.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{
  "headline": "one sentence about the whole batch",
  "highlights": ["one line per noteworthy message"],
  "priorities": ["concrete action the host should take"]
}`;

/** Keep the prompt bounded — bodies can be enormous and add nothing past the first paragraphs. */
const MAX_BODY_CHARS = 1200;

function formatEmailsForPrompt(emails: SyncedEmail[]): string {
  return emails
    .map((e, i) => {
      const sender = e.fromName || e.fromEmail || "Unknown sender";
      const body = (e.body || e.snippet || "").slice(0, MAX_BODY_CHARS);
      return [
        `--- Message ${i + 1} ---`,
        `From: ${sender}`,
        `Received: ${e.receivedAt}`,
        `Unread: ${e.isUnread ? "yes" : "no"}`,
        e.vehicle ? `Vehicle: ${e.vehicle}` : null,
        `Subject: ${e.subject || "(no subject)"}`,
        "",
        body,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * Summarizes the newest synced Gmail messages into the dashboard briefing.
 * Callers are responsible for handling AiNotConfiguredError — a missing
 * key is a setup state, not a failure worth crashing the dashboard over.
 */
export async function generateBriefing(emails: SyncedEmail[]): Promise<IHostBriefing> {
  const text = await getAiProvider().generateJson({
    system: BRIEFING_SYSTEM_PROMPT,
    user: formatEmailsForPrompt(emails),
    maxOutputTokens: 700,
  });

  let parsed: { headline?: unknown; highlights?: unknown; priorities?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("iHost's briefing could not be parsed as JSON.");
  }

  return {
    headline:
      typeof parsed.headline === "string" && parsed.headline.trim()
        ? parsed.headline.trim()
        : `You have ${emails.length} recent ${emails.length === 1 ? "message" : "messages"}.`,
    highlights: asStringArray(parsed.highlights),
    priorities: asStringArray(parsed.priorities),
    messageCount: emails.length,
  };
}
