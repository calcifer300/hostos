import "server-only";

/**
 * Single source of truth for server environment configuration.
 *
 * Previously each module read `process.env` directly and invented its own
 * notion of "configured" — `src/auth.ts` threw at module scope, the Supabase
 * client threw lazily on first use, and every query module re-checked the
 * same two variables by hand. Those failure modes were inconsistent and,
 * worse, indistinguishable at the call site from "there is no data yet".
 *
 * This validates *shape*, not just presence: a URL that isn't a URL, or a
 * service-role key pasted with its surrounding quotes, fails here with an
 * actionable message instead of surfacing as malformed requests later.
 * Validation is memoized, so the cost is paid once per server process.
 */

export type EnvSeverity = "required" | "feature";

export interface EnvProblem {
  key: string;
  severity: EnvSeverity;
  /** What is wrong, in plain language. */
  problem: string;
  /** What the operator should actually do about it. */
  fix: string;
  /** The feature that stays offline while this is unset, for `feature` severity. */
  feature?: string;
}

export interface ServerEnv {
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  authSecret: string | null;
  geminiApiKey: string | null;
  geminiModel: string;
  gmailSyncEnabled: boolean;
  /** Per-request Supabase timeout budget, in ms. */
  supabaseTimeoutMs: number;
  problems: EnvProblem[];
}

const SINGLE_QUOTE = String.fromCharCode(39);

function read(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // A value wrapped in quotes is almost always a .env copy-paste artifact:
  // the quotes survive into the value and the resulting key or URL is
  // silently wrong in a way that only shows up as a 401 much later.
  const isWrapped =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith(SINGLE_QUOTE) && trimmed.endsWith(SINGLE_QUOTE));
  const unwrapped = isWrapped && trimmed.length >= 2 ? trimmed.slice(1, -1).trim() : trimmed;

  return unwrapped || null;
}

function readInt(key: string, fallback: number, min: number, max: number): number {
  const raw = read(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** Both key generations are valid: current `sb_secret_…` and legacy JWT `eyJ…`. */
function looksLikeServiceRoleKey(key: string): boolean {
  return key.startsWith("sb_secret_") || key.startsWith("eyJ");
}

function buildEnv(): ServerEnv {
  const problems: EnvProblem[] = [];

  // --- Supabase: required, every data-backed surface depends on it --------
  let supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    problems.push({
      key: "NEXT_PUBLIC_SUPABASE_URL",
      severity: "required",
      problem: "Not set.",
      fix: "Add NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co to .env.local (Supabase dashboard -> Project Settings -> Data API).",
    });
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(supabaseUrl);
    } catch {
      parsed = null;
    }

    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      problems.push({
        key: "NEXT_PUBLIC_SUPABASE_URL",
        severity: "required",
        problem: `Not a valid http(s) URL (got ${JSON.stringify(supabaseUrl)}).`,
        fix: "Use the full project URL including the scheme, e.g. https://abcdefgh.supabase.co — no trailing path.",
      });
      supabaseUrl = null;
    } else {
      // A trailing slash produces `//rest/v1/...` request paths, which PostgREST 404s.
      supabaseUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
    }
  }

  const supabaseServiceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseServiceRoleKey) {
    problems.push({
      key: "SUPABASE_SERVICE_ROLE_KEY",
      severity: "required",
      problem: "Not set.",
      fix: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard -> Project Settings -> API keys -> service_role / secret). Never expose it to the browser.",
    });
  } else if (!looksLikeServiceRoleKey(supabaseServiceRoleKey)) {
    // A publishable/anon key here is not an error the client reports: RLS is
    // enabled with no policies, so every read comes back as an empty set
    // that is indistinguishable from an empty table. Worth catching up front.
    problems.push({
      key: "SUPABASE_SERVICE_ROLE_KEY",
      severity: "required",
      problem: "Does not look like a service-role key.",
      fix: "Expected a key starting with 'sb_secret_' (current) or 'eyJ' (legacy JWT). A publishable/anon key is blocked by RLS and reads back as empty tables.",
    });
  }

  // --- Google sign-in: a feature, the app is a public shell without it ----
  const googleClientId = read("GOOGLE_CLIENT_ID");
  const googleClientSecret = read("GOOGLE_CLIENT_SECRET");
  if (!googleClientId || !googleClientSecret) {
    problems.push({
      key: !googleClientId ? "GOOGLE_CLIENT_ID" : "GOOGLE_CLIENT_SECRET",
      severity: "feature",
      feature: "Google sign-in and Gmail sync",
      problem: "Not set.",
      fix: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console -> APIs & Services -> Credentials. The app still runs signed-out without them.",
    });
  }

  const authSecret = read("AUTH_SECRET");
  if (!authSecret && process.env.NODE_ENV === "production") {
    problems.push({
      key: "AUTH_SECRET",
      severity: "required",
      problem: "Not set, and required in production.",
      fix: "Generate one with `npx auth secret`, then add AUTH_SECRET to the deployment environment.",
    });
  }

  // --- AI: a feature, only the briefing/draft surfaces use it -------------
  const geminiApiKey = read("GEMINI_API_KEY");
  if (!geminiApiKey) {
    problems.push({
      key: "GEMINI_API_KEY",
      severity: "feature",
      feature: "AI briefing and reply drafting",
      problem: "Not set.",
      fix: "Add GEMINI_API_KEY to .env.local to enable AI features. Every other dashboard surface renders without it.",
    });
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    googleClientId,
    googleClientSecret,
    authSecret,
    geminiApiKey,
    // Kept in step with DEFAULT_GEMINI_MODEL in lib/ai/gemini.ts.
    geminiModel: read("GEMINI_MODEL") ?? "gemini-3.6-flash",
    gmailSyncEnabled: read("GMAIL_SYNC_ENABLED") === "true",
    supabaseTimeoutMs: readInt("SUPABASE_TIMEOUT_MS", 6000, 1000, 30000),
    problems,
  };
}

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cached) cached = buildEnv();
  return cached;
}

/** True when Supabase is configured well enough that a query is worth attempting. */
export function isSupabaseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

/**
 * Startup diagnostics, printed once from `src/instrumentation.ts`.
 *
 * `required` problems are loud and actionable but deliberately non-fatal:
 * this app is built to render a degraded shell rather than fail to boot, and
 * a hard exit here would make a misconfigured deployment impossible to
 * introspect through its own UI.
 */
export function reportEnvOnStartup(): void {
  const { problems } = getServerEnv();

  if (problems.length === 0) {
    console.info("[env] All environment variables present and well-formed.");
    return;
  }

  const required = problems.filter((p) => p.severity === "required");
  const features = problems.filter((p) => p.severity === "feature");

  if (required.length > 0) {
    console.error(
      `\n[env] ${required.length} required environment variable${required.length === 1 ? "" : "s"} missing or invalid — data-backed pages will render empty:\n` +
        required.map((p) => `  x ${p.key}: ${p.problem}\n    -> ${p.fix}`).join("\n") +
        "\n"
    );
  }

  if (features.length > 0) {
    console.warn(
      `[env] ${features.length} optional integration${features.length === 1 ? "" : "s"} not configured:\n` +
        features.map((p) => `  - ${p.key} — ${p.feature} disabled.\n    -> ${p.fix}`).join("\n")
    );
  }
}
