"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Re-fetches the current route's server-rendered data on an interval —
 * router.refresh() re-runs the page's server components in place, it
 * doesn't remount the tree, so client-side state (open menus, scroll
 * position, in-flight animations) survives. This is what keeps Overview
 * and Operations in sync with a Companion sync that just landed, without
 * a manual reload — see PROJECT_STATE.md's note on this being missing.
 * Paused while the tab isn't visible so it doesn't burn cycles in a
 * background tab.
 */
export function AutoRefresh() {
  const router = useRouter();

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
