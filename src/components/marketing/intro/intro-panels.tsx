"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Minus, Pause, Play, Plus } from "lucide-react";
import { useMounted } from "@/lib/hooks/use-client-value";
import type { IntroPanel } from "@/lib/site/intro";
import { cn } from "@/lib/utils";

/**
 * The text side of each system. Four layouts, one per panel: the opener
 * with the clock and the stats; the blueprint, an accordion whose open
 * line moves the marker on the photograph; the stack, a ring of cards you
 * turn; the readout, channel tabs under a figure drawn in outline. Every
 * layout is keyboard-usable and works stacked on a phone.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;
const MONO = "font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em]";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn(MONO, "flex items-center gap-3 text-[var(--intro-accent)]")}>
      <span aria-hidden className="h-px w-8 bg-[var(--intro-accent)]" />
      {children}
    </p>
  );
}

export function Headline({ panel, size = "lg" }: { panel: IntroPanel; size?: "lg" | "md" }) {
  return (
    <h2 className={cn("intro-display font-bold uppercase leading-[0.92] tracking-[-0.02em] text-[var(--intro-ink)]", size === "lg" ? "text-[clamp(40px,min(7vw,10.5vh),104px)]" : "text-[clamp(32px,min(4.4vw,7vh),60px)]")}>
      {panel.title} <span className="text-[var(--intro-accent)]">{panel.accent}</span>
    </h2>
  );
}

/** Lines that arrive one after another when a system comes into view. */
const lines = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
export const line = { hidden: { opacity: 0, y: 18, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } } };

