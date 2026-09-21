"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The hostOS mark: a rounded square carrying a fingerprint — three ridges
 * that fill the frame over a core line, open at the bottom. One identity,
 * many businesses: every host runs on their own print.
 *
 * The same geometry and gradient as the landing page's
 * mark (site/src/lib/components/ui/Logo.svelte): the stroke in the brand
 * gradient, and a light that passes over the frame under the pointer. `animate` plays the draw-in once; the shell shows
 * it already drawn. Keep public/icon.svg and the OG mark in step.
 */
export const MARK = {
  frame: { x: 6, y: 6, size: 52, rx: 15 },
  ridges: ["M14 44V30a18 18 0 0 1 36 0v8", "M20.5 50V30a11.5 11.5 0 0 1 23 0v12", "M26.5 46V30.5a5.5 5.5 0 0 1 11 0v13"],
  core: "M32 36v17",
} as const;

export function LogoMark({
  size = 32,
  animate = false,
  glow = false,
  className,
}: {
  size?: number;
  animate?: boolean;
  glow?: boolean;
  className?: string;
}) {
  // several marks can share a page (sidebar, palette, login); each needs its own gradient ids
  const uid = useId().replace(/:/g, "");
  const grad = `url(#${uid}-g)`;
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    show: (delay: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: { pathLength: { duration: 1.0, ease: [0.16, 1, 0.3, 1] as const, delay }, opacity: { duration: 0.2, delay } },
    }),
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("logo-mark shrink-0 overflow-visible", glow && "drop-shadow-[0_0_18px_rgba(88,120,255,0.55)]", className)}
      initial={animate ? "hidden" : "show"}
      animate="show"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B9CFF" />
          <stop offset="1" stopColor="#9B6BFF" />
        </linearGradient>
        <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-c`}>
          <rect x={MARK.frame.x} y={MARK.frame.y} width={MARK.frame.size} height={MARK.frame.size} rx={MARK.frame.rx} />
        </clipPath>
      </defs>
      {/* the frame */}
      <motion.rect x={MARK.frame.x} y={MARK.frame.y} width={MARK.frame.size} height={MARK.frame.size} rx={MARK.frame.rx} stroke={grad} strokeWidth="3.25" variants={draw} custom={0} />
      {/* the print: three ridges, outside in, then the core */}
      {MARK.ridges.map((d, i) => (
        <motion.path key={d} d={d} stroke={grad} strokeWidth="3" strokeLinecap="round" variants={draw} custom={0.25 + i * 0.18} />
      ))}
      <motion.path d={MARK.core} stroke={grad} strokeWidth="3" strokeLinecap="round" variants={draw} custom={0.85} />
      {/* a light passes over the frame */}
      <g clipPath={`url(#${uid}-c)`}>
        <rect className="logo-sheen" x="-30" y="0" width="26" height="64" fill={`url(#${uid}-s)`} />
      </g>
    </motion.svg>
  );
}

/** Wordmark: "host" + accent "OS". */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-[17px]", md: "text-[20px]", lg: "text-[32px]", xl: "text-[44px]" };
  return (
    <span className={cn("font-bold tracking-tight text-foreground", sizes[size], className)}>
      host<span className="text-gradient">OS</span>
    </span>
  );
}

export function Logo({
  size = "md",
  className,
  withMark = true,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  withMark?: boolean;
}) {
  const markSize = { sm: 22, md: 26, lg: 40, xl: 56 }[size];
  return (
    <span className={cn("logo inline-flex items-center gap-2.5", className)}>
      {withMark && <LogoMark size={markSize} />}
      <Wordmark size={size} />
    </span>
  );
}
