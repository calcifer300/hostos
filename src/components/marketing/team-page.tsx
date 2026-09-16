"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Bullets, IconBadge, SectionHeading } from "@/components/marketing/sections";
import { CHANNELS, TEAM_POINTS, TEAM_PROMISES } from "@/components/marketing/data";
import { TeamPulse } from "@/components/marketing/team-pulse";
import { TeamTiles } from "@/components/marketing/team-tiles";
import type { TeamProfile } from "@/lib/team/profiles";
import { routes } from "@/lib/routes";

const EASE = [0.16, 1, 0.3, 1] as const;

/** /team — the virtual-assistance and support team, and the standards behind it. */
export function TeamPage({ members }: { members: TeamProfile[] }) {
  return (
    <>
      <section className="relative overflow-hidden px-6 pt-36 pb-16 md:pt-44 md:pb-20">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] blur-3xl" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">Our team</p>
          <h1 className="text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[56px]">
            A trained, coordinated team — <span className="text-gradient">not just a group of assistants.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-muted-foreground md:text-[17px]">
            Every member of our team is hand-selected, continuously trained, and held to the same high standard. We operate with process, consistency, and
            professionalism — and we all work inside HostOS — so your business is always in good hands.
          </p>
        </motion.div>
      </section>

      {/* The roster: the pulse of the collective, then one tile per person — tilt, sheen, spotlight — in the same language as the vertical chooser. */}
      <section id="roles" className="scroll-mt-24 px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Meet the team"
            title={
              <>
                Different strengths. <span className="text-gradient">One mission.</span>
              </>
            }
            description="Not a company with departments — a collective of operators, engineers, marketers and specialists who each own a craft, work inside the same HostOS workspace, and answer to the same clients. What we sell is what we use."
            align="center"
            className="max-w-3xl"
          />
          <TeamPulse members={members} />
          <TeamTiles members={members} variant="public" />
          <Reveal delay={0.2} className="mx-auto mt-10 max-w-3xl text-center text-[14px] italic text-muted-foreground">
            &ldquo;Alone we can do so little. Together we can do so much.&rdquo; — Helen Keller
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface/60 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="What sets us apart" title="Built on standards, not shortcuts." description="Here's what makes our team different from a typical freelance VA arrangement." />
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.07}>
            {TEAM_POINTS.map((p) => (
              <StaggerItem key={p.title} className="spot rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40">
                <IconBadge icon={p.icon} />
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow="Team leadership"
            title="Led by experience. Trained for excellence."
            description="Our founder leads the team personally. With over ten years across telecom, SaaS, e-commerce and operations, everything learned on the floor is passed along through regular, hands-on training sessions. The goal is simple: nobody is left out, and every team member performs at a top-tier level — regardless of the task, the client, or the channel."
            className="mb-0"
          />
          <Reveal y={20} className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)] md:p-8">
            <p className="text-[13.5px] font-semibold tracking-tight">What you can expect from our team</p>
            <Bullets items={TEAM_PROMISES} className="mt-4" />
            <div className="mt-6">
              <Button asChild variant="ghost" size="sm">
                <Link href="/about">
                  About HostOS Collective <ArrowRight />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Channels" title="We've got every channel covered." description="Whether your customers prefer to call, email, or chat — our team is ready, and every conversation lands in your HostOS workspace." align="center" />
          <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3" gap={0.08}>
            {CHANNELS.map((c) => (
              <StaggerItem key={c.title} className="spot rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
                <IconBadge icon={c.icon} className="mx-auto" />
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="px-6 pb-20 md:pb-28">
        <Reveal className="gradient-border relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card p-10 text-center shadow-[var(--shadow-elevated)] md:p-14">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-glow),transparent_70%)]" />
          <h2 className="text-balance text-[28px] font-semibold tracking-[-0.025em] md:text-[38px]">Ready to work with a real team?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">Let&rsquo;s talk about how our trained professionals can support your business.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="xl">
              <Link href="/#contact">
                Book a consultation <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <Link href={routes.app}>Launch HostOS</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
