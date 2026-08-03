import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/ihost/prompt";
import type { HostKnowledgeBase, IHostAnalysis, InboundTuroEmail } from "@/types/ihost";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before iHost can analyze anything — see README."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Runs one inbound Turo email through iHost's analysis pipeline.
 * This is the entire "brain" of the v0.1 slice — classification,
 * summarization, action assessment, and reply drafting happen in a
 * single grounded call rather than four separate round trips, since
 * they all depend on the same context and a host should get one
 * coherent answer, not four inconsistent ones.
 */
export async function analyzeInboundEmail(
  email: InboundTuroEmail,
  kb: HostKnowledgeBase
): Promise<IHostAnalysis> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: buildSystemPrompt(kb),
    messages: [
      {
        role: "user",
        content: `Guest name: ${email.guestName}\nVehicle: ${email.vehicle}\nSubject: ${email.subject}\n\nBody:\n${email.body}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("iHost returned no text content.");
  }

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

  let parsed: IHostAnalysis;
  try {
    parsed = JSON.parse(cleaned) as IHostAnalysis;
  } catch {
    throw new Error("iHost's response could not be parsed as JSON.");
  }

  return parsed;
}
