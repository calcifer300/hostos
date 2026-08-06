import "server-only";
import { geminiProvider } from "@/lib/ai/gemini";
import type { AiProvider } from "@/lib/ai/types";

export { AiNotConfiguredError } from "@/lib/ai/types";
export type { AiProvider, AiJsonRequest } from "@/lib/ai/types";

/**
 * Registry of available providers. To add one later, implement AiProvider
 * in its own file, register it here, and set AI_PROVIDER — nothing in
 * `src/lib/ihost/` needs to change.
 */
const providers: Record<string, AiProvider> = {
  gemini: geminiProvider,
};

const DEFAULT_PROVIDER = "gemini";

/** The active provider, selected by AI_PROVIDER (defaults to gemini). */
export function getAiProvider(): AiProvider {
  const requested = process.env.AI_PROVIDER?.trim().toLowerCase() || DEFAULT_PROVIDER;
  return providers[requested] ?? providers[DEFAULT_PROVIDER];
}

/** True when the active provider has its API key configured. */
export function isAiConfigured(): boolean {
  return getAiProvider().isConfigured();
}
