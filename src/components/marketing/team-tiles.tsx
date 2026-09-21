"use client";

import * as React from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Play } from "lucide-react";
import { Constellation } from "@/components/marketing/constellation";
import { FounderSeal, RoleMotif } from "@/components/marketing/team-motifs";
import { DEPARTMENT_ICONS, DepartmentMark, EASE, Portrait } from "@/components/marketing/team-portrait";
import { INTRO_SECONDS, TeamSpotlight } from "@/components/marketing/team-spotlight";
import { DEPARTMENTS, hueOf, isFounderProfile, shortName, type TeamProfile } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

export { DEPARTMENT_ICONS, MemberPhoto, Portrait } from "@/components/marketing/team-portrait";

type Variant = "public" | "full";

/** Anything on the page can start the introductions: `window.dispatchEvent(new Event(MEET_EVERYONE))`. */
export const MEET_EVERYONE = "hostos:meet-everyone";

/** Each tile rises as it scrolls into view, a beat after its neighbour to the left; the name plate slides up out of a mask just after. */
const reveal = (column: number) => ({
  hidden: { opacity: 0, y: 40, scale: 0.93 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: EASE, delay: column * 0.08, delayChildren: 0.25, staggerChildren: 0.08 } },
});
const plate = { hidden: { y: "110%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: EASE } } };

/** A line of text that slides up out of a clipped box — the name plate. */
function Plate({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("block overflow-hidden", className)}>
      <motion.span variants={plate} className="block">{children}</motion.span>
    </span>
  );
}

/**
 * One person, in the same tile language as the vertical chooser — their
 * colour on the mark, the glow, the pulse — with the portrait itself as the
 * tile's face and their craft's motif in the corner. The tile follows the
 * pointer: it tilts toward it, a sheen crosses the card, the portrait
 * drifts a few pixels the other way. Click (or Enter) opens the spotlight.
 * The Founder's tile wears the seal and a circling ring of light. All of
 * it is still on touch screens and under reduced motion.
 *
 * Two views. "public" (hostoscollective.com/team, signed out) is the
 * introduction: portrait, full name and role, nothing else. "full" (The
 * Collective, inside the app) adds focus words, the one-line promise and
 * what each person is responsible for.
 */
export function TeamTile({ member, compact = false, variant = "full", index = 0, onOpen, onHover }: { member: TeamProfile; compact?: boolean; variant?: Variant; index?: number; onOpen?: (id: string) => void; onHover?: (id: string | null) => void }) {
  const reduced = useReducedMotion();
  const dept = DEPARTMENTS[member.department];
  const hue = hueOf(member);
  const Icon = DEPARTMENT_ICONS[dept.icon];
  const founder = isFounderProfile(member);
  const nick = shortName(member);

  const rx = useMotionValue(0), ry = useMotionValue(0), px = useMotionValue(50), py = useMotionValue(50);
  const rotateX = useSpring(rx, { stiffness: 220, damping: 24 });
  const rotateY = useSpring(ry, { stiffness: 220, damping: 24 });
  const driftX = useTransform(rotateY, [-9, 9], [-7, 7]);
  const driftY = useTransform(rotateX, [-9, 9], [7, -7]);
  const zoom = useSpring(1.06, { stiffness: 120, damping: 22 });
  const sheen = useMotionTemplate`radial-gradient(380px circle at ${px}% ${py}%, color-mix(in oklab, ${hue} 30%, transparent), transparent 62%)`;

  const follow = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    ry.set((x - 0.5) * 14);
    rx.set((0.5 - y) * 14);
    px.set(x * 100);
    py.set(y * 100);
  };
  const enter = () => {
    if (!reduced) zoom.set(1.12);
    onHover?.(member.id);
  };
  const rest = () => {
    rx.set(0); ry.set(0); px.set(50); py.set(50); zoom.set(1.06);
    onHover?.(null);
  };
  const open = () => {
    rx.set(0); ry.set(0);
    onOpen?.(member.id);
  };

  return (
    <motion.article
      variants={reveal(index % 4)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8% 0px" }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      style={{ rotateX, rotateY, transformPerspective: 1100, ["--hue" as string]: hue, ["--spot" as string]: hue }}
      onPointerMove={follow}
      onPointerEnter={enter}
      onPointerLeave={rest}
      onClick={onOpen ? open : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `${member.name}, ${member.title}` : undefined}
      className={cn(
        "spot group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] outline-none transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--hue)_55%,var(--border))] hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--hue)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "public" ? "text-center" : "text-left",
        onOpen && "cursor-pointer",
        !member.active && "opacity-60"
      )}
    >
      {/* the portrait: shared with the spotlight, so it flies out when opened */}
      <motion.div layoutId={`portrait-${member.id}`} transition={{ type: "spring", stiffness: 240, damping: 30 }} className="relative aspect-[4/5] w-full overflow-hidden">
        <motion.div style={{ x: driftX, y: driftY, scale: zoom }} className="absolute inset-0">
          <Portrait member={member} fallbackSize={56} />
        </motion.div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(to top, var(--card), transparent)" }} />
        <span className="absolute right-3 top-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-3 group-hover:scale-110">
          <DepartmentMark member={member} />
        </span>
        {founder && <FounderSeal className="absolute left-3 top-3" />}
        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex translate-y-2 items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-md transition-all duration-300 ease-[var(--ease-out-expo)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          Meet {nick} <ArrowUpRight className="h-3 w-3" />
        </span>
      </motion.div>

      {/* the sheen that follows the pointer */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: sheen }} />

      <div className={cn("relative flex flex-1 flex-col", variant === "public" ? "px-4 pb-5" : "px-5 pb-5")}>
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-25 transition-opacity duration-500 group-hover:opacity-60" style={{ background: `radial-gradient(closest-side, ${hue}, transparent 70%)` }} />
        {/* the craft's motif, faint in the corner, brighter on hover */}
        <RoleMotif department={member.department} className={cn("pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.14] transition-opacity duration-500 group-hover:opacity-40", variant === "public" && "h-20 w-20")} />
        <Plate>
          <h3 className={cn("relative text-balance font-semibold tracking-tight", variant === "public" ? "text-[17px]" : "text-[19px]")}>{member.name}</h3>
        </Plate>
        <Plate>
          <p className="relative mt-0.5 text-[12.5px] font-medium leading-snug" style={{ color: hue }}>{member.title}</p>
        </Plate>
        {variant === "public" ? (
          <Plate className="mt-3 self-center">
            <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              <Icon className="h-3 w-3" style={{ color: hue }} strokeWidth={2} /> {dept.label}
            </span>
          </Plate>
        ) : (
          <>
            {member.focus.length > 0 && <p className="relative mt-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{member.focus.join(" · ")}</p>}
            {member.quote && (
              <p className="relative mt-3 rounded-xl px-3 py-2 text-[13px] font-medium leading-snug" style={{ background: `color-mix(in oklab, ${hue} 10%, transparent)` }}>
                &ldquo;{member.quote}&rdquo;
              </p>
            )}
            {!compact && member.responsibilities.length > 0 && (
              <ul className="relative mt-3 space-y-1">
                {member.responsibilities.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/85">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hue }} />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </motion.article>
  );
}

/**
 * The roster: tiles rising as they arrive over a constellation in the
 * members' colours, an ambient glow that glides to whichever tile the
 * pointer is on, the Founder's ring, and the spotlight for whoever is
 * clicked — or for everyone in turn, from the "Meet everyone" button (or
 * the MEET_EVERYONE event, which the page's hero sends).
 */
export function TeamTiles({ members, compact = false, variant = "full" }: { members: TeamProfile[]; compact?: boolean; variant?: Variant }) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<{ id: string; entry: string; intro: boolean } | null>(null);
  const returnTo = React.useRef<HTMLElement | null>(null);
  const hues = React.useMemo(() => members.map(hueOf), [members]);

  const openFrom = React.useCallback((id: string) => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen({ id, entry: id, intro: false });
  }, []);
  const meetEveryone = React.useCallback(() => {
    if (members.length === 0) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen({ id: members[0].id, entry: "", intro: true });
  }, [members]);
  const close = React.useCallback(() => {
    setOpen(null);
    returnTo.current?.focus();
  }, []);
  const select = React.useCallback((id: string) => setOpen((o) => (o ? { ...o, id } : { id, entry: id, intro: false })), []);
  const endIntro = React.useCallback(() => setOpen((o) => (o ? { ...o, intro: false } : o)), []);

  React.useEffect(() => {
    window.addEventListener(MEET_EVERYONE, meetEveryone);
    return () => window.removeEventListener(MEET_EVERYONE, meetEveryone);
  }, [meetEveryone]);

  const seconds = Math.round(members.length * INTRO_SECONDS);
  const length = seconds < 60 ? "under a minute" : `about ${Math.round(seconds / 60)} min`;

  return (
    <div className="relative isolate">
      <Constellation hues={hues} className="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-20 [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_95%)]" />
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="mb-8 flex justify-center">
        <button type="button" onClick={meetEveryone} className="btn-shine group inline-flex items-center gap-3 rounded-full border border-border bg-card py-2 pl-2 pr-5 text-[13.5px] font-medium shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[var(--shadow-card-hover)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white shadow-[0_8px_24px_-8px_var(--accent)] transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-110">
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          </span>
          Meet everyone
          <span className="text-[12px] text-muted-foreground">{members.length} introductions · {length}</span>
        </button>
      </motion.div>
      <div className={cn("grid gap-5", variant === "public" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
        {members.map((m, i) => (
          <div key={m.id} className={cn("relative", isFounderProfile(m) && "founder-ring")} style={{ ["--hue" as string]: hueOf(m) }}>
            {hovered === m.id && <motion.div layoutId="team-ambient" aria-hidden transition={{ type: "spring", stiffness: 260, damping: 32 }} className="pointer-events-none absolute -inset-5 -z-10 rounded-[32px] opacity-35 blur-2xl" style={{ background: hueOf(m) }} />}
            <TeamTile member={m} compact={compact} variant={variant} index={i} onOpen={openFrom} onHover={setHovered} />
          </div>
        ))}
      </div>
      <TeamSpotlight members={members} openId={open?.id ?? null} entryId={open?.entry ?? null} intro={open?.intro ?? false} variant={variant} onClose={close} onSelect={select} onIntroEnd={endIntro} />
    </div>
  );
}
