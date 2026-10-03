"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/components/motion/presets";

/**
 * Wraps every route's content in a short enter animation. Used from
 * app/app/template.tsx, which re-mounts on navigation — a layout would not,
 * and the animation would only ever play once.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransition.transition}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
