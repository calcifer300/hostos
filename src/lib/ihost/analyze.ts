import { getAiProvider } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ihost/prompt";
import type { HostKnowledgeBase, IHostAnalysis, InboundTuroEmail } from "@/types/ihost";

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
  const text = await getAiProvider().generateJson({
    system: buildSystemPrompt(kb),
    user: `Guest name: ${email.guestName}\nVehicle: ${email.vehicle}\nSubject: ${email.subject}\n\nBody:\n${email.body}`,
    maxOutputTokens: 1000,
  });

  let parsed: IHostAnalysis;
  try {
    parsed = JSON.parse(text) as IHostAnalysis;
  } catch {
    throw new Error("iHost's response could not be parsed as JSON.");
  }

  return parsed;
}
