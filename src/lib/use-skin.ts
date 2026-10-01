"use client";

import * as React from "react";
import { readSkin, SKIN_EVENT, type Skin } from "@/lib/skin";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SKIN_EVENT, onChange);
  // The same browser, another tab.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SKIN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current look. Renders "default" on the server and corrects itself on hydration. */
export function useSkin(): Skin {
  return React.useSyncExternalStore(subscribe, readSkin, () => "default");
}
