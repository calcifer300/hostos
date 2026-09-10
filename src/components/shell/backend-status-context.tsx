"use client";

import * as React from "react";
import type { BackendStatusView } from "@/components/shell/backend-status-banner";

/**
 * Makes the data layer's health readable from any client component under the
 * shell, without threading a prop through every page and card.
 *
 * The shell is a client component that renders `{children}` from the server
 * layout, so context provided here reaches client components nested inside
 * those server children — which is where the misleading "everything is fine"
 * indicators live.
 */
const BackendStatusContext = React.createContext<BackendStatusView>({ state: "unknown", kind: null });

export function BackendStatusProvider({
  status,
  children,
}: {
  status: BackendStatusView;
  children: React.ReactNode;
}) {
  // Destructured so the memo depends on the two values that matter rather
  // than on a prop object the server re-creates on every render.
  const { state, kind } = status;
  const value = React.useMemo<BackendStatusView>(() => ({ state, kind }), [state, kind]);
  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
}

export function useBackendStatus(): BackendStatusView {
  return React.useContext(BackendStatusContext);
}

/** True when the data on screen can be trusted to be current. */
export function useBackendHealthy(): boolean {
  const { state } = useBackendStatus();
  return state === "ok" || state === "unknown";
}
