"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BarChart3, Cpu, Crown, FolderKanban, Handshake, Headset, Landmark, Lightbulb, Megaphone, PenLine, Settings2, type LucideIcon } from "lucide-react";
import { DEPARTMENTS, hueOf, initials, type DepartmentDefinition, type TeamProfile } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export const DEPARTMENT_ICONS: Record<DepartmentDefinition["icon"], LucideIcon> = { Crown, Cpu, Settings2, Megaphone, Handshake, PenLine, Headset, Landmark, Lightbulb, FolderKanban, BarChart3 };

/** The grids below run 2 → 3 → 4 columns; tell next/image so it picks a sensible width. */
const GRID_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * The portrait, filling whatever box it is given (the parent is positioned).
 * Photos on this site are 4:5 (public/team/<slug>.jpg) and go through
 * next/image; a photo linked from elsewhere is shown as-is. Until a photo
 * exists, the person's initials in their colour. Faces sit in the upper
 * part of the frame, so a shorter box keeps the top rather than the middle.
 */
export function Portrait({ member, sizes = GRID_SIZES, fallbackSize = 40 }: { member: TeamProfile; sizes?: string; fallbackSize?: number }) {
  const hue = hueOf(member);
  if (member.photoUrl?.startsWith("/")) {
    return <Image src={member.photoUrl} alt={member.name} fill sizes={sizes} className="object-cover" style={{ objectPosition: "50% 15%" }} />;
  }
  if (member.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.photoUrl} alt={member.name} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "50% 15%" }} />;
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center font-semibold" style={{ background: `color-mix(in oklab, ${hue} 18%, var(--card))`, color: hue, fontSize: fallbackSize }} aria-hidden>
      {initials(member.name)}
    </span>
  );
}

/** The small round version — the editor's list, and anywhere an avatar is enough. */
export function MemberPhoto({ member, size = 72 }: { member: TeamProfile; size?: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full border-2 shadow-[var(--shadow-card)]" style={{ width: size, height: size, borderColor: `color-mix(in oklab, ${hueOf(member)} 60%, transparent)` }}>
      <Portrait member={member} sizes={`${size}px`} fallbackSize={size * 0.32} />
    </span>
  );
}

/** The department mark, sitting on the photo's corner like a chooser tile's icon. */
function DepartmentMark({ member }: { member: TeamProfile }) {
  const dept = DEPARTMENTS[member.department];
  const Icon = DEPARTMENT_ICONS[dept.icon];
  return (
    <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white shadow-[var(--shadow-card)] backdrop-blur-md transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-3 group-hover:scale-110" style={{ background: `color-mix(in oklab, ${hueOf(member)} 55%, rgba(0, 0, 0, 0.45))` }} title={dept.label}>
      <Icon className="h-4 w-4" strokeWidth={1.9} />
    </span>
  );
}

/** The photo block at the top of a tile: the full 4:5 portrait, a slow zoom on hover, and a fade into the card so photo and text read as one piece. */
function PortraitBlock({ member }: { member: TeamProfile }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden">
      <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]">
        <Portrait member={member} fallbackSize={56} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(to top, var(--card), transparent)" }} />
      <DepartmentMark member={member} />
    </div>
  );
}

/**
 * One person, in the same tile language as the vertical chooser: their
 * colour on the mark, the glow, the bullets and the pulse — with the
 * portrait itself as the tile's face.
 *
 * Two views. "public" (hostoscollective.com/team, signed out) is the
 * introduction: portrait, name and role, nothing else. "full" (The
 * Collective, inside the app) adds focus words, the one-line promise and
 * what each person is responsible for.
 */
export function TeamTile({ member, compact = false, variant = "full" }: { member: TeamProfile; compact?: boolean; variant?: "public" | "full" }) {
  const dept = DEPARTMENTS[member.department];
  const hue = hueOf(member);
  const Icon = DEPARTMENT_ICONS[dept.icon];
  const shell = "spot group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--hue)_55%,var(--border))] hover:shadow-[var(--shadow-card-hover)]";
  const glow = <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-50" style={{ background: hue }} />;
  if (variant === "public") {
    return (
      <motion.article variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }} whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }} style={{ ["--hue" as string]: hue, ["--spot" as string]: hue }} className={cn(shell, "text-center")}>
        <PortraitBlock member={member} />
        <div className="relative px-4 pb-5">
          {glow}
          <h3 className="relative text-[18px] font-semibold tracking-tight">{member.name}</h3>
          <p className="relative mt-0.5 text-[12.5px] font-medium leading-snug" style={{ color: hue }}>{member.title}</p>
          <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            <Icon className="h-3 w-3" style={{ color: hue }} strokeWidth={2} /> {dept.label}
          </span>
        </div>
      </motion.article>
    );
  }
  return (
    <motion.article variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }} whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }} style={{ ["--hue" as string]: hue, ["--spot" as string]: hue }} className={cn(shell, "text-left", !member.active && "opacity-60")}>
      <PortraitBlock member={member} />
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        {glow}
        <h3 className="relative text-[19px] font-semibold tracking-tight">{member.name}</h3>
        <p className="relative text-[12.5px] font-medium" style={{ color: hue }}>{member.title}</p>
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
      </div>
    </motion.article>
  );
}

/** The roster grid, staggered in like the chooser's cards. */
export function TeamTiles({ members, compact = false, variant = "full" }: { members: TeamProfile[]; compact?: boolean; variant?: "public" | "full" }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10% 0px" }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }} className={cn("grid gap-5", variant === "public" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
      {members.map((m) => (
        <TeamTile key={m.id} member={m} compact={compact} variant={variant} />
      ))}
    </motion.div>
  );
}
