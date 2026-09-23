"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { FounderSeal, RoleMotif } from "@/components/marketing/team-motifs";
import { DepartmentChip, EASE, MemberPhoto, Portrait } from "@/components/marketing/team-portrait";
import { useMounted } from "@/lib/hooks/use-client-value";
import { hueOf, isFounderProfile, shortName, type TeamProfile } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

/** How long each person holds the floor when the introductions run themselves. */
export const INTRO_SECONDS = 4.5;

/**
 * One person, full screen: the tile that was clicked flies out into a
 * large frame (shared layoutId — only for that one; walking to the next
 * person crossfades, so the portrait never flies in from off-screen), the
 * room takes on their colour, their craft's motif drifts behind the words,
 * and the name comes in line by line — the full name, then what everyone
 * calls them. ← → walk the collective, Esc closes, the strip at the bottom
 * jumps to anyone. Focus moves to the dialog and Tab stays inside it; on
 * close it returns to the tile.
 *
 * With `intro` on, the introductions run themselves: each person for
 * INTRO_SECONDS with a progress line under the portrait, pausing while the
 * pointer rests on the dialog, stopping on the last person or the first
 * manual step. The public view stops at the role; the full view (The
 * Collective) adds focus, promise and responsibilities.
 */
export function TeamSpotlight({ members, openId, entryId, intro, variant, onClose, onSelect, onIntroEnd }: { members: TeamProfile[]; openId: string | null; entryId: string | null; intro: boolean; variant: "public" | "full"; onClose: () => void; onSelect: (id: string) => void; onIntroEnd: () => void }) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const dialog = React.useRef<HTMLDivElement>(null);
  const [paused, setPaused] = React.useState(false);
  const [cycle, setCycle] = React.useState(0);

  const index = members.findIndex((m) => m.id === openId);
  const member = index >= 0 ? members[index] : null;
  const prev = members[(index - 1 + members.length) % members.length];
  const next = members[(index + 1) % members.length];
  const last = index === members.length - 1;
  const running = intro && !paused && !last && member !== null;

  // A manual step ends the run; the strip and arrows are manual.
  const step = React.useCallback((id: string) => { if (intro) onIntroEnd(); onSelect(id); }, [intro, onIntroEnd, onSelect]);
  // Pausing freezes the progress line; resuming restarts the person's turn, so line and timer agree.
  const pause = React.useCallback(() => { if (intro) setPaused(true); }, [intro]);
  const resume = React.useCallback(() => { if (intro) { setPaused(false); setCycle((c) => c + 1); } }, [intro]);
  const toggle = React.useCallback(() => (paused ? resume() : pause()), [paused, pause, resume]);

  React.useEffect(() => {
    if (!member) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(next.id);
      else if (e.key === "ArrowLeft") step(prev.id);
      else if (e.key === " " && intro && !(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); toggle(); }
      else if (e.key === "Tab" && dialog.current) {
        // keep Tab inside the dialog
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0], lastEl = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [member, next, prev, intro, onClose, step, toggle]);

  // The run itself: one timer per person (restarted by a pause/resume cycle, in step with the progress line).
  React.useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => onSelect(next.id), INTRO_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [running, member?.id, next.id, cycle, onSelect]);

  // Lock the page behind without the layout jump a vanishing scrollbar causes; focus the dialog while open.
  const open = member !== null;
  React.useEffect(() => {
    if (!open) return;
    const body = document.body;
    const before = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    const t = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>("[data-spotlight-close]")?.focus(), 50);
    return () => {
      window.clearTimeout(t);
      body.style.overflow = before.overflow;
      body.style.paddingRight = before.paddingRight;
    };
  }, [open]);

  if (!mounted) return null;
  const hue = member ? hueOf(member) : "#0a84ff";
  const founder = member ? isFounderProfile(member) : false;
  const nick = member ? shortName(member) : "";
  const line = { hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } } };
  const round = "flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:bg-white/15 hover:text-white";

  return createPortal(
    <AnimatePresence>
      {member && (
        <motion.div key="spotlight" ref={dialog} role="dialog" aria-modal="true" aria-label={`${member.name}, ${member.title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.28 } }} transition={{ duration: 0.4 }} className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-4 sm:p-8" onClick={onClose}>
          <div className="absolute inset-0 bg-[#05070c]/85 backdrop-blur-xl" />
          {/* the room in their colour: a soft radial wash, no filter, so it costs nothing to animate */}
          <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(closest-side, ${hue}, transparent 70%)` }} animate={{ opacity: 0.3, scale: reduced ? 1 : [1, 1.05, 1] }} initial={{ opacity: 0 }} transition={{ opacity: { duration: 0.6 }, scale: { duration: 9, repeat: Infinity, ease: "easeInOut" } }} />
          {/* their craft, drawn large behind the words */}
          <AnimatePresence mode="wait">
            <motion.div key={`motif-${member.id}`} aria-hidden initial={{ opacity: 0, scale: 0.9, rotate: -6 }} animate={{ opacity: 0.16, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.25 } }} transition={{ duration: 0.9, ease: EASE }} className="pointer-events-none absolute right-[4%] top-1/2 hidden h-[min(60vh,520px)] w-[min(60vh,520px)] -translate-y-1/2 md:block" style={{ color: hue }}>
              <RoleMotif department={member.department} className="h-full w-full" />
            </motion.div>
          </AnimatePresence>

          <button type="button" data-spotlight-close onClick={onClose} aria-label="Close" className={cn(round, "absolute right-4 top-4 z-10 sm:right-6 sm:top-6")}>
            <X className="h-5 w-5" />
          </button>

          <div className="relative my-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,400px)_1fr] md:gap-12" onClick={(e) => e.stopPropagation()}>
            {/* resting the pointer on the portrait pauses the run; leaving it resumes */}
            <div className="relative mx-auto w-full max-w-[400px]" onPointerMove={(e) => { if (e.pointerType !== "touch" && !paused) pause(); }} onPointerLeave={() => paused && resume()}>
              <div className={cn("relative aspect-[4/5] w-full", founder && "founder-ring")} style={{ ["--hue" as string]: hue }}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={member.id}
                    layoutId={member.id === entryId ? `portrait-${member.id}` : undefined}
                    initial={member.id === entryId ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 240, damping: 30 }}
                    className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
                  >
                    <Portrait member={member} sizes="(min-width: 768px) 400px, 90vw" priority />
                    <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px]" style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 45%, transparent)` }} />
                  </motion.div>
                </AnimatePresence>
              </div>
              {intro && (
                <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div key={`${member.id}-${cycle}`} className="h-full origin-left rounded-full" style={{ background: hue, animation: last ? "none" : `intro-progress ${INTRO_SECONDS}s linear forwards`, animationPlayState: paused ? "paused" : "running", transform: last ? "scaleX(1)" : undefined }} />
                </div>
              )}
            </div>

            <div className="relative text-white">
              <AnimatePresence mode="wait">
                <motion.div key={member.id} initial="hidden" animate="show" exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}>
                  <motion.div variants={line} className="flex flex-wrap items-center gap-2">
                    <DepartmentChip member={member} className="text-[11.5px]" />
                    {founder && <FounderSeal size="md" />}
                  </motion.div>
                  <motion.h2 variants={line} className="mt-4 text-balance text-[40px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[56px]">{member.name}</motion.h2>
                  {nick !== member.name && (
                    <motion.p variants={line} className="mt-3 text-[15px] text-white/70">
                      Goes by <span className="rounded-md px-1.5 py-0.5 font-semibold text-white" style={{ background: `color-mix(in oklab, ${hue} 35%, transparent)` }}>{nick}</span>
                    </motion.p>
                  )}
                  <motion.p variants={line} className="mt-3 text-[17px] font-medium sm:text-[19px]" style={{ color: hue }}>{member.title}</motion.p>
                  {founder && <motion.p variants={line} className="mt-2 text-[13px] text-white/55">Started HostOS Collective and still leads it — every vertical, every client, every hire.</motion.p>}
                  {variant === "full" && member.focus.length > 0 && <motion.p variants={line} className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">{member.focus.join(" · ")}</motion.p>}
                  {variant === "full" && member.quote && (
                    <motion.p variants={line} className="mt-5 max-w-lg rounded-2xl px-4 py-3 text-[15px] font-medium leading-snug" style={{ background: `color-mix(in oklab, ${hue} 16%, transparent)` }}>
                      &ldquo;{member.quote}&rdquo;
                    </motion.p>
                  )}
                  {variant === "full" && member.responsibilities.length > 0 && (
                    <motion.ul variants={line} className="mt-5 grid max-w-xl grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {member.responsibilities.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-[13px] leading-snug text-white/80">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hue }} />
                          {r}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                  <motion.p variants={line} className="mt-8 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
                    {index + 1} of {members.length} · HostOS Collective
                  </motion.p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => step(prev.id)} aria-label={`Previous: ${shortName(prev)}`} className={round}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => step(next.id)} aria-label={`Next: ${shortName(next)}`} className={round}>
                  <ChevronRight className="h-5 w-5" />
                </button>
                {intro && !last && (
                  <button type="button" onClick={toggle} aria-label={paused ? "Resume the introductions" : "Pause the introductions"} className={cn(round, "w-auto gap-2 px-4 text-[12.5px] font-medium")}>
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Resume" : "Pause"}
                  </button>
                )}
                <span className="ml-2 hidden text-[12px] text-white/45 sm:inline">{intro && !last ? (paused ? "Paused · move off the portrait or press Space · " : "Introductions running · rest on the portrait to pause · ") : ""}← → to walk the collective · Esc to close</span>
              </div>

              <nav aria-label="Everyone" className="mt-6 hidden flex-wrap gap-2 sm:flex">
                {members.map((m) => (
                  <button key={m.id} type="button" onClick={() => step(m.id)} aria-label={m.name} aria-current={m.id === member.id} className={cn("rounded-full transition-transform duration-300 ease-[var(--ease-out-expo)] hover:scale-110", m.id === member.id ? "scale-110 ring-2 ring-offset-2 ring-offset-[#05070c]" : "opacity-70 hover:opacity-100")} style={{ ["--tw-ring-color" as string]: hueOf(m) }}>
                    <MemberPhoto member={m} size={36} />
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
