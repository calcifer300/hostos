"use client";

import * as React from "react";
import { applySkin, readSkin } from "@/lib/skin";

/**
 * Keeps <html data-skin> in step with the stored look while the product shell
 * is on screen, and takes it off again when it isn't.
 *
 * The inline boot script in the root layout already set it before first paint
 * on a direct load of /app. This covers the other ways in: arriving from the
 * sign-in screen by client navigation (no page load, so no boot script), and
 * the look being changed in another tab.
 *
 * The cleanup is the half that matters for the rest of the site. The sign-in
 * and marketing pages share this <html> element, and an attribute left behind
 * would restyle them.
 */
export function SkinSync() {
  React.useEffect(() => {
    const sync = () => applySkin(readSkin());
    sync();
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      applySkin("default");
    };
  }, []);

  return null;
}
