import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AiNotConfiguredError, type AiJsonRequest, type AiProvider } from "@/lib/ai/types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Values that mean "nobody has filled this in yet". Treated as unset so a
 * fresh clone shows "Gemini API key is missing." instead of a raw 403 from
 * the API rejecting the placeholder.
 */
const PLACEHOLDER_KEYS = new Set(["your_key_here", "your-key-here", "yourkeyhere", "changeme"]);

function readApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw) return null;
  if (PLACEHOLDER_KEYS.has(raw.toLowerCase())) return null;
  return raw;
}

/** The SDK surfaces API failures as a JSON blob; pull out the human-readable part. */
function toReadableError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const message = parsed?.error?.message;
      const code = parsed?.error?.code;
      if (typeof message === "string" && message.trim()) {
        return new Error(code ? `Gemini API error ${code}: ${message}` : `Gemini API error: ${message}`);
      }
    }
  } catch {
    // Fall through to the raw message below.
  }

  return new Error(`Gemini API error: ${raw}`);
}

/** Constructed lazily so a missing key never throws at module load. */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: AiProvider = {
  name: "gemini",

  get model() {
    return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  },

  isConfigured() {
    return readApiKey() !== null;
  },

  async generateJson({ system, user, maxOutputTokens = 1000 }: AiJsonRequest): Promise<string> {
    const ai = getClient();

    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          maxOutputTokens,
          // These are structured extraction tasks with an explicit output
          // schema, not open reasoning. Disabling thinking keeps the whole
          // token budget available for the answer — with it on, 2.5-flash
          // can spend the budget thinking and return nothing.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      text = response.text;
    } catch (err) {
      throw toReadableError(err);
    }

    if (!text || !text.trim()) {
      throw new Error("iHost returned no text content.");
    }

    return text;
  },
};
