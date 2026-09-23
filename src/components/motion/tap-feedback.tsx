"use client";

import * as React from "react";

const PRESSABLE = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], summary, [data-pressable]';

/**
 * A soft pulse of accent colour under every press — links, buttons, tabs,
 * menu items — on mouse, pen and touch alike. It is pure DOM work on one
 * document listener: no React state, nothing re-renders, and the pulse
 * removes itself when its animation ends. Honours reduced-motion.
 *
 * Mounted once in the root layout so the landing page and the product share
 * the same touch.
 */
export function TapFeedback() {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const target = event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
      if (!target || (target as HTMLButtonElement).disabled || target.getAttribute("aria-disabled") === "true") return;

      const pulse = document.createElement("span");
      pulse.className = "tap-pulse";
      pulse.style.left = `${event.clientX}px`;
      pulse.style.top = `${event.clientY}px`;
      // A card with its own hue (the vertical chooser) pulses in that hue.
      const hue = getComputedStyle(target).getPropertyValue("--hue").trim();
      if (hue) pulse.style.setProperty("--pulse", hue);
      pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
      document.body.appendChild(pulse);
      // Belt and braces: never leave one behind if the animation is interrupted.
      window.setTimeout(() => pulse.remove(), 700);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  return null;
}
