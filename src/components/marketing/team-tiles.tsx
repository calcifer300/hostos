"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BarChart3, Cpu, Crown, FolderKanban, Handshake, Headset, Landmark, Lightbulb, Megaphone, PenLine, Settings2, type LucideIcon } from "lucide-react";
import { DEPARTMENTS, hueOf, initials, type DepartmentDefinition, type TeamProfile } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export const DEPARTMENT_ICONS: Record<DepartmentDefinition["icon"], LucideIcon> = { Crown, Cpu, Settings2, Megaphone, Handshake, PenLine, Headset, Landmark, Lightbulb, FolderKanban, BarChart3 };

/**
 * A member's photo, or their initials in their colour until the photo exists.
 * Photos on this site go through next/image (the circle is 72–96px, the file
 * is 800px); a photo linked from elsewhere is shown as-is.
 */
export function MemberPhoto({ member, size = 72 }: { member: TeamProfile; size?: number }) {
  const dept = { ...DEPARTMENTS[member.department], hue: hueOf(member) };
  const frame = { width: size, height: size, borderColor: `color-mix(in oklab, ${dept.hue} 60%, transparent)` };
  const cls = "rounded-full border-2 object-cover shadow-[var(--shadow-card)]";
  return member.photoUrl?.startsWith("/") ? (
    <Image src={member.photoUrl} alt={member.name} width={size * 2} height={size * 2} sizes={`${size}px`} className={cls} style={frame} />
  ) : member.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={member.photoUrl} alt={member.name} width={size} height={size} className={cls} style={frame} />
  ) : (
    <span className="flex items-center justify-center rounded-full border-2 text-[20px] font-semibold" style={{ width: size, height: size, background: `color-mix(in oklab, ${dept.hue} 18%, var(--card))`, borderColor: `color-mix(in oklab, ${dept.hue} 60%, transparent)`, color: dept.hue }} aria-hidden>
      {initials(member.name)}
    </span>
  );
}

/**
 * One person, in the same tile language as the vertical chooser: the
 * department's colour on the icon, the glow, the bullets and the pulse.
 *
 * Two views. "public" (hostoscollective.com/team, signed out) is the
 * introduction: photo, name and role, nothing else. "full" (The Collective,
 * inside the app) adds focus words, the one-line promise and what each
 * person is responsible for — the internal roles-and-responsibilities view.
 */
export function TeamTile({ member, compact = false, variant = "full" }: { member: TeamProfile; compact?: boolean; variant?: "public" | "full" }) {
  const dept = { ...DEPARTMENTS[member.department], hue: hueOf(member) };
  const Icon = DEPARTMENT_ICONS[dept.icon];
  if (variant === "public") {
    return (
      <motion.article
        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.99 }}
        style={{ ["--hue" as string]: dept.hue, ["--spot" as string]: dept.hue }}
        className="spot group relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-5 text-center shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--hue)_55%,var(--border))] hover:shadow-[var(--shadow-card-hover)]"
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-55" style={{ background: dept.hue }} />
        <div className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-105">
          <MemberPhoto member={member} size={96} />
        </div>
        <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{member.name}</h3>
        <p className="mt-0.5 text-[12.5px] font-medium leading-snug" style={{ color: dept.hue }}>{member.title}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          <Icon className="h-3 w-3" style={{ color: dept.hue }} strokeWidth={2} /> {dept.label}
        </span>
      </motion.article>
    );
  }
  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      style={{ ["--hue" as string]: dept.hue, ["--spot" as string]: dept.hue }}
      className={cn("spot group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--hue)_55%,var(--border))] hover:shadow-[var(--shadow-card-hover)]", !member.active && "opacity-60")}
    >
      <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60" style={{ background: dept.hue }} />
      <div className="flex items-start justify-between gap-3">
        <MemberPhoto member={member} size={compact ? 56 : 72} />
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-3 group-hover:scale-110" style={{ background: `color-mix(in oklab, ${dept.hue} 16%, transparent)`, color: dept.hue }} title={dept.label}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>
      <h3 className="mt-4 text-[19px] font-semibold tracking-tight">{member.name}</h3>
      <p className="text-[12.5px] font-medium" style={{ color: dept.hue }}>{member.title}</p>
      {member.focus.length > 0 && <p className="mt-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{member.focus.join(" · ")}</p>}
      {member.quote && (
        <p className="mt-3 rounded-xl px-3 py-2 text-[13px] font-medium leading-snug" style={{ background: `color-mix(in oklab, ${dept.hue} 10%, transparent)` }}>
          &ldquo;{member.quote}&rdquo;
        </p>
      )}
      {!compact && member.responsibilities.length > 0 && (
        <ul className="mt-3 space-y-1">
          {member.responsibilities.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/85">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dept.hue }} />
              {r}
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

/** The roster grid, staggered in like the chooser's cards. */
export function TeamTiles({ members, compact = false, variant = "full" }: { members: TeamProfile[]; compact?: boolean; variant?: "public" | "full" }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10% 0px" }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }} className={cn("grid gap-4", variant === "public" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
      {members.map((m) => (
        <TeamTile key={m.id} member={m} compact={compact} variant={variant} />
      ))}
    </motion.div>
  );
}
