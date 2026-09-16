"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { TeamTiles } from "@/components/marketing/team-tiles";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS, type Department, type TeamProfile } from "@/lib/team/profiles";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The Collective: who does what across HostOS Collective. The public site
 * introduces people by name and role; this page, for signed-in members,
 * carries each person's focus, promise and responsibilities so anyone can
 * see who to bring a question to.
 */
export function CollectivePage({ members }: { members: TeamProfile[] }) {
  const departments = [...new Set(members.map((m) => m.department))] as Department[];
  return (
    <div className="mx-auto w-full max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">HostOS Collective</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">The Collective</h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">A collective, not a hierarchy chart: every member owns a craft, and this is what each of us holds and promises — so you always know who to bring a question to.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {departments.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium" style={{ color: DEPARTMENTS[d].hue }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: DEPARTMENTS[d].hue }} />
                {DEPARTMENTS[d].label} · {members.filter((m) => m.department === d).length}
              </span>
            ))}
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/team" target="_blank">
            Public team page <ExternalLink />
          </Link>
        </Button>
      </motion.div>
      <TeamTiles members={members} />
      <p className="mt-8 text-center text-[13px] italic text-muted-foreground">&ldquo;Alone we can do so little. Together we can do so much.&rdquo; — Helen Keller</p>
    </div>
  );
}
