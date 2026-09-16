"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The hostOS mark: a rounded square in the brand gradient carrying a
 * fingerprint — three ridges over a core line, open at the bottom. One
 * identity, many businesses: every host runs on their own print.
 *
 * Drawn with strokes so it can animate in (path length) and glow.
 * `animate` plays the draw-in once; the shell uses the static version.
 * Keep public/icon.svg and the OG mark in step with the geometry here.
 */
export const MARK = {
  frame: { x: 6, y: 6, size: 52, rx: 15 },
  ridges: ["M18 46V36a14 14 0 0 1 28 0v5", "M23 50V36a9 9 0 0 1 18 0v8", "M27.5 47.5V36.5a4.5 4.5 0 0 1 9 0v9"],
  core: "M32 40v13",
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
      className={cn("shrink-0", glow && "drop-shadow-[0_0_18px_rgba(88,120,255,0.55)]", className)}
      initial={animate ? "hidden" : "show"}
      animate="show"
      aria-hidden
    >
      <defs>
        <linearGradient id="hostos-frame" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
        <linearGradient id="hostos-print" x1="32" y1="20" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#B9C6FF" />
        </linearGradient>
      </defs>
      {/* the frame */}
      <motion.rect x={MARK.frame.x} y={MARK.frame.y} width={MARK.frame.size} height={MARK.frame.size} rx={MARK.frame.rx} stroke="url(#hostos-frame)" strokeWidth="3.25" variants={draw} custom={0} />
      {/* the print: three ridges, outside in, then the core */}
      {MARK.ridges.map((d, i) => (
        <motion.path key={d} d={d} stroke="url(#hostos-print)" strokeWidth="3" strokeLinecap="round" variants={draw} custom={0.25 + i * 0.18} />
      ))}
      <motion.path d={MARK.core} stroke="url(#hostos-print)" strokeWidth="3" strokeLinecap="round" variants={draw} custom={0.85} />
    </motion.svg>
  );
}

/** Wordmark: "host" + accent "OS". */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-[17px]", md: "text-[20px]", lg: "text-[32px]", xl: "text-[44px]" };
  return (
    <span className={cn("font-semibold tracking-tight text-foreground", sizes[size], className)}>
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {withMark && <LogoMark size={markSize} />}
      <Wordmark size={size} />
    </span>
  );
}
