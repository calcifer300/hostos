"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/sections";
import { FAQS, PRICING } from "@/components/marketing/data";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple platform plans. Services quoted to fit."
          description="HostOS is free while we pilot; the plans are indicative and nobody is billed without agreeing to one first. Virtual assistants, custom builds, websites and marketing are scoped after a free consultation."
          align="center"
        />
        <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3" gap={0.08}>
          {PRICING.map((tier) => (
            <StaggerItem
              key={tier.name}
              className={cn(
                "relative flex h-full flex-col rounded-[1.5rem] border bg-card p-7 shadow-[var(--shadow-card)]",
                tier.highlighted ? "gradient-border border-transparent shadow-[var(--shadow-glow)]" : "border-border"
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-[linear-gradient(120deg,var(--accent),var(--accent-2))] px-3 py-1 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-[15px] font-semibold">{tier.name}</h3>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[40px] font-semibold leading-none tracking-tight">{tier.price}</span>
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">{tier.period}</p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant={tier.highlighted ? "gradient" : "secondary"} size="lg" className="mt-8 w-full">
                <Link href={tier.href ?? routes.app}>
                  {tier.cta}
                  <ArrowRight />
                </Link>
              </Button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15.5px] font-medium tracking-tight">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.25 }} className="shrink-0 text-muted-foreground">
          <Plus className="h-4.5 w-4.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-[14px] leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow="FAQ" title="Questions businesses ask first." className="mb-0" />
        <Reveal className="rounded-[1.5rem] border border-border bg-card px-6 shadow-[var(--shadow-card)]">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
