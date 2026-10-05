"use client";

import * as React from "react";
import Image from "next/image";
import { Space_Grotesk } from "next/font/google";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { BlueprintPanel, HeroPanel, ReadoutPanel, StackPanel } from "@/components/marketing/intro/intro-panels";
import { useClientValue } from "@/lib/hooks/use-client-value";
import { isIntroImageSrc, type IntroPanel, type LandingIntro } from "@/lib/site/intro";
import { cn } from "@/lib/utils";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-grotesk", display: "swap" });

/** Where the crosshair goes for each open line of the blueprint, in percent of the photograph. */
const MARKER_SPOTS = [
  { x: 40, y: 38 },
  { x: 63, y: 54 },
  { x: 33, y: 68 },
  { x: 70, y: 30 },
];

const readWide = () => window.matchMedia("(min-width: 1024px)").matches;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

/**
 * The intro: four systems, one per line of business, ahead of the classic
 * landing page. On a wide screen the page scrolls the height of four
 * screens while the frame stays put: the text track slides up, the
 * photograph track slides down, so text and picture meet in the middle for
 * each system — twin tracks, opposite directions, sprung so the wheel
 * feels weighted. A HUD reads the position: system number, percent, a
 * progress line, arrows, a hint until the first scroll. On a phone the
 * same four systems stack: photograph, then text, full width, each one
 * arriving as it is reached. Reduced motion takes the spring out.
 */
export function MachinaIntro({ intro }: { intro: LandingIntro }) {
  const wide = useClientValue(readWide, false);
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const n = intro.panels.length;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const eased = useSpring(scrollYProgress, reduced ? { stiffness: 1000, damping: 100 } : { stiffness: 80, damping: 26, mass: 0.7 });
  // the tracks' travel, in screens; below lg the CSS pins them (max-lg:transform-none!)
  const leftY = useTransform(eased, (v) => `${-v * (n - 1) * 100}vh`);
  const rightY = useTransform(eased, (v) => `${v * (n - 1) * 100}vh`);
  const barX = useTransform(eased, [0, 1], [0, 1]);
  const [pct, setPct] = React.useState(0);
  const [active, setActive] = React.useState(0);
  const [moved, setMoved] = React.useState(false);
  const [openLine, setOpenLine] = React.useState<Record<string, number>>({});

  useMotionValueEvent(eased, "change", (v) => {
    const p = Math.round(Math.min(1, Math.max(0, v)) * 100);
    setPct((prev) => (prev === p ? prev : p));
    const a = Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))));
    setActive((prev) => (prev === a ? prev : a));
    if (v > 0.01 && !moved) setMoved(true);
  });

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + Math.min(n - 1, Math.max(0, i)) * window.innerHeight, behavior: reduced ? "auto" : "smooth" });
  };

  const cta = { href: intro.ctaHref, label: intro.ctaLabel };
  const openFor = (p: IntroPanel) => openLine[p.id] ?? 0;

  return (
    <section ref={ref} aria-label="What HostOS Collective runs" className={cn(grotesk.variable, "intro-root relative bg-[var(--intro-void)] text-[var(--intro-ink)]")} style={{ ["--n" as string]: n }}>
      <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        {/* a faint grid and a line of light that crawls down the frame */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--intro-line)_1px,transparent_1px),linear-gradient(90deg,var(--intro-line)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />
        <div aria-hidden className="intro-scan pointer-events-none absolute inset-x-0 h-px bg-[linear-gradient(90deg,transparent,var(--intro-accent),transparent)] opacity-40" />

        <div className="lg:grid lg:h-full lg:grid-cols-2">
          {/* text track: down the page, up the screen */}
          <motion.div style={{ y: leftY }} className="relative max-lg:transform-none! lg:absolute lg:inset-y-0 lg:left-0 lg:w-1/2 lg:will-change-transform">
            {intro.panels.map((p, i) => (
              <TextSystem key={p.id} panel={p} index={i} n={n} wide={wide} activeIndex={active} cta={cta} open={openFor(p)} onOpen={(k) => setOpenLine((o) => ({ ...o, [p.id]: k }))} />
            ))}
          </motion.div>

          {/* photograph track: down the page, down the screen (reversed order, so the pair meets) */}
          <motion.div style={{ y: rightY }} className="hidden max-lg:transform-none! lg:absolute lg:inset-y-0 lg:right-0 lg:block lg:w-1/2 lg:will-change-transform">
            {intro.panels.map((p, i) => (
              <div key={p.id} className="absolute inset-x-0 h-screen" style={{ top: `${-i * 100}%` }}>
                <Photo panel={p} index={i} n={n} openLine={openFor(p)} active={active === i} />
              </div>
            ))}
          </motion.div>
        </div>

        {/* HUD — wide screens only; the phone gets each photograph's own caption */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <div className="absolute right-7 top-[104px] flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--intro-dim)]">
            <LogoMark size={16} /> {intro.brand} SYS <span className="text-[var(--intro-accent)]">{pad(active + 1, 2)}</span> / {pad(n, 2)}
          </div>
          <div className="absolute left-0 top-0 h-screen w-[3px] bg-[var(--intro-line)]">
            <motion.div className="w-full origin-top bg-[var(--intro-accent)]" style={{ scaleY: barX, height: "100%" }} />
          </div>
          <div className={cn("absolute bottom-7 left-7 flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--intro-dim)] transition-opacity duration-700", moved && "opacity-0")}>
            {intro.hint} <span className="intro-blink inline-block h-3 w-[7px] bg-[var(--intro-accent)]" />
          </div>
          <div className="absolute bottom-7 right-7 flex items-center gap-4">
            <div className="h-px w-16 bg-[var(--intro-line)]"><motion.div className="h-full origin-left bg-[var(--intro-accent)]" style={{ scaleX: barX }} /></div>
            <span className="font-mono text-[13px] font-bold tabular-nums tracking-[0.2em] text-[var(--intro-accent)]">{pad(pct, 3)}%</span>
          </div>
        </div>
        <div className="pointer-events-auto absolute bottom-6 left-1/2 hidden -translate-x-1/2 border border-[var(--intro-line)] bg-[var(--intro-void)]/70 backdrop-blur-md lg:flex">
          <button type="button" onClick={() => jump(active - 1)} disabled={active === 0} aria-label="Previous system" className="flex h-10 w-10 items-center justify-center text-[var(--intro-accent)] transition-colors hover:bg-[var(--intro-accent)]/10 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
          <span className="w-px bg-[var(--intro-line)]" />
          <button type="button" onClick={() => jump(active + 1)} disabled={active === n - 1} aria-label="Next system" className="flex h-10 w-10 items-center justify-center text-[var(--intro-accent)] transition-colors hover:bg-[var(--intro-accent)]/10 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
      {/* the scroll room the frame needs */}
      <div aria-hidden className="hidden lg:block" style={{ height: `${(n - 1) * 100}vh` }} />
    </section>
  );
}

