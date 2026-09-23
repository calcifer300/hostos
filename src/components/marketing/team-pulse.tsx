"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion/reveal";
import { DEPARTMENT_ICONS, EASE } from "@/components/marketing/team-portrait";
import { DEPARTMENTS, type Department, type TeamProfile } from "@/lib/team/profiles";

/** A number that counts up the first time it scrolls into view. */
function Count({ to, label }: { to: number; label: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [n, setN] = React.useState(reduced ? to : 0);
  React.useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, to, { duration: 1.4, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, reduced]);
  return (
    <span ref={ref} className="flex items-baseline gap-2">
      <span className="text-gradient text-[36px] font-semibold tabular-nums tracking-[-0.03em] sm:text-[42px]">{n}</span>
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    </span>
  );
}

/**
 * The pulse of the collective above the roster: how many people, how many
 * crafts, one workspace — counting up as they arrive — and the crafts
 * themselves drifting past in their colours.
 */
export function TeamPulse({ members }: { members: TeamProfile[] }) {
  const crafts = React.useMemo(() => {
    const seen = new Map<Department, number>();
    for (const m of members) seen.set(m.department, (seen.get(m.department) ?? 0) + 1);
    return [...seen.entries()].map(([id, count]) => ({ id, count, ...DEPARTMENTS[id], Icon: DEPARTMENT_ICONS[DEPARTMENTS[id].icon] }));
  }, [members]);

  return (
    <Reveal className="mb-12">
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        <Count to={members.length} label="people" />
        <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
        <Count to={crafts.length} label="crafts" />
        <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
        <Count to={1} label="workspace" />
      </div>
      <div className="relative mt-8" aria-label="Crafts in the collective">
        <div className="flex flex-wrap justify-center gap-3">
          {crafts.map((c, i) => (
            <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[12.5px] font-medium shadow-[var(--shadow-card)]" style={{ color: c.hue, borderColor: `color-mix(in oklab, ${c.hue} 30%, var(--border))` }}>
              <c.Icon className="h-3.5 w-3.5" strokeWidth={2} /> {c.label}
              <span className="rounded-full px-1.5 text-[10.5px] font-semibold" style={{ background: `color-mix(in oklab, ${c.hue} 16%, transparent)` }}>{c.count}</span>
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
