import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";

export { isSupabaseConfigured };

/**
 * Service-role Supabase client and the resilient query wrapper every read
 * goes through.
 *
 * Bypasses RLS, so this must only ever be imported from server-only code —
 * the `server-only` import above turns an accidental client-bundle import
 * into a build error rather than a leaked secret.
 *
 * WHY THIS IS MORE THAN `createClient`
 * ------------------------------------
 * Every query module used to hand-roll the same defensive block: check two
 * env vars, try/catch, check `error.code` against the missing-table codes,
 * `console.error(error.message)`, return an empty value. That shape has three
 * production failure modes, all of which we hit:
 *
 *  1. postgrest-js does NOT throw on a transport failure. It resolves with
 *     `{ error: { message: "TypeError: fetch failed", code: "" }, status: 0 }`.
 *     An empty `code` matches no missing-table check, so a dead backend was
 *     logged as an anonymous error and then converted into `[]` — the UI
 *     confidently rendered "no trips, no vehicles, no messages" while the
 *     database was simply unreachable.
 *  2. When the backend answers with a gateway error page (Cloudflare 521 for
 *     a paused Supabase project), `error.message` is the *entire HTML
 *     document*. That went straight into `console.error`, burying the logs.
 *  3. postgrest-js retries idempotent requests 3x with 1s/2s/4s backoff. With
 *     six parallel dashboard queries and no deadline, an unreachable backend
 *     turned every page render into a multi-second stall before showing
 *     those same empty states.
 *
 * So: one wrapper, one classification of what actually went wrong, one
 * bounded deadline, one circuit breaker, and a health record the UI can read
 * to tell the truth about why a page is empty.
 */

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export type FailureKind =
  /** Env vars absent or malformed — a setup step, not an outage. */
  | "unconfigured"
  /** Migration not run yet. Expected on a fresh install; never alarming. */
  | "missing_table"
  /** DNS, TLS, connection refused, timeout, or a 5xx/52x gateway page. */
  | "unreachable"
  /** Key rejected: wrong key, revoked key, or an anon key where service-role was needed. */
  | "unauthorized"
  /** PostgREST understood the request and refused it — a real bug in our query. */
  | "query_error";

export interface SupabaseFailure {
  kind: FailureKind;
  /** Short, log-safe description. Never an HTML page, never a stack. */
  reason: string;
  /** What an operator should do about it. */
  hint: string;
  /** The logical operation that failed, e.g. "trips.list". */
  op: string;
}

export type QueryOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; failure: SupabaseFailure };

/** Shape shared by every PostgrestResponse / PostgrestSingleResponse. */
interface PostgrestLike<T> {
  data: T | null;
  error: { message?: string; code?: string; details?: string; hint?: string } | null;
  status?: number;
}

const MISSING_TABLE_CODES = new Set(["PGRST205", "PGRST202", "42P01"]);
const UNAUTHORIZED_CODES = new Set(["PGRST301", "PGRST302", "42501"]);

/**
 * True when a query failed because the table doesn't exist yet (migration not
 * run) — a setup step, not a bug, so callers degrade quietly.
 *
 * `PGRST205` ("Could not find the table ... in the schema cache") is what
 * PostgREST actually returns; the raw Postgres code `42P01` is kept in case a
 * query ever runs outside the REST client.
 *
 * Retained as a named export because call sites outside this module (the
 * Companion ingest routes) branch on it to produce a setup-specific message.
 */
export function isUndefinedTableError(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_TABLE_CODES.has(error.code));
}

/**
 * True when a write failed because a *column* doesn't exist yet — a migration
 * that hasn't been run, not a bug.
 *
 * Worth its own helper because PostgREST does not phrase this the way Postgres
 * does. A missing column on an insert/update comes back as `PGRST204` with
 * "Could not find the 'guest_checked_at' column of 'trips' in the schema
 * cache" — so the obvious `/column .* does not exist/` test (which matches the
 * raw Postgres 42703 wording) silently misses every real case, and an
 * un-migrated install gets an opaque 502 instead of "run this migration".
 */
export function isUndefinedColumnError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;

  const message = error.message ?? "";
  return /could not find the .* column/i.test(message) || /column .* does not exist/i.test(message);
}

/** Collapses an HTML error page or an over-long message into one log-safe line. */
function summarize(raw: string | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return "No error message returned.";

  if (/^\s*<(?:!doctype|html|head|body)\b/i.test(message)) {
    const title = message.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)?.[1]?.trim();
    return title
      ? `Gateway returned an HTML error page: "${title.replace(/\s+/g, " ")}"`
      : "Gateway returned an HTML error page instead of JSON.";
  }

  const oneLine = message.replace(/\s+/g, " ");
  return oneLine.length > 300 ? `${oneLine.slice(0, 297)}...` : oneLine;
}

