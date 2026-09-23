"use client";

import * as React from "react";

/** Registers the service worker once the page is interactive. No-op where unsupported. */
export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* An unregistered worker only means no install prompt; the app works regardless. */
    });
  }, []);
  return null;
}
