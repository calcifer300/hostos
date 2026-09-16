"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The HostOS mark: a rounded square with an "orbit" — two arcs around a core
 * — reading as a control system rather than a car or a plate. Drawn with
 * strokes so it can animate in (path length) and glow.
 *
 * `animate` plays the draw-in once; the shell uses the static version.
 */
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
      transition: { pathLength: { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const, delay }, opacity: { duration: 0.2, delay } },
    }),
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", glow && "drop-shadow-[0_0_18px_rgba(10,132,255,0.55)]", className)}
      initial={animate ? "hidden" : "show"}
      animate="show"
      aria-hidden
    >
      <defs>
        <linearGradient id="hostos-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      {/* Rounded square frame */}
      <motion.rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="16"
        stroke="url(#hostos-grad)"
        strokeWidth="3.5"
        variants={draw}
        custom={0}
      />
      {/* Outer orbit arc */}
      <motion.path
        d="M18 38c2.5 7.5 9 11.5 16 10.5 8-1 12.5-7.5 12-14"
        stroke="url(#hostos-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        variants={draw}
        custom={0.35}
      />
      {/* Inner orbit arc */}
      <motion.path
        d="M46 26c-2.5-7.5-9-11.5-16-10.5-8 1-12.5 7.5-12 14"
        stroke="url(#hostos-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        variants={draw}
        custom={0.55}
      />
      {/* Core */}
      <motion.circle
        cx="32"
        cy="32"
        r="4.5"
        fill="url(#hostos-grad)"
        initial={animate ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: animate ? 1.1 : 0, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: "32px 32px" }}
      />
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