/** One system's text side, placed on the track; on a phone its photograph sits above it and it wakes as it scrolls into view. */
function TextSystem({ panel, index, n, wide, activeIndex, cta, open, onOpen }: { panel: IntroPanel; index: number; n: number; wide: boolean; activeIndex: number; cta: { href: string; label: string }; open: number; onOpen: (i: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const active = wide ? activeIndex === index : inView;
  return (
    <div ref={ref} className="relative lg:absolute lg:inset-x-0 lg:top-[calc(var(--i)*100%)] lg:h-screen" style={{ ["--i" as string]: index }}>
      <div className="lg:hidden"><Photo panel={panel} index={index} n={n} openLine={open} active={inView} /></div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:h-full lg:overflow-hidden lg:px-[5vw] lg:pb-20 lg:pt-28">
        <Panel panel={panel} active={active} cta={cta} open={open} onOpen={onOpen} />
      </div>
    </div>
  );
}

function Panel({ panel, active, cta, open, onOpen }: { panel: IntroPanel; active: boolean; cta: { href: string; label: string }; open: number; onOpen: (i: number) => void }) {
  switch (panel.layout) {
    case "hero": return <HeroPanel panel={panel} active={active} cta={cta} />;
    case "blueprint": return <BlueprintPanel panel={panel} active={active} open={open} onOpen={onOpen} />;
    case "stack": return <StackPanel panel={panel} active={active} />;
    case "readout": return <ReadoutPanel panel={panel} active={active} cta={cta} />;
  }
}

/** The photograph with its telemetry: corner brackets, a crosshair with a readout, the caption, a slow drift so it never sits dead still. */
function Photo({ panel, index, n, openLine, active }: { panel: IntroPanel; index: number; n: number; openLine: number; active: boolean }) {
  const item = panel.layout === "blueprint" ? panel.items[openLine] : null;
  const spot = item ? MARKER_SPOTS[openLine % MARKER_SPOTS.length] : { x: panel.markerX, y: panel.markerY };
  const label = item ? `${item.code} // ${item.figure} ${item.unit}` : panel.marker;
  const flip = spot.x > 55;
  const ok = isIntroImageSrc(panel.image);
  return (
    <figure className="relative aspect-[4/3] w-full overflow-hidden bg-[#0a0f18] sm:aspect-[16/10] lg:aspect-auto lg:h-full">
      <motion.div className="absolute inset-0" animate={active ? { scale: 1.06, x: "-1%" } : { scale: 1, x: "0%" }} transition={{ duration: 8, ease: "linear" }}>
        {ok ? (
          <Image src={panel.image} alt={panel.imageAlt} fill sizes="(min-width: 1024px) 50vw, 100vw" priority={index === 0} className="object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panel.image} alt={panel.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        )}
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,12,0.35),transparent_30%,transparent_70%,rgba(5,7,12,0.7))]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-color opacity-20" style={{ background: "var(--intro-accent)" }} />
      {/* corner brackets */}
      {["left-4 top-4 border-l border-t", "right-4 top-4 border-r border-t", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((c) => (
        <span key={c} aria-hidden className={cn("pointer-events-none absolute h-6 w-6 border-[var(--intro-accent)]/70", c)} />
      ))}
      {/* the crosshair and its readout */}
      <motion.div aria-hidden className="pointer-events-none absolute" animate={{ left: `${spot.x}%`, top: `${spot.y}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
        <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full border border-[var(--intro-accent)]" />
        <span className="intro-pulse absolute -left-4 -top-4 h-8 w-8 rounded-full border border-[var(--intro-accent)]" />
        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[var(--intro-accent)]" />
        <span className={cn("absolute top-0 hidden h-px w-10 bg-[var(--intro-accent)] sm:block", flip ? "right-4" : "left-4")} />
        <span className={cn("absolute top-0 hidden -translate-y-1/2 whitespace-nowrap sm:block border border-[var(--intro-accent)]/60 bg-[var(--intro-void)]/80 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--intro-accent)] backdrop-blur-md", flip ? "right-14" : "left-14")}>{label}</span>
      </motion.div>
      <figcaption className="absolute bottom-5 left-5 flex items-center gap-3 border border-[var(--intro-line)] bg-[var(--intro-void)]/75 px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--intro-ink)] backdrop-blur-md">
        <span className="text-[var(--intro-accent)]">{pad(index + 1, 2)}/{pad(n, 2)}</span> {panel.caption}
      </figcaption>
    </figure>
  );
}
