"use client";

import * as React from "react";

function subscribeToWindowFocus(onChange: () => void): () => void {
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}

/** True while this browser window has focus. */
function useWindowFocused(): boolean {
  return React.useSyncExternalStore(subscribeToWindowFocus, () => document.hasFocus(), () => true);
}

/**
 * The three window controls, in the macOS look. Rendered in every look and
 * hidden by CSS outside it (`.mac-only`), so the look can be switched without a
 * remount or a hydration mismatch.
 *
 * Only the green one does anything: it toggles the browser's full screen, which
 * is what that control does on a Mac. Red and yellow are drawn but inert, and
 * deliberately don't react to the pointer — a close button that does nothing is
 * worse than no close button. Like the real ones, all three go grey when the
 * window loses focus.
 */
export function TrafficLights() {
  const focused = useWindowFocused();

  function toggleFullscreen() {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    // Refused in some embedded contexts; there is nothing useful to tell anyone about it.
    Promise.resolve(request).catch(() => {});
  }

  return (
    <div className="mac-only mac-lights" role="group" aria-label="Window controls" data-inactive={focused ? undefined : "true"}>
      <span className="mac-light mac-light-close" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6L3.6 8.4" /></svg>
      </span>
      <span className="mac-light mac-light-min" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M3 6h6" /></svg>
      </span>
      <button type="button" className="mac-light mac-light-zoom" aria-label="Toggle full screen" onClick={toggleFullscreen}>
        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M4 8.2V4h4.2L4 8.2zM8 3.8V8H3.8L8 3.8z" /></svg>
      </button>
    </div>
  );
}
