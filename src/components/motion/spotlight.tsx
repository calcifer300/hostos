"use client";

import * as React from "react";

/**
 * Feeds the pointer's position to whichever `.spot` card it is over, as the
 * CSS variables --mx/--my the card's glow is drawn at (see globals.css). One
 * passive document listener, one rAF per frame at most, no React state — the
 * same shape as TapFeedback. Does nothing on touch devices, where there is
 * no hover to follow.
 *
 * Mounted once in the root layout.
 */
export function SpotlightEffect() {
  React.useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const el = event.target instanceof Element ? event.target.closest<HTMLElement>(".spot") : null;
      if (!el) return;
      pending = { el, x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        const rect = pending.el.getBoundingClientRect();
        pending.el.style.setProperty("--mx", `${pending.x - rect.left}px`);
        pending.el.style.setProperty("--my", `${pending.y - rect.top}px`);
      });
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
