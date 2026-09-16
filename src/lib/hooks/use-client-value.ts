"use client";

import * as React from "react";

const noop = () => () => {};

/**
 * Snapshot cache, keyed by the reader. Module-level on purpose: the value
 * is a property of the browser (platform, display mode), not of a component
 * instance, and useSyncExternalStore needs getSnapshot to return the same
 * reference every call.
 */
const snapshots = new WeakMap<() => unknown, { value: unknown }>();

/**
 * Reads a browser-only value without a hydration mismatch or a setState-in-
 * effect: the server snapshot renders first, the client snapshot replaces
 * it after hydration. For values that never change while mounted (platform,
 * a storage flag read once), which is the case everywhere it is used.
 *
 * Pass a module-level `read` function so the cache key is stable.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return React.useSyncExternalStore(
    noop,
    () => {
      let entry = snapshots.get(read);
      if (!entry) {
        entry = { value: read() };
        snapshots.set(read, entry);
      }
      return entry.value as T;
    },
    () => serverValue
  );
}

/**
 * False during server rendering and hydration, true after. For output that
 * depends on the browser's timezone or locale — a local time, a calendar
 * week — which the server (UTC) cannot render identically: render a
 * placeholder first, the real thing once mounted, and hydration matches.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}

/** A stable "now" for a render — taken once on mount, never during render. */
export function useNow(): number {
  const [now] = React.useState(() => Date.now());
  return now;
}
