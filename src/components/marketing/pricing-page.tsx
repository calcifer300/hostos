import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/sections";
import type { ServiceRow } from "@/lib/site/film";

/**
 * Services and prices, the same eight the landing page shows, on the app's
 * own route so they are public even between site deploys. Custom work is a
 * quote, never a number. The Founder edits every field at Settings → Website.
 */
const CONSULT = "https://hostoscollective.com/#contact";

export function PricingPage({ services }: { services: ServiceRow[] }) {
  return (
    <div className="px-6 pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Services & pricing" title="Clear prices. No surprises." description="Every price shows exactly what is included. Custom work is quoted after we understand the scope. The strategy call is free either way." align="center" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {services.map((s) => (
            <article key={s.id} className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-[20px] font-bold tracking-tight">{s.name}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.blurb}</p>
              <ul className="mt-5 space-y-2">
                {s.tiers.map((t) => (
                  <li key={t.name} className="rounded-2xl border border-border bg-surface px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold">{t.name}</span>
                      <span className="text-right"><span className={/^\$/.test(t.price) ? "font-mono text-[20px] font-bold text-accent" : "font-mono text-[13px] font-bold"}>{t.price}</span>{t.period && <span className="ml-1 text-[12px] text-muted-foreground">{t.period}</span>}</span>
                    </div>
                    {t.note && <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{t.note}</p>}
                  </li>
                ))}
              </ul>
              <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Technologies">
                {s.stack.map((tech) => <li key={tech} className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10.5px]">{tech}</li>)}
              </ul>
              <ul className="mt-5 space-y-1.5">
                {s.included.map((it) => <li key={it} className="flex items-start gap-2 text-[13.5px] text-foreground/85"><Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />{it}</li>)}
              </ul>
              <details className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                <summary className="cursor-pointer font-semibold text-accent">Deliverables, timeline and why this price</summary>
                <div className="mt-3 space-y-2">
                  <p><span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider">You get</span>{s.deliverables.join(" · ")}</p>
                  <p><span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider">Ideal for</span>{s.ideal}</p>
                  <p><span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider">Timeline</span>{s.timeline}</p>
                  <p><span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider">Support</span>{s.support}</p>
                  <p><span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider">Why this price</span>{s.why}</p>
                </div>
              </details>
              <div className="mt-auto pt-6">
                <Button asChild variant={s.id === "operations" ? "primary" : "secondary"} className="w-full">
                  <Link href={CONSULT}>{s.model === "custom" ? "Get an estimate" : "Book a Free Strategy Call"} <ArrowRight /></Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-3xl text-center text-[14px] leading-relaxed text-muted-foreground">All prices in USD. Tool subscriptions and ad spend are billed to you directly. Every engagement starts with a free 45-minute strategy call — no obligation, and you keep the plan either way.</p>
      </div>
    </div>
  );
}
