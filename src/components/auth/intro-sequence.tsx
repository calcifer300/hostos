"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "@/components/brand/logo-mark";
import { SITE } from "@/lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The opening sequence a visitor sees on the way into HostOS:
 *
 *   animated mark  →  "Built by HostOS Collective"  →  loading bar  →  done
 *
 * Runs once per browser session (sessionStorage) so a returning user is not
 * made to sit through it on every sign-out, and it can be skipped with a
 * click or a key at any point. Total length is under three seconds; the
 * point is a first impression, not a wait.
 */

const STORAGE_KEY = "hostos:intro-seen";

type Step = "mark" | "byline" | "loading";

const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Whether this session has already watched the intro. Server-rendered as
 * "seen" so SSR and the first client paint agree; the real answer replaces
 * it after hydration through useSyncExternalStore, which is the correct tool
 * for reading browser storage without a setState-in-effect.
 */
export function useIntroSeen(): [boolean, () => void] {
  const seen = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readSeen,
    () => true
  );

  const markSeen = React.useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage blocked (private mode) — the intro simply plays again next time.
    }
    listeners.forEach((cb) => cb());
  }, []);

  return [seen, markSeen];
}

export function IntroSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState<Step>("mark");
  const doneRef = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setStep("byline"), 1500),
      setTimeout(() => setStep("loading"), 2600),
      setTimeout(finish, 3900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [finish]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  return (
    <motion.div
      role="presentation"
      onClick={finish}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: EASE } }}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] blur-3xl"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative"
      >
        <LogoMark size={96} animate glow />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.6, ease: EASE }}
        className="mt-6 text-[28px] font-semibold tracking-tight"
      >
        host<span className="text-gradient">OS</span>
      </motion.p>

      <div className="mt-3 h-6">
        <AnimatePresence mode="wait">
          {step !== "mark" && (
            <motion.p
              key="byline"
              initial={{ opacity: 0, y: 6, letterSpacing: "0.3em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-[11.5px] font-medium uppercase text-muted-foreground"
            >
              Built by {SITE.company}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-10 h-[3px] w-40 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ x: "-100%" }}
          animate={step === "loading" ? { x: "0%" } : { x: "-100%" }}
          transition={{ duration: 1.1, ease: EASE }}
          className="h-full w-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]"
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.6 }}
        className="absolute bottom-8 text-[11px] text-muted-foreground/80"
      >
        Click anywhere to skip
      </motion.p>
    </motion.div>
  );
}
