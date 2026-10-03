"use client";

import * as React from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { EASE, fadeUp, stagger } from "@/components/motion/presets";
import { cn } from "@/lib/utils";

/**
 * Animates in when it scrolls into view. Once — a section that re-animates
 * every time it re-enters the viewport is a section that never settles.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  once = true,
  as = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "article" | "span";
} & Omit<HTMLMotionProps<"div">, "children">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-12% 0px -8% 0px" });
  const Comp = (motion as unknown as Record<string, typeof motion.div>)[as] ?? motion.div;

  return (
    <Comp
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.65, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** A container whose children fade up one after another. */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0.05,
  inView = true,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  /** Animate on scroll (default) or immediately on mount. */
  inView?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-10% 0px" });
  const show = inView ? seen : true;

  return (
    <motion.div
      ref={ref}
      variants={stagger(gap, delay)}
      initial="hidden"
      animate={show ? "show" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div variants={fadeUp} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Counts from 0 to `value` when it comes into view. Numbers that simply
 * appear read as static labels; numbers that arrive read as measurements.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 1.4,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(springValue, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  const [text, setText] = React.useState(format ? format(0) : "0");

  React.useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  React.useEffect(() => display.on("change", (v) => setText(v)), [display]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

/** A subtle tilt-on-hover wrapper for hero cards and feature tiles. */
export function Tilt({ children, className, max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 20 });

  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