export function Cta({ href, label, className }: { href: string; label: string; className?: string }) {
  const external = /^https?:\/\//.test(href);
  const cls = cn("btn-shine group inline-flex items-center gap-2.5 rounded-full border border-[var(--intro-accent)]/60 bg-[var(--intro-accent)]/10 px-5 py-2.5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[var(--intro-ink)] transition-colors hover:bg-[var(--intro-accent)]/20", className);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>{label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></a>
  ) : (
    <Link href={href} className={cls}>{label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
  );
}

/** The clock in the opener: the visitor's own time, to the millisecond, the way a console would show it. */
function Clock() {
  const mounted = useMounted();
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const tick = () => { setNow(new Date()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted]);
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="inline-flex items-center gap-4 border border-[var(--intro-line)] bg-[var(--intro-accent)]/[0.04] px-4 py-2.5">
      <span className={cn(MONO, "text-[var(--intro-dim)]")}>Local time</span>
      <span className="intro-display text-[22px] font-bold tabular-nums tracking-wide text-[var(--intro-accent)]" aria-live="off">
        {now ? `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}` : "--:--:--"}
        <span className="text-[var(--intro-hot)]">.{now ? String(now.getMilliseconds()).padStart(3, "0") : "---"}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

export function HeroPanel({ panel, active, cta }: { panel: IntroPanel; active: boolean; cta: { href: string; label: string } }) {
  return (
    <motion.div variants={lines} initial="hidden" animate={active ? "show" : "hidden"} className="max-w-[560px]">
      <motion.div variants={line}><Eyebrow>{panel.eyebrow}</Eyebrow></motion.div>
      <motion.div variants={line} className="mt-4"><Headline panel={panel} /></motion.div>
      <motion.p variants={line} className="mt-5 max-w-[440px] text-[14.5px] leading-relaxed text-[var(--intro-dim)]">{panel.body}</motion.p>
      <motion.div variants={line} className="mt-6 flex flex-wrap items-center gap-4"><Clock /><Cta href={cta.href} label={cta.label} /></motion.div>
      {panel.stats.length > 0 && (
        <motion.dl variants={line} className="mt-6 grid grid-cols-3 divide-x divide-[var(--intro-line)] border-t border-[var(--intro-line)] pt-4">
          {panel.stats.map((s) => (
            <div key={s.label} className="px-4 first:pl-0">
              <dt className={cn(MONO, "text-[var(--intro-dim)]")}>{s.label}</dt>
              <dd className="intro-display mt-1.5 text-[22px] font-bold tabular-nums text-[var(--intro-ink)]">
                {s.value} {s.unit && <span className="text-[12px] text-[var(--intro-accent)]">{s.unit}</span>}
              </dd>
            </div>
          ))}
        </motion.dl>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------- blueprint */

export function BlueprintPanel({ panel, active, open, onOpen }: { panel: IntroPanel; active: boolean; open: number; onOpen: (i: number) => void }) {
  return (
    <motion.div variants={lines} initial="hidden" animate={active ? "show" : "hidden"} className="max-w-[640px]">
      <motion.div variants={line}><Eyebrow>{panel.eyebrow}</Eyebrow></motion.div>
      <motion.div variants={line} className="mt-5"><Headline panel={panel} size="md" /></motion.div>
      <motion.p variants={line} className="mt-4 max-w-[460px] text-[14.5px] leading-relaxed text-[var(--intro-dim)]">{panel.body}</motion.p>
      <motion.div variants={line} className="mt-8 border-t border-[var(--intro-line)]">
        {panel.items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={it.code + i} className={cn("border-b border-[var(--intro-line)] transition-colors", isOpen && "border-[var(--intro-accent)]/60 bg-[var(--intro-accent)]/[0.05]")}>
              <button type="button" onClick={() => onOpen(i)} aria-expanded={isOpen} className="flex w-full items-center gap-5 px-4 py-4 text-left">
                <span className={cn(MONO, isOpen ? "text-[var(--intro-hot)]" : "text-[var(--intro-faint)]")}>{it.code}</span>
                <span className="intro-display flex-1 text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--intro-ink)]">{it.title}</span>
                {isOpen ? <Minus className="h-4 w-4 text-[var(--intro-hot)]" /> : <Plus className="h-4 w-4 text-[var(--intro-accent)]" />}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
                    <div className="px-4 pb-5 pl-[calc(1rem+3.2rem)]">
                      <p className="text-[13.5px] leading-relaxed text-[var(--intro-dim)]">{it.body}</p>
                      <div className={cn(MONO, "mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[var(--intro-accent)]")}>
                        <span>{it.figure} {it.unit}</span>
                        {it.tags.map((t) => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- stack */

/** A ring of cards in 3D: turn it with the arrows, the numbers, a drag, or leave it and it turns itself. */
export function StackPanel({ panel, active }: { panel: IntroPanel; active: boolean }) {
  const n = Math.max(1, panel.items.length);
  const step = 360 / n;
  const reduced = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  const angle = useMotionValue(0);
  const turn = useSpring(angle, { stiffness: 70, damping: 18, mass: 0.8 });
  const dragFrom = React.useRef(0);

  const go = React.useCallback((i: number) => {
    setIndex(((i % n) + n) % n);
    angle.set(-i * step);
  }, [n, step, angle]);

  React.useEffect(() => {
    if (!active || !auto || reduced) return;
    const t = window.setInterval(() => go(Math.round(-angle.get() / step) + 1), 3200);
    return () => window.clearInterval(t);
  }, [active, auto, reduced, go, angle, step]);

  const radius = 210;
  const current = panel.items[index];

  return (
    <motion.div variants={lines} initial="hidden" animate={active ? "show" : "hidden"} className="w-full max-w-[560px]">
      <motion.div variants={line}><Eyebrow>{panel.eyebrow}</Eyebrow></motion.div>
      <motion.div variants={line} className="mt-5"><Headline panel={panel} size="md" /></motion.div>
      <motion.p variants={line} className="mt-4 max-w-[460px] text-[14.5px] leading-relaxed text-[var(--intro-dim)]">{panel.body}</motion.p>
      <motion.div variants={line} className="mt-5 [perspective:1200px]">
        <motion.div
          className="relative mx-auto h-[250px] w-[220px] cursor-grab [transform-style:preserve-3d] active:cursor-grabbing"
          style={{ rotateY: turn }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0}
          onDragStart={() => { setAuto(false); dragFrom.current = angle.get(); }}
          onDrag={(_, info) => angle.set(dragFrom.current + info.offset.x * 0.45)}
          onDragEnd={() => go(Math.round(-angle.get() / step))}
        >
          {panel.items.map((it, i) => {
            const isFront = i === index;
            return (
              <div key={it.code + i} className={cn("absolute inset-0 border bg-[#06090f]/85 p-5 backdrop-blur-sm transition-[opacity,border-color] duration-500", isFront ? "border-[var(--intro-accent)] opacity-100" : "border-[var(--intro-line)] opacity-45")} style={{ transform: `rotateY(${i * step}deg) translateZ(${radius}px)`, backfaceVisibility: "hidden" }} aria-hidden={!isFront}>
                <p className={cn(MONO, "text-[var(--intro-hot)]")}>{it.code}</p>
                <p className="intro-display mt-2.5 text-[20px] font-bold uppercase leading-none tracking-[0.02em] text-[var(--intro-ink)]">{it.title}</p>
                <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--intro-dim)]">{it.body}</p>
                <p className="intro-display absolute bottom-4 left-5 text-[30px] font-bold leading-none text-[var(--intro-accent)]">
                  {it.figure} <span className="text-[12px] text-[var(--intro-dim)]">{it.unit}</span>
                </p>
              </div>
            );
          })}
        </motion.div>
        <p className={cn(MONO, "mt-4 text-center text-[var(--intro-dim)]")}>{current?.code}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <button type="button" onClick={() => { setAuto(false); go(index - 1); }} aria-label="Previous card" className="flex h-9 w-9 items-center justify-center border border-[var(--intro-line)] text-[var(--intro-dim)] transition-colors hover:border-[var(--intro-accent)] hover:text-[var(--intro-ink)]"><ChevronLeft className="h-4 w-4" /></button>
          {panel.items.map((it, i) => (
            <button key={it.code + i} type="button" onClick={() => { setAuto(false); go(i); }} aria-label={`Card ${i + 1}: ${it.title}`} aria-current={i === index} className={cn(MONO, "flex h-9 w-9 items-center justify-center border transition-colors", i === index ? "border-[var(--intro-hot)] text-[var(--intro-hot)]" : "border-[var(--intro-line)] text-[var(--intro-dim)] hover:border-[var(--intro-accent)]")}>{String(i + 1).padStart(2, "0")}</button>
          ))}
          <button type="button" onClick={() => { setAuto(false); go(index + 1); }} aria-label="Next card" className="flex h-9 w-9 items-center justify-center border border-[var(--intro-line)] text-[var(--intro-dim)] transition-colors hover:border-[var(--intro-accent)] hover:text-[var(--intro-ink)]"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setAuto((a) => !a)} aria-label={auto ? "Stop turning" : "Keep turning"} className="ml-1 flex h-9 w-9 items-center justify-center border border-[var(--intro-line)] text-[var(--intro-dim)] transition-colors hover:border-[var(--intro-accent)] hover:text-[var(--intro-ink)]">{auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
        </div>
        <p className={cn(MONO, "mt-3 text-center text-[var(--intro-faint)]")}>Drag to turn // click a card&rsquo;s number to focus</p>
      </motion.div>
    </motion.div>
  );
}

/* --------------------------------------------------------------- readout */

export function ReadoutPanel({ panel, active, cta }: { panel: IntroPanel; active: boolean; cta: { href: string; label: string } }) {
  const [tab, setTab] = React.useState(0);
  const current = panel.items[tab] ?? panel.items[0];
  return (
    <motion.div variants={lines} initial="hidden" animate={active ? "show" : "hidden"} className="w-full max-w-[600px]">
      <motion.div variants={line}><Eyebrow>{panel.eyebrow}</Eyebrow></motion.div>
      <motion.div variants={line} className="mt-5"><Headline panel={panel} size="md" /></motion.div>
      <motion.p variants={line} className="mt-4 max-w-[460px] text-[14.5px] leading-relaxed text-[var(--intro-dim)]">{panel.body}</motion.p>
      <motion.div variants={line} role="tablist" className="mt-7 grid border border-[var(--intro-line)]" style={{ gridTemplateColumns: `repeat(${Math.max(1, panel.items.length)}, minmax(0, 1fr))` }}>
        {panel.items.map((it, i) => (
          <button key={it.code + i} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)} className={cn(MONO, "relative px-3 py-4 transition-colors", i === tab ? "text-[var(--intro-hot)]" : "text-[var(--intro-dim)] hover:text-[var(--intro-ink)]")}>
            {it.title}
            {i === tab && <motion.span layoutId={`readout-underline-${panel.id}`} className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--intro-hot)]" />}
          </button>
        ))}
      </motion.div>
      {current && (
        <motion.div variants={line} className="mt-5 min-h-[180px]">
          <AnimatePresence mode="wait">
            <motion.div key={current.code} initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: 0.2 } }} transition={{ duration: 0.5, ease: EASE }}>
              <p className={cn(MONO, "text-[var(--intro-hot)]")}>Channel // {current.title}</p>
              <p className="intro-display intro-outline mt-3 text-[clamp(48px,min(6.5vw,12vh),104px)] font-bold uppercase leading-[0.9] tracking-[-0.01em]">{current.figure}</p>
              <p className={cn(MONO, "mt-3 text-[var(--intro-ink)]")}>{current.unit}</p>
              <p className="mt-4 max-w-[440px] text-[13.5px] leading-relaxed text-[var(--intro-dim)]">{current.body}</p>
              {current.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {current.tags.map((t) => <span key={t} className={cn(MONO, "border border-[var(--intro-accent)]/50 px-3 py-1.5 text-[var(--intro-accent)]")}>{t}</span>)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
      <motion.div variants={line} className="mt-6"><Cta href={cta.href} label={cta.label} /></motion.div>
    </motion.div>
  );
}
