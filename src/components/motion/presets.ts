import type { Transition, Variants } from "framer-motion";

/**
 * The one easing curve the app uses. Matches --ease-out-expo in globals.css
 * so CSS transitions and Framer Motion animations feel like the same hand.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const spring: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.45, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE } },
};

export const stagger = (staggerChildren = 0.07, delayChildren = 0.05): Variants => ({
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren, delayChildren } },
});

/** Page-level enter/exit used by the app's template.tsx. */
export const pageTransition = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, filter: "blur(4px)" },
  transition: { duration: 0.32, ease: EASE },
} as const;
