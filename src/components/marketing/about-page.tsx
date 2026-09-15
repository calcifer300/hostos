"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { IconBadge, SectionHeading } from "@/components/marketing/sections";
import { BRANDS_WORKED_WITH, EXPERIENCE, EXPERTISE, TECHNICAL_SKILLS } from "@/components/marketing/data";
import { SITE } from "@/lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

/** /about — where the Collective's experience comes from, written for the company rather than a person. */
export function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden px-6 pt-36 pb-16 md:pt-44 md:pb-20">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] blur-3xl" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">About {SITE.company}</p>
          <h1 className="text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[56px]">
            Founder-led. <span className="text-gradient">Operator-built.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-muted-foreground md:text-[17px]">
            HostOS Collective is built on its founder&rsquo;s ten-plus years across operations, customer service, full-stack development and leadership — and
            on a team trained in that experience. We approach business differently from a traditional agency or VA because we understand how businesses actually
            function, from every angle. Before HostOS Collective, our founder was an operations supervisor; before that, a tech support specialist; before that,
            a web advisor. World-class companies, real teams, systems built from scratch. That&rsquo;s what makes this different.
          </p>
          <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            The experience below is our founder&rsquo;s — the foundation the whole team is trained on.
          </p>
        </motion.div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Founder's background" title="We understand businesses from the inside out." description="Our founder's background spans the full spectrum — operations, customer service, technology, leadership, and real business strategy — and it is what every member of the Collective is trained in." />
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.06}>
            {EXPERTISE.map((e) => (
              <StaggerItem key={e.title} className="spot rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40">
                <IconBadge icon={e.icon} />
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{e.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{e.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-y border-border bg-surface/60 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Founder's experience" title="A career built across industries." description="From telecom and SaaS to e-commerce, food delivery and transportation — the founder's career, role by role. This is the experience behind HostOS Collective." />
          <ol className="relative border-l border-border pl-6">
            {EXPERIENCE.map((x, i) => (
              <Reveal key={x.role + x.company} as="li" delay={i * 0.04} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[15.5px] font-semibold tracking-tight">{x.role}</h3>
                  <span className="text-[13px] text-accent">{x.company}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground">{x.duration}</span>
                </div>
                <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{x.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow="Founder's technical expertise"
            title="Full-stack development is our foundation."
            description="Our founder doesn't just coordinate — our founder builds. The technical work spans web development, mobile apps, API integrations, AI implementation, automation, and both front-end and back-end systems. That means we solve problems from both a technical and an operational angle: we don't just tell clients what they need — we build it, automate it, and support it. HostOS itself is the proof."
            className="mb-0"
          />
          <Reveal y={20} className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)] md:p-8">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TECHNICAL_SKILLS.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-[14px]">
                  <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-bg">
                    <Check className="h-3 w-3 text-success" />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface/60 px-6 py-14 md:py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-6 text-center text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Founder&rsquo;s experience · real brands</p>
          </Reveal>
          <Stagger className="flex flex-wrap justify-center gap-3" gap={0.04}>
            {BRANDS_WORKED_WITH.map((b) => (
              <StaggerItem key={b}>
                <span className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground/90">{b}</span>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-4 text-center text-[11.5px] text-muted-foreground">Companies our founder has worked with or for. Trademarks belong to their owners.</p>
        </div>
      </section>

      <section className="px-6 py-20 md:py-28">
        <Reveal className="gradient-border relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card p-10 text-center shadow-[var(--shadow-elevated)] md:p-14">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-glow),transparent_70%)]" />
          <h2 className="text-balance text-[28px] font-semibold tracking-[-0.025em] md:text-[38px]">Let&rsquo;s build something together.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">Whether you need development, automation, or a trained support team — we have the experience and the team to make it happen.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="xl">
              <Link href="/#contact">
                Get in touch <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <Link href="/team">Meet the team</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
