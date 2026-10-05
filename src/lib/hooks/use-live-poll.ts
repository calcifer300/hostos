"use client";

import * as React from "react";

/**
 * Shared polling loop for the three live surfaces (Overview guest-messages
 * card, the Messages list, and a conversation thread).
 *
 * Each of them previously hand-rolled the same `setInterval` + bare try/catch.
 * That shape had three problems worth fixing once rather than three times:
 *
 *  - A failing endpoint was polled at full rate forever. When the database is
 *    down, every open tab kept issuing a request every 20s that could only
 *    fail, which is precisely when the server can least afford it.
 *  - Failures were invisible. The UI kept a hardcoded green "Live" pulse
 *    while nothing had actually succeeded in minutes.
 *  - A hidden tab polled as eagerly as a visible one.
 *
 * The loop is self-scheduling (setTimeout, not setInterval) so a slow response
 * can't overlap with the next tick, backs off exponentially on failure, and
 * resets the moment a request succeeds.
 */

export type PollStatus = "live" | "reconnecting" | "offline";

interface UseLivePollOptions<T> {
  /** Runs one poll. Reject or throw to signal failure. */
  fetcher: (signal: AbortSignal) => Promise<T>;
  /** Applied on every successful poll. */
  onData: (data: T) => void;
  intervalMs?: number;
  /** Consecutive failures before the UI stops claiming to be live. */
  failuresBeforeDegraded?: number;
  enabled?: boolean;
}

const MAX_BACKOFF_MS = 5 * 60_000;

export function useLivePoll<T>({
  fetcher,
  onData,
  intervalMs = 20_000,
  failuresBeforeDegraded = 2,
  enabled = true,
}: UseLivePollOptions<T>): { status: PollStatus; lastSuccessAt: Date | null } {
  const [status, setStatus] = React.useState<PollStatus>("live");
  const [lastSuccessAt, setLastSuccessAt] = React.useState<Date | null>(null);

  // Held in refs so changing an inline callback identity doesn't restart the
  // loop — callers pass arrow functions and shouldn't have to memoize them.
  // Updated in an effect rather than during render: a ref write during render
  // is not safe under concurrent rendering, which can render without
  // committing.
  const fetcherRef = React.useRef(fetcher);
  const onDataRef = React.useRef(onData);

  React.useEffect(() => {
    fetcherRef.current = fetcher;
    onDataRef.current = onData;
  });

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const controller = new AbortController();

    function schedule(delay: number) {
      if (cancelled) return;
      timer = setTimeout(run, delay);
    }

    async function run() {
      if (cancelled) return;

      // Nothing on screen is being read while the tab is hidden; check back
      // at the normal cadence rather than issuing a request nobody sees.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(intervalMs);
        return;
      }

      try {
        const data = await fetcherRef.current(controller.signal);
        if (cancelled) return;

        failures = 0;
        onDataRef.current(data);
        setLastSuccessAt(new Date());
        setStatus("live");
        schedule(intervalMs);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;

        failures += 1;
        if (failures >= failuresBeforeDegraded) {
          setStatus(failures >= failuresBeforeDegraded + 2 ? "offline" : "reconnecting");
        }

        // Exponential backoff, capped. Keeps a dead endpoint from being
        // hammered while still recovering promptly once it returns.
        schedule(Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS));
      }
    }

    // Coming back to a tab should feel current, so poll immediately rather
    // than waiting out whatever backoff accumulated while it was hidden.
    function onVisible() {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) clearTimeout(timer);
      schedule(0);
    }

    document.addEventListener("visibilitychange", onVisible);
    schedule(intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, failuresBeforeDegraded]);

  return { status, lastSuccessAt };
}

/**
 * `fetch` + status check + JSON parse, as one throwing call.
 *
 * The pollers used to do `await res.json()` with no `res.ok` check, so a 503
 * or an HTML error page was either silently ignored or threw a parse error
 * that read as a network fault. Both now fail loudly enough for the backoff
 * above to see them.
 */
export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${url} returned ${contentType || "an unknown content type"} instead of JSON`);
  }

  return (await res.json()) as T;
}
