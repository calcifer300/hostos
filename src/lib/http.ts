import "server-only";

/**
 * Outbound HTTP for third-party services (Gmail, Google OAuth).
 *
 * Node's `fetch` has no default timeout, so a hung upstream held a sync
 * request open until the platform killed it. It also reports every transport
 * problem as the same opaque `TypeError: fetch failed`, with the real cause
 * (DNS, refused connection, expired certificate) buried in `err.cause` — the
 * exact string that made the original dashboard failures so hard to place.
 *
 * Everything here is labelled with the service being called, so a failure
 * says which dependency broke rather than just that one did.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

/** A dependency is unavailable. Distinct from a 4xx, which means we asked wrongly. */
export class UpstreamUnavailableError extends Error {
  readonly service: string;
  readonly retryable = true;

  constructor(service: string, detail: string) {
    super(`${service} is unreachable: ${detail}`);
    this.name = "UpstreamUnavailableError";
    this.service = service;
  }
}

/** The upstream answered, but rejected the request. Retrying unchanged won't help. */
export class UpstreamResponseError extends Error {
  readonly service: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(service: string, status: number, detail: string) {
    super(`${service} responded ${status}: ${detail}`);
    this.name = "UpstreamResponseError";
    this.service = service;
    this.status = status;
    // 408/429 and 5xx are worth another attempt; a 400/401/403 is not.
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

/** Unwraps undici's nested `cause` chain to the actual OS-level error code. */
function causeChain(err: unknown): string {
  const parts: string[] = [];
  let node: unknown = err;

  for (let depth = 0; depth < 4 && node && typeof node === "object"; depth += 1) {
    const code = (node as { code?: unknown }).code;
    const message = (node as { message?: unknown }).message;
    if (typeof code === "string" && code) parts.push(code);
    else if (typeof message === "string" && message && depth > 0) parts.push(message);
    node = (node as { cause?: unknown }).cause;
  }

  return parts.length ? parts.join(" <- ") : "no further detail";
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * `fetch` with a hard timeout and errors that name the service.
 *
 * Does not check the response status — callers that need that should use
 * `fetchJsonOrThrow`, or inspect `res.ok` themselves.
 */
export async function fetchWithTimeout(
  service: string,
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: FetchOptions = {}
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new UpstreamUnavailableError(service, `no response within ${timeoutMs}ms`);
    }
    throw new UpstreamUnavailableError(service, causeChain(err));
  }
}

/** Bounded fetch plus status and JSON handling, with the body kept out of the message. */
export async function fetchJsonOrThrow<T>(
  service: string,
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const res = await fetchWithTimeout(service, url, options);

  if (!res.ok) {
    // Truncated: an upstream error body can be an entire HTML page, and these
    // messages reach logs (and occasionally users).
    const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new UpstreamResponseError(service, res.status, body || res.statusText);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamResponseError(service, res.status, "response was not valid JSON");
  }
}
