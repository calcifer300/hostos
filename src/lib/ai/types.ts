/**
 * Provider-agnostic contract for HostOS's AI layer.
 *
 * Every AI feature talks to this interface, never to a vendor SDK directly,
 * so swapping providers means adding one file under `src/lib/ai/` and
 * changing AI_PROVIDER — not touching iHost's prompts or call sites.
 */

export interface AiJsonRequest {
  /** System instruction: role, rules, required output shape. */
  system: string;
  /** The actual content to reason over. */
  user: string;
  /** Upper bound on generated tokens. */
  maxOutputTokens?: number;
}

/**
 * Thrown when the provider has no API key configured. Distinct from a real
 * API failure so callers can render a calm "not set up yet" state instead
 * of an error.
 */
export class AiNotConfiguredError extends Error {
  constructor(message = "Gemini API key is missing.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export interface AiProvider {
  /** Identifier used in logs and diagnostics, e.g. "gemini". */
  readonly name: string;
  /** Model this provider will call. */
  readonly model: string;
  /** False when the API key is absent — check before doing any work. */
  isConfigured(): boolean;
  /**
   * Runs one structured request and returns the raw JSON text the model
   * produced. Parsing and validation stay with the caller, which owns the
   * schema. Throws AiNotConfiguredError when no key is set.
   */
  generateJson(request: AiJsonRequest): Promise<string>;
}
