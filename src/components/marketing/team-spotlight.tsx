"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DepartmentChip, EASE, MemberPhoto, Portrait } from "@/components/marketing/team-portrait";
import { useMounted } from "@/lib/hooks/use-client-value";
import { hueOf, type TeamProfile } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

/**
 * One person, full screen: the tile's portrait flies out into a large
 * frame (shared layoutId), the room takes on their colour, and their name
 * and role come in line by line. ← → walk the collective, Esc closes, the
 * strip at the bottom jumps to anyone. The public view stops at the role;
 * the full view (The Collective) adds focus, promise and responsibilities.
 */
export function TeamSpotlight({ members, openId, variant, onClose, onSelect }: { members: TeamProfile[]; openId: string | null; variant: "public" | "full"; onClose: () => void; onSelect: (id: string) => void }) {
  const mounted = useMounted();
  const reduced = useReducedMotion();

  const index = members.findIndex((m) => m.id === openId);
  const member = index >= 0 ? members[index] : null;
  const prev = members[(index - 1 + members.length) % members.length];
  const next = members[(index + 1) % members.length];

  React.useEffect(() => {
    if (!member) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onSelect(next.id);
      else if (e.key === "ArrowLeft") onSelect(prev.id);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [member, next, prev, onClose, onSelect]);

  if (!mounted) return null;
  const hue = member ? hueOf(member) : "#0a84ff";
  const line = { hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } } };

  return createPortal(
    <AnimatePresence>
      {member && (
        <motion.div key="spotlight" role="dialog" aria-modal="true" aria-label={`${member.name}, ${member.title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.28 } }} transition={{ duration: 0.4 }} className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-4 sm:p-8" onClick={onClose}>
          <div className="absolute inset-0 bg-[#05070c]/85 backdrop-blur-xl" />
          {/* the room in their colour: a soft radial wash, no filter, so it costs nothing to animate */}
          <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(closest-side, ${hue}, transparent 70%)` }} animate={{ opacity: 0.3, scale: reduced ? 1 : [1, 1.05, 1] }} initial={{ opacity: 0 }} transition={{ opacity: { duration: 0.6 }, scale: { duration: 9, repeat: Infinity, ease: "easeInOut" } }} />

          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:right-6 sm:top-6">
            <X className="h-5 w-5" />
          </button>

          <div className="relative my-auto grid w-full max-w-5xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,400px)_1fr] md:gap-12" onClick={(e) => e.stopPropagation()}>
            <motion.div layoutId={`portrait-${member.id}`} transition={{ type: "spring", stiffness: 240, damping: 30 }} className="relative mx-auto aspect-[4/5] w-full max-w-[400px] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
              <Portrait member={member} sizes="(min-width: 768px) 400px, 90vw" priority />
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px]" style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 45%, transparent)` }} />
            </motion.div>

            <div className="relative text-white">
              <AnimatePresence mode="wait">
                <motion.div key={member.id} initial="hidden" animate="show" exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}>
                  <motion.div variants={line}><DepartmentChip member={member} className="text-[11.5px]" /></motion.div>
                  <motion.h2 variants={line} className="mt-4 text-[44px] font-semibold leading-[0.95] tracking-[-0.035em] sm:text-[60px]">{member.name}</motion.h2>
                  <motion.p variants={line} className="mt-3 text-[17px] font-medium sm:text-[19px]" style={{ color: hue }}>{member.title}</motion.p>
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

              <div className="mt-6 flex items-center gap-2">
                <button type="button" onClick={() => onSelect(prev.id)} aria-label={`Previous: ${prev.name}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:bg-white/15 hover:text-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => onSelect(next.id)} aria-label={`Next: ${next.name}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:bg-white/15 hover:text-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="ml-2 hidden text-[12px] text-white/45 sm:inline">← → to walk the collective · Esc to close</span>
              </div>

              <nav aria-label="Everyone" className="mt-6 hidden flex-wrap gap-2 sm:flex">
                {members.map((m) => (
                  <button key={m.id} type="button" onClick={() => onSelect(m.id)} aria-label={m.name} aria-current={m.id === member.id} className={cn("rounded-full transition-transform duration-300 ease-[var(--ease-out-expo)] hover:scale-110", m.id === member.id ? "scale-110 ring-2 ring-offset-2 ring-offset-[#05070c]" : "opacity-70 hover:opacity-100")} style={{ ["--tw-ring-color" as string]: hueOf(m) }}>
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
