"use client";

import * as React from "react";
import Image from "next/image";
import { BarChart3, Cpu, Crown, FolderKanban, Handshake, Headset, Landmark, Lightbulb, Megaphone, PenLine, Settings2, type LucideIcon } from "lucide-react";
import { isOptimizableSrc } from "@/lib/team/photo-look";
import { DEPARTMENTS, hueOf, initials, type DepartmentDefinition, type TeamProfile } from "@/lib/team/profiles";

export const EASE = [0.16, 1, 0.3, 1] as const;

export const DEPARTMENT_ICONS: Record<DepartmentDefinition["icon"], LucideIcon> = { Crown, Cpu, Settings2, Megaphone, Handshake, PenLine, Headset, Landmark, Lightbulb, FolderKanban, BarChart3 };

/** The grids run 2 → 3 → 4 columns; tell next/image so it picks a sensible width. */
export const GRID_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * The portrait, filling whatever box it is given (the parent is positioned).
 * Photos on this site and in the team bucket are 4:5 and go through
 * next/image; a photo linked from elsewhere is shown as-is. Until a photo
 * exists — or if the link is broken — the person's initials in their colour.
 * Faces sit in the upper part of the frame, so a shorter box keeps the top.
 */
export function Portrait({ member, sizes = GRID_SIZES, fallbackSize = 40, priority = false }: { member: TeamProfile; sizes?: string; fallbackSize?: number; priority?: boolean }) {
  const hue = hueOf(member);
  const [broken, setBroken] = React.useState<string | null>(null);
  const src = member.photoUrl && member.photoUrl !== broken ? member.photoUrl : null;
  const fail = () => setBroken(member.photoUrl);
  if (src && isOptimizableSrc(src)) {
    return <Image src={src} alt={member.name} fill sizes={sizes} priority={priority} className="object-cover" style={{ objectPosition: "50% 15%" }} onError={fail} />;
  }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={member.name} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "50% 15%" }} onError={fail} />;
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center font-semibold" style={{ background: `color-mix(in oklab, ${hue} 18%, var(--card))`, color: hue, fontSize: fallbackSize }} aria-hidden>
      {initials(member.name)}
    </span>
  );
}

/** The small round version — the editor's list, the spotlight's strip, anywhere an avatar is enough. */
export function MemberPhoto({ member, size = 72, className }: { member: TeamProfile; size?: number; className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full border-2 shadow-[var(--shadow-card)] ${className ?? ""}`} style={{ width: size, height: size, borderColor: `color-mix(in oklab, ${hueOf(member)} 60%, transparent)` }}>
      <Portrait member={member} sizes={`${size}px`} fallbackSize={size * 0.32} />
    </span>
  );
}

/** The department mark: the craft's icon in the person's colour, like a chooser tile's icon. */
export function DepartmentMark({ member, size = "md" }: { member: TeamProfile; size?: "md" | "lg" }) {
  const dept = DEPARTMENTS[member.department];
  const Icon = DEPARTMENT_ICONS[dept.icon];
  return (
    <span className={`flex items-center justify-center rounded-xl border border-white/15 text-white shadow-[var(--shadow-card)] backdrop-blur-md ${size === "lg" ? "h-11 w-11" : "h-9 w-9"}`} style={{ background: `color-mix(in oklab, ${hueOf(member)} 55%, rgba(0, 0, 0, 0.45))` }} title={dept.label}>
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.9} />
    </span>
  );
}

/** The department as a small chip: icon and label in the person's colour. */
export function DepartmentChip({ member, className }: { member: TeamProfile; className?: string }) {
  const dept = DEPARTMENTS[member.department];
  const Icon = DEPARTMENT_ICONS[dept.icon];
  const hue = hueOf(member);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${className ?? ""}`} style={{ color: hue, borderColor: `color-mix(in oklab, ${hue} 35%, transparent)`, background: `color-mix(in oklab, ${hue} 10%, transparent)` }}>
      <Icon className="h-3 w-3" strokeWidth={2} /> {dept.label}
    </span>
  );
}
