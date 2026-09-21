"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Footage behind a section: dimmed, colourless, loaded only as the section
 * nears the screen, playing only while it is on screen — and never on a
 * phone or under reduced motion. The same rule the public site follows.
 */
export function Footage({ src, dim = 0.28, className }: { src: string; dim?: number; className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(min-width: 768px)").matches) return;
    let loaded = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (!loaded) { v.src = src; v.load(); loaded = true; } v.play().catch(() => {}); } else v.pause();
    }, { rootMargin: "200px 0px" });
    io.observe(v);
    const on = () => { v.style.opacity = String(dim); };
    v.addEventListener("playing", on);
    return () => { io.disconnect(); v.removeEventListener("playing", on); };
  }, [src, dim]);
  return <video ref={ref} muted loop playsInline preload="none" aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[1200ms] mix-blend-luminosity", className)} />;
}