/** Walks an unknown thrown value for a network-ish error code (undici nests these in `cause`). */
function networkCodeOf(err: unknown): string | null {
  const seen = new Set<unknown>();
  let node: unknown = err;

  for (let depth = 0; depth < 5 && node && typeof node === "object"; depth += 1) {
    if (seen.has(node)) break;
    seen.add(node);

    const code = (node as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
    node = (node as { cause?: unknown }).cause;
  }
  return null;
}

const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "ABORT_ERR",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function hintFor(kind: FailureKind, detail: string): string {
  switch (kind) {
    case "unconfigured":
      return "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server.";
    case "missing_table":
      return "Run the pending SQL in supabase/migrations/ against this project.";
    case "unreachable":
      return detail.includes("paused")
        ? "The Supabase project looks paused or stopped. Open the Supabase dashboard and resume it."
        : "Check that the Supabase project is running and reachable (dashboard -> project status), and that NEXT_PUBLIC_SUPABASE_URL points at it.";
    case "unauthorized":
      return "Re-copy SUPABASE_SERVICE_ROLE_KEY from Supabase dashboard -> Project Settings -> API keys. A publishable/anon key is blocked by RLS.";
    case "query_error":
      return "This is a bug in the query, not the environment — check the column and table names against supabase/migrations/.";
  }
}

/** Classifies a resolved-but-failed PostgREST response. */
function classifyResponse(op: string, error: NonNullable<PostgrestLike<unknown>["error"]>, status?: number): SupabaseFailure {
  const reason = summarize(error.message);
  const code = error.code ?? "";

  let kind: FailureKind;

  if (isUndefinedTableError(error)) {
    kind = "missing_table";
  } else if (UNAUTHORIZED_CODES.has(code) || status === 401 || status === 403 || /invalid api key|jwt|api key/i.test(reason)) {
    kind = "unauthorized";
  } else if (
    // postgrest-js reports transport failures as status 0 with an empty code.
    status === 0 ||
    (typeof status === "number" && status >= 500) ||
    /^(?:TypeError|FetchError|Error): fetch failed/i.test(reason) ||
    /html error page/i.test(reason) ||
    NETWORK_ERROR_CODES.has(code)
  ) {
    kind = "unreachable";
  } else {
    kind = "query_error";
  }

  // A Cloudflare 52x in front of a Supabase project almost always means the
  // project itself is paused/stopped rather than a transient network blip.
  const detail =
    kind === "unreachable" && typeof status === "number" && status >= 520 && status <= 527
      ? `${reason} (origin returned ${status} — project may be paused)`
      : reason;

  return { kind, reason: detail, hint: hintFor(kind, detail), op };
}

/** Classifies a thrown exception (network error that escaped, or a bug). */
function classifyThrown(op: string, err: unknown): SupabaseFailure {
  const message = err instanceof Error ? err.message : String(err);
  const code = networkCodeOf(err);
  const isAbort = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");

  const kind: FailureKind =
    isAbort || (code && NETWORK_ERROR_CODES.has(code)) || /fetch failed|network|socket|timeout/i.test(message)
      ? "unreachable"
      : "query_error";

  const reason = isAbort
    ? `Timed out after ${getServerEnv().supabaseTimeoutMs}ms.`
    : summarize(code ? `${message} (${code})` : message);

  return { kind, reason, hint: hintFor(kind, reason), op };
}

// ---------------------------------------------------------------------------
// Health registry + circuit breaker
// ---------------------------------------------------------------------------

export type BackendState = "ok" | "unconfigured" | "degraded" | "unknown";

export interface BackendHealth {
  state: BackendState;
  /** Populated when state is "degraded" or "unconfigured". */
  failure: SupabaseFailure | null;
  /** True while the breaker is short-circuiting queries. */
  circuitOpen: boolean;
  lastOkAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
}

/**
 * Opening after 2 consecutive transport failures rather than 1 keeps a single
 * dropped connection from flipping the whole app into degraded mode. The six
 * parallel dashboard queries all start before any of them fails, so the first
 * render against a dead backend still pays one timeout — every render after
 * that is short-circuited until the cooldown expires.
 */
const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 15_000;

interface Breaker {
  consecutiveFailures: number;
  openedAt: number | null;
  probeInFlight: boolean;
  lastFailure: SupabaseFailure | null;
  lastOkAt: number | null;
  lastFailureAt: number | null;
}

/**
 * Module state survives across requests within a server process, which is
 * exactly what makes the breaker useful; it is intentionally per-process and
 * needs no coordination, since being wrong costs one extra probe.
 */
const breaker: Breaker = {
  consecutiveFailures: 0,
  openedAt: null,
  probeInFlight: false,
  lastFailure: null,
  lastOkAt: null,
  lastFailureAt: null,
};

function recordSuccess(): void {
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
  breaker.probeInFlight = false;
  breaker.lastFailure = null;
  breaker.lastOkAt = Date.now();
}

function recordFailure(failure: SupabaseFailure): void {
  breaker.lastFailure = failure;
  breaker.lastFailureAt = Date.now();

  // Only transport failures trip the breaker. A missing table or a bad query
  // is perfectly reachable — retrying instantly is correct for those.
  if (failure.kind !== "unreachable") return;

  breaker.consecutiveFailures += 1;
  breaker.probeInFlight = false;
  if (breaker.consecutiveFailures >= FAILURE_THRESHOLD && breaker.openedAt === null) {
    breaker.openedAt = Date.now();
  }
}

/** "closed" = let it through, "open" = short-circuit, "half_open" = allow one probe. */
function breakerState(): "closed" | "open" | "half_open" {
  if (breaker.openedAt === null) return "closed";
  if (Date.now() - breaker.openedAt < COOLDOWN_MS) return "open";
  return breaker.probeInFlight ? "open" : "half_open";
}

/** Current backend health, for status UI. Never performs I/O. */
export function getBackendHealth(): BackendHealth {
  if (!isSupabaseConfigured()) {
    return {
      state: "unconfigured",
      failure: {
        kind: "unconfigured",
        reason: "Supabase environment variables are missing or invalid.",
        hint: hintFor("unconfigured", ""),
        op: "config",
      },
      circuitOpen: false,
      lastOkAt: null,
      lastFailureAt: breaker.lastFailureAt,
      consecutiveFailures: breaker.consecutiveFailures,
    };
  }

  const degraded = breaker.lastFailure?.kind === "unreachable" || breaker.lastFailure?.kind === "unauthorized";

  return {
    state: degraded ? "degraded" : breaker.lastOkAt ? "ok" : "unknown",
    failure: degraded ? breaker.lastFailure : null,
    circuitOpen: breakerState() === "open",
    lastOkAt: breaker.lastOkAt,
    lastFailureAt: breaker.lastFailureAt,
    consecutiveFailures: breaker.consecutiveFailures,
  };
}

/** Test/ops hook: forget everything the breaker has learned. */
export function resetBackendHealth(): void {
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
  breaker.probeInFlight = false;
  breaker.lastFailure = null;
  breaker.lastOkAt = null;
  breaker.lastFailureAt = null;
}

// ---------------------------------------------------------------------------
// Structured, rate-limited logging
// ---------------------------------------------------------------------------

const LOG_WINDOW_MS = 30_000;
const logState = new Map<string, { at: number; suppressed: number }>();

/**
 * One line per distinct (op, kind) per window. Without this, a dead backend
 * produced one multi-line error per query per render — six per dashboard load,
 * every few seconds, which is how the real message got lost.
 */
function logFailure(failure: SupabaseFailure): void {
  // A missing table is a setup step the UI already explains. Never log it.
  if (failure.kind === "missing_table") return;

  const key = `${failure.op}:${failure.kind}`;
  const now = Date.now();
  const prev = logState.get(key);

  if (prev && now - prev.at < LOG_WINDOW_MS) {
    prev.suppressed += 1;
    return;
  }

  const repeated = prev?.suppressed ? ` (+${prev.suppressed} more in the last ${LOG_WINDOW_MS / 1000}s)` : "";
  logState.set(key, { at: now, suppressed: 0 });

  const line = `[supabase] ${failure.op} failed: ${failure.kind} — ${failure.reason}${repeated}\n           fix: ${failure.hint}`;

  if (failure.kind === "query_error") console.error(line);
  else console.warn(line);
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let cached: SupabaseClient | null = null;

/**
 * Bounds every individual HTTP attempt. postgrest-js retries idempotent reads
 * internally, so without a per-attempt ceiling a single hung socket could
 * hold a page render open far past any deadline we set around the query.
 */
function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { supabaseTimeoutMs } = getServerEnv();
  const timeout = AbortSignal.timeout(supabaseTimeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

/**
 * Throws when Supabase is unconfigured. Call sites that render UI should use
 * `runQuery`, which turns that into a typed failure instead.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server."
    );
  }

  cached = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: timeoutFetch,
      headers: { "x-application-name": "hostos" },
    },
  });
  return cached;
}

/** Non-throwing variant for route handlers that must answer with a status code. */
export function tryGetSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// runQuery — the single path every read goes through
// ---------------------------------------------------------------------------

function unconfiguredFailure(op: string): SupabaseFailure {
  return {
    kind: "unconfigured",
    reason: "Supabase environment variables are missing or invalid.",
    hint: hintFor("unconfigured", ""),
    op,
  };
}

/**
 * Runs one Supabase read with a config guard, a circuit breaker, a hard
 * deadline, error classification, and rate-limited structured logging.
 *
 * Never throws and never rejects: callers get a discriminated outcome, so
 * "the query returned nothing" and "we could not reach the database" stop
 * being the same value. That distinction is what lets the UI say which one
 * actually happened.
 *
 * @param op    Stable identifier for logs and health, e.g. "trips.list".
 * @param run   Builds and awaits the query. Receives the live client.
 */
export async function runQuery<T>(
  op: string,
  run: (client: SupabaseClient) => PromiseLike<PostgrestLike<T>>
): Promise<QueryOutcome<T>> {
  if (!isSupabaseConfigured()) {
    const failure = unconfiguredFailure(op);
    logFailure(failure);
    return { ok: false, failure };
  }

  const state = breakerState();
  if (state === "open") {
    // Short-circuit: no socket, no retry storm, no multi-second stall. The
    // recorded failure is reused so the UI still explains itself.
    const failure = breaker.lastFailure ?? {
      kind: "unreachable" as const,
      reason: "Supabase is unreachable; requests are paused briefly before retrying.",
      hint: hintFor("unreachable", ""),
      op,
    };
    return { ok: false, failure: { ...failure, op } };
  }
  if (state === "half_open") breaker.probeInFlight = true;

  const { supabaseTimeoutMs } = getServerEnv();

  try {
    const client = getSupabaseAdmin();

    // Deadline around the *whole* call, including postgrest-js's internal
    // retry chain (1s + 2s + 4s of backoff), which the per-attempt fetch
    // timeout alone does not bound.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Supabase query "${op}" exceeded ${supabaseTimeoutMs}ms.`);
        err.name = "TimeoutError";
        reject(err);
      }, supabaseTimeoutMs);
    });

    let response: PostgrestLike<T>;
    try {
      response = await Promise.race([run(client), deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (response.error) {
      const failure = classifyResponse(op, response.error, response.status);
      recordFailure(failure);
      logFailure(failure);
      return { ok: false, failure };
    }

    recordSuccess();
    return { ok: true, data: response.data as T };
  } catch (err) {
    const failure = classifyThrown(op, err);
    recordFailure(failure);
    logFailure(failure);
    return { ok: false, failure };
  }
}

/**
 * Runs one Supabase *write* and reduces it to a user-facing outcome.
 *
 * Server actions previously returned `error.message` straight to the UI,
 * which surfaced driver text ("TypeError: fetch failed", PostgREST hints,
 * occasionally a whole HTML gateway page) inside a toast. This keeps the
 * detail in the log and hands the caller a sentence worth reading.
 */
export async function runMutation(
  op: string,
  run: (client: SupabaseClient) => PromiseLike<PostgrestLike<unknown>>
): Promise<{ ok: true } | { ok: false; error: string; kind: FailureKind }> {
  const outcome = await runQuery<unknown>(op, run);
  if (outcome.ok) return { ok: true };

  const { kind, hint } = outcome.failure;

  const message =
    kind === "unconfigured"
      ? "HostOS isn't connected to a database yet. Add your Supabase credentials to .env.local and restart."
      : kind === "missing_table"
        ? `That table hasn't been created yet. ${hint}`
        : kind === "unreachable"
          ? "Couldn't reach the database, so nothing was saved. Your change wasn't lost — try again in a moment."
          : kind === "unauthorized"
            ? "The database rejected our credentials, so nothing was saved. Check the Supabase service-role key."
            : "Couldn't save that. The problem has been logged.";

  return { ok: false, error: message, kind };
}

/**
 * `runQuery` for callers that only need a value and a "was this real data?"
 * flag. Returns the fallback for every failure kind, so a page renders
 * identically whether the table is empty, missing, or unreachable — while
 * `degraded` tells the caller which of those it was.
 */
export async function runQueryOr<T>(
  op: string,
  fallback: T,
  run: (client: SupabaseClient) => PromiseLike<PostgrestLike<T>>
): Promise<{ data: T; degraded: boolean; failure: SupabaseFailure | null }> {
  const outcome = await runQuery<T>(op, run);

  if (outcome.ok) {
    return { data: outcome.data ?? fallback, degraded: false, failure: null };
  }

  return {
    data: fallback,
    // "Missing table" and "unconfigured" are setup states the UI explains on
    // its own; only a reachable-backend problem counts as degraded service.
    degraded: outcome.failure.kind === "unreachable" || outcome.failure.kind === "unauthorized",
    failure: outcome.failure,
  };
}
