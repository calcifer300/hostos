"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductMock } from "@/components/marketing/product-mock";
import { HERO } from "@/components/marketing/data";
import { SITE } from "@/lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <motion.div variants={container} initial="hidden" animate="show" className="relative">
          <motion.p
            variants={item}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {HERO.eyebrow}
          </motion.p>

          <motion.h1
            variants={item}
            className="text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[54px] md:text-[62px]"
          >
            {HERO.title[0]} <span className="text-gradient">{HERO.title[1]}</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-pretty text-[16px] leading-relaxed text-muted-foreground md:text-[18px]">
            {HERO.description}
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="gradient" size="xl">
              <a href={HERO.primaryCta.href}>
                {HERO.primaryCta.label}
                <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <a href={HERO.secondaryCta.href}>{HERO.secondaryCta.label}</a>
            </Button>
            <a
              href={SITE.whatsappConsultation}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4 text-success" /> Chat on WhatsApp
            </a>
          </motion.div>

          <motion.dl variants={item} className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {HERO.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[20px] font-semibold tracking-tight text-foreground">{f.value}</dt>
                <dd className="text-[12px] text-muted-foreground">{f.label}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <div className="relative lg:justify-self-end lg:max-w-[600px]">
          <ProductMock className="w-full" />
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6, ease: EASE }}
            className="mt-3 text-center text-[11.5px] text-muted-foreground"
          >
            HostOS — smarter operations, higher earnings, less risk. The platform our whole team runs on, included with every engagement.
          </motion.p>
        </div>
      </div>

      <motion.a
        href="#who"
        aria-label="Scroll to learn more"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="mx-auto mt-16 flex w-fit flex-col items-center gap-1 text-muted-foreground/60"
      >
        <span className="text-[11px] uppercase tracking-[0.18em]">Explore</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </motion.a>
    </section>
  );
}
