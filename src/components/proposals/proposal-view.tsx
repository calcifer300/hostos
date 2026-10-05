"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";
import { BeforeAfter, Figure, Label, Media, Panel, Reveal, Section } from "@/components/proposals/primitives";
import type { ProposalDoc } from "@/lib/proposals/types";
import { cn } from "@/lib/utils";

/**
 * The proposal itself: sixteen sections, read top to bottom, that answer the
 * client's real question — "why you instead of another VA agency?" — before
 * they ask it.
 *
 * The same component renders the internal preview and the shared client
 * view; `mode` only decides whether the internal chrome is present.
 */
export function ProposalView({ doc, mode = "internal" }: { doc: ProposalDoc; mode?: "internal" | "client" }) {
  const accent = doc.client.accent || "#5B7CFF";

  return (
    <div className="proposal-root" style={{ ["--proposal-accent" as string]: accent }}>
      <Hero doc={doc} mode={mode} />
      <ExecutiveSummary doc={doc} />
      <Outcomes doc={doc} />
      <ProductTour doc={doc} />
      <Industries doc={doc} />
      <Automations doc={doc} />
      <HumanOps doc={doc} />
      <Software doc={doc} />
      <CaseStudies doc={doc} />
      <Gallery doc={doc} />
      <BeforeAfterSection doc={doc} />
      <Roadmap doc={doc} />
      <Pricing doc={doc} />
      <Philosophy doc={doc} />
      <Faq doc={doc} />
      <FinalCta doc={doc} />
    </div>
  );
}

/* ------------------------------------------------------------------ 1. hero */

function Hero({ doc, mode }: { doc: ProposalDoc; mode: "internal" | "client" }) {
  const reduced = useReducedMotion();
  const { hero, client } = doc;
  return (
    <section className="proposal-section relative overflow-hidden px-6 pb-20 pt-16 md:pb-28 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(70% 55% at 50% 0%, color-mix(in oklab, var(--proposal-accent) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto w-full max-w-5xl text-center">
        {/* the two marks: ours, and the client's if they gave us one */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 flex items-center justify-center gap-5"
        >
          <span className="inline-flex items-center gap-2.5">
            <LogoMark size={34} />
            <Wordmark size="md" />
          </span>
          {client.logoUrl && (
            <>
              <span aria-hidden className="text-[20px] font-light text-muted-foreground">
                ×
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- a client logo is an arbitrary remote URL */}
              <img src={client.logoUrl} alt={client.company} className="h-8 w-auto max-w-[180px] object-contain" />
            </>
          )}
        </motion.div>

        <Reveal delay={0.05}>
          <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--proposal-accent)]">
            {hero.eyebrow}
            {client.company ? ` · prepared for ${client.company}` : ""}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <h1 className="headline text-balance text-[38px] leading-[1.04] md:text-[68px]">
            {hero.line1}
            <br />
            <em>{hero.line2}</em>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mx-auto mt-7 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted-foreground md:text-[19px]">{hero.body}</p>
        </Reveal>

        <Reveal delay={0.22}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {hero.ctas.map((cta, i) => (
              <Button key={cta.label} asChild variant={i === 0 ? "gradient" : "secondary"} size="xl">
                <a href={cta.href} target={cta.href.startsWith("http") ? "_blank" : undefined} rel={cta.href.startsWith("http") ? "noreferrer" : undefined}>
                  {cta.label} <ArrowRight />
                </a>
              </Button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-border pt-10 md:grid-cols-4">
            {hero.figures.map((f) => (
              <Figure key={f.label} value={f.value} label={f.label} />
            ))}
          </div>
        </Reveal>

        {mode === "internal" && (
          <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Internal preview · not visible to anyone without the link</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- 2. executive summary */

function ExecutiveSummary({ doc }: { doc: ProposalDoc }) {
  const { summary } = doc;
  return (
    <Section id="summary" eyebrow="Executive summary" title="Where the money" aside="actually goes." lede={summary.lede} tone="surface">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summary.losses.map((l, i) => (
          <Reveal key={l.name} delay={i * 0.04}>
            <Panel interactive className="h-full p-6">
              <span className="font-mono text-[11px] font-semibold text-danger">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-tight">{l.name}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{l.body}</p>
            </Panel>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1}>
        <Panel glass className="mt-8 border-[var(--proposal-accent)]/25 p-8 md:p-10">
          <Label className="text-[var(--proposal-accent)]">How HostOS answers it</Label>
          <p className="mt-4 text-pretty text-[16.5px] leading-relaxed text-foreground/90">{summary.answer}</p>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------------- 3. outcomes */

function Outcomes({ doc }: { doc: ProposalDoc }) {
  const [open, setOpen] = useState<string | null>(doc.outcomes[0]?.id ?? null);
  return (
    <Section
      id="outcomes"
      eyebrow="Why companies choose HostOS"
      title="Not features."
      aside="Outcomes."
      lede="Each of these is a result we are accountable for, with the problem it solves, what it replaces, and what it returns."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {doc.outcomes.map((o, i) => {
          const isOpen = open === o.id;
          return (
            <Reveal key={o.id} delay={(i % 2) * 0.04}>
              <Panel interactive className="h-full overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : o.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-4 p-6 text-left"
                >
                  <span>
                    <Label>{String(i + 1).padStart(2, "0")}</Label>
                    <span className="mt-2 block text-[17px] font-semibold tracking-tight">{o.name}</span>
                    <span className="mt-2 block text-[13.5px] leading-relaxed text-muted-foreground">{o.problem}</span>
                  </span>
                  <span className={cn("mt-1 shrink-0 rounded-full border border-border p-1.5 transition-transform duration-300", isOpen && "rotate-45 border-[var(--proposal-accent)] text-[var(--proposal-accent)]")}>
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="space-y-4 border-t border-border px-6 py-5">
                      <Row label="Current process" value={o.current} />
                      <Row label="HostOS solution" value={o.solution} accent />
                      <Row label="Business impact" value={o.impact} />
                      <div className="rounded-xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-3.5">
                        <Label className="text-[var(--proposal-accent)]">Expected ROI</Label>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/85">{o.roi}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <Label className={accent ? "text-[var(--proposal-accent)]" : undefined}>{label}</Label>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------- 4. product tour */

function ProductTour({ doc }: { doc: ProposalDoc }) {
  const [active, setActive] = useState(0);
  const module = doc.tour[active] ?? doc.tour[0];
  if (!module) return null;

  return (
    <Section
      id="tour"
      eyebrow="Interactive product tour"
      title="The software your team"
      aside="and ours work from."
      lede="Every screen below is a module of HostOS. Pick one to see what it does, what it replaces, and what it gives back."
      tone="surface"
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Product modules" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {doc.tour.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active}
                className={cn(
                  "shrink-0 rounded-xl px-4 py-2.5 text-left text-[13.5px] font-medium transition-colors lg:w-full",
                  i === active
                    ? "bg-[var(--proposal-accent)]/10 text-[var(--proposal-accent)] ring-1 ring-[var(--proposal-accent)]/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {m.name}
              </button>
            ))}
          </nav>
        </Reveal>

        <Reveal key={module.id}>
          <Panel className="overflow-hidden">
            <Media image={module.image} video={module.video} label={`${module.name} — HostOS`} aspect="wide" className="rounded-none border-0 border-b border-border" />
            <div className="p-7 md:p-9">
              <Label>{module.line}</Label>
              <h3 className="mt-2 text-[26px] font-bold tracking-tight md:text-[32px]">{module.name}</h3>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{module.how}</p>

              <div className="mt-7">
                <BeforeAfter before={module.before} after={module.after} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-6 border-t border-border pt-6">
                <div>
                  <Label>Time saved</Label>
                  <p className="mt-1 text-[18px] font-bold tracking-tight text-[var(--proposal-accent)]">{module.timeSaved}</p>
                </div>
                <div>
                  <Label>Cost saved</Label>
                  <p className="mt-1 text-[18px] font-bold tracking-tight text-[var(--proposal-accent)]">{module.costSaved}</p>
                </div>
                {module.demoHref && (
                  <Button asChild variant="secondary" className="ml-auto">
                    <a href={module.demoHref}>
                      See it live <ArrowRight />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------- 5. industries */

function Industries({ doc }: { doc: ProposalDoc }) {
  const [open, setOpen] = useState<string | null>(doc.industries[0]?.id ?? null);
  return (
    <Section
      id="industries"
      eyebrow="Industry solutions"
      title="We already know"
      aside="your operation."
      lede="The problems below are the ones we are hired for, by businesses that look like yours."
    >
      <div className="space-y-3">
        {doc.industries.map((ind, i) => {
          const isOpen = open === ind.id;
          return (
            <Reveal key={ind.id} delay={Math.min(i, 5) * 0.03}>
              <Panel className={cn("overflow-hidden", isOpen && "border-[var(--proposal-accent)]/35")}>
                <button type="button" onClick={() => setOpen(isOpen ? null : ind.id)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 p-6 text-left">
                  <span className="min-w-0">
                    <span className="block text-[19px] font-semibold tracking-tight">{ind.name}</span>
                    <span className="mt-1 block truncate text-[13.5px] text-muted-foreground">{ind.line}</span>
                  </span>
                  <ChevronDown className={cn("h-4.5 w-4.5 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180 text-[var(--proposal-accent)]")} />
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-1 gap-6 border-t border-border p-6 md:grid-cols-2 lg:grid-cols-4">
                      <Bullets label="Problems" items={ind.problems} tone="danger" />
                      <Bullets label="Our solutions" items={ind.solutions} tone="accent" />
                      <Bullets label="Automation examples" items={ind.automations} />
                      <Bullets label="VA support" items={ind.va} />
                      <div className="md:col-span-2 lg:col-span-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border bg-surface p-4">
                            <Label>Reporting</Label>
                            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{ind.reporting}</p>
                          </div>
                          <div className="rounded-xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-4">
                            <Label className="text-[var(--proposal-accent)]">ROI</Label>
                            <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/85">{ind.roi}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

function Bullets({ label, items, tone = "muted" }: { label: string; items: string[]; tone?: "muted" | "accent" | "danger" }) {
  return (
    <div>
      <Label className={tone === "accent" ? "text-[var(--proposal-accent)]" : tone === "danger" ? "text-danger" : undefined}>{label}</Label>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <span
              aria-hidden
              className={cn("mt-[7px] h-1 w-1 shrink-0 rounded-full", tone === "accent" ? "bg-[var(--proposal-accent)]" : tone === "danger" ? "bg-danger" : "bg-border-strong")}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- 6. AI automations */

function Automations({ doc }: { doc: ProposalDoc }) {
  return (
    <Section
      id="automations"
      eyebrow="AI automations"
      title="Trigger, then"
      aside="it runs itself."
      lede="Each of these is live software, not a diagram. A person approves anything that carries risk."
      tone="ink"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {doc.automations.map((a, i) => (
          <Reveal key={a.id} delay={(i % 2) * 0.04}>
            <div className="h-full rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition-colors duration-300 hover:border-[var(--proposal-accent)]/45">
              <h3 className="text-[17px] font-semibold tracking-tight text-white">{a.name}</h3>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                <Label className="text-[var(--proposal-accent)]">Trigger</Label>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{a.trigger}</p>
              </div>

              <ol className="mt-4 space-y-2.5 border-l border-dashed border-white/15 pl-5">
                {a.steps.map((s, j) => (
                  <li key={s} className="relative text-[13px] leading-relaxed text-white/70">
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-[5px] grid h-4 w-4 place-items-center rounded-full border border-[var(--proposal-accent)]/40 bg-[#0b0d14] font-mono text-[8px] font-bold text-[var(--proposal-accent)]"
                    >
                      {j + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>

              <div className="mt-5 rounded-xl border border-[var(--proposal-accent)]/30 bg-[var(--proposal-accent)]/[0.1] p-3.5">
                <Label className="text-[var(--proposal-accent)]">Outcome</Label>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">{a.outcome}</p>
              </div>

              <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/45">Saves {a.saves}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------- 7. human operations */

function HumanOps({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="people" eyebrow="Human operations" title="AI drafts." aside="A person decides." lede={doc.humanOps.lede}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {doc.humanOps.roles.map((r, i) => (
          <Reveal key={r.name} delay={Math.min(i, 5) * 0.03}>
            <Panel interactive className="h-full p-5">
              <h3 className="text-[14.5px] font-semibold tracking-tight">{r.name}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{r.body}</p>
            </Panel>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1}>
        <Panel glass className="mt-8 border-[var(--proposal-accent)]/25 p-8 md:p-10">
          <Label className="text-[var(--proposal-accent)]">Why both, and not one or the other</Label>
          <p className="mt-4 max-w-4xl text-pretty text-[16.5px] leading-relaxed text-foreground/90">{doc.humanOps.why}</p>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* -------------------------------------------------------- 8. software development */

function Software({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="software" eyebrow="Software development" title="We run our own company" aside="on what we sell you." lede={doc.software.lede} tone="surface">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {doc.software.capabilities.map((c, i) => (
          <Reveal key={c.name} delay={Math.min(i, 5) * 0.03}>
            <Panel interactive className="h-full p-5">
              <h3 className="text-[14.5px] font-semibold tracking-tight">{c.name}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
            </Panel>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1}>
        <div className="mt-10">
          <Label className="text-center">The stack it is built on</Label>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {doc.software.stack.map((s) => (
              <li key={s} className="rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-[11.5px] text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------ 9. case studies */

function CaseStudies({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="cases" eyebrow="Live case studies" title="Real results." aside="Real businesses." lede="Some client partnerships remain confidential under NDA; the figures below are from operations we run.">
      <div className="space-y-6">
        {doc.caseStudies.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.05}>
            <Panel className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <Media image={c.image} video={c.video} label={`${c.client} — walkthrough`} className="rounded-none border-0 lg:h-full lg:border-r lg:border-border" />
                <div className="p-7 md:p-9">
                  <Label>{c.industry}</Label>
                  <h3 className="mt-2 text-[22px] font-bold tracking-tight md:text-[26px]">{c.client}</h3>

                  <div className="mt-6 space-y-5">
                    <div>
                      <Label className="text-danger">The challenge</Label>
                      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{c.challenge}</p>
                    </div>
                    <div>
                      <Label className="text-[var(--proposal-accent)]">What we implemented</Label>
                      <ul className="mt-2 space-y-1.5">
                        {c.implementation.map((step) => (
                          <li key={step} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-muted-foreground">
                            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--proposal-accent)]" strokeWidth={2.5} />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-4 border-t border-border pt-6">
                    {c.results.map((r) => (
                      <Figure key={r.label} value={r.value} label={r.label} />
                    ))}
                  </div>

                  <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-3">
                    <Stat label="Hours saved" value={c.hoursSaved} />
                    <Stat label="Revenue impact" value={c.revenue} />
                    <Stat label="Response" value={c.response} />
                    <Stat label="Automations" value={c.automations} />
                    <Stat label="Timeline" value={c.timeline} />
                    <Stat label="ROI" value={c.roi} />
                  </dl>
                </div>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>
        <Label>{label}</Label>
      </dt>
      <dd className="mt-1 text-[13px] font-medium leading-snug">{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- 10. gallery */

function Gallery({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="gallery" eyebrow="Demo gallery" title="Watch it" aside="actually run." lede="Short recordings of the system in operation — no slides, no mock-ups." tone="surface">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {doc.gallery.map((g, i) => (
          <Reveal key={g.id} delay={(i % 3) * 0.04}>
            <Panel interactive className="h-full overflow-hidden">
              <Media image={g.thumb} video={g.video} label={g.name} duration={g.duration} className="rounded-none border-0 border-b border-border" />
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-semibold tracking-tight">{g.name}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{g.body}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">{g.duration}</span>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------- 11. before / after */

function BeforeAfterSection({ doc }: { doc: ProposalDoc }) {
  const [side, setSide] = useState<"before" | "after">("after");
  const rows = Math.max(doc.beforeAfter.before.length, doc.beforeAfter.after.length);

  return (
    <Section id="before-after" eyebrow="Before and after" title="The same business," aside="two ways of running it." align="center">
      {/* phones get a toggle; from md the two columns sit side by side */}
      <div className="mb-8 flex justify-center md:hidden">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {(["before", "after"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "rounded-full px-5 py-1.5 text-[13px] font-medium capitalize transition-colors",
                side === s ? "bg-[var(--proposal-accent)] text-white" : "text-muted-foreground"
              )}
            >
              {s === "before" ? "Without HostOS" : "With HostOS"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Reveal className={cn(side === "before" ? "block" : "hidden", "md:block")}>
          <Panel className="h-full border-danger/25 bg-danger/[0.03] p-7">
            <Label className="text-danger">Without HostOS</Label>
            <ul className="mt-5 space-y-3.5">
              {doc.beforeAfter.before.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-muted-foreground">
                  <Minus className="mt-[5px] h-3.5 w-3.5 shrink-0 text-danger" strokeWidth={2.5} />
                  {b}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
        <Reveal delay={0.06} className={cn(side === "after" ? "block" : "hidden", "md:block")}>
          <Panel className="h-full border-[var(--proposal-accent)]/30 bg-[var(--proposal-accent)]/[0.05] p-7">
            <Label className="text-[var(--proposal-accent)]">With HostOS</Label>
            <ul className="mt-5 space-y-3.5">
              {doc.beforeAfter.after.map((a, i) => (
                <li key={a} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-foreground/85">
                  <Check className="mt-[4px] h-3.5 w-3.5 shrink-0 text-[var(--proposal-accent)]" strokeWidth={2.5} />
                  {a}
                  {/* the two lists are read as pairs; an empty slot keeps them aligned */}
                  {i >= rows ? null : null}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- 12. roadmap */

function Roadmap({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="roadmap" eyebrow="Implementation roadmap" title="Live within" aside="thirty days." lede="Four weeks from first call to us running the operation — then continuous improvement." tone="surface">
      <div className="relative">
        <span aria-hidden className="absolute left-[19px] top-2 hidden h-[calc(100%-16px)] w-px bg-border md:block" />
        <div className="space-y-5">
          {doc.roadmap.map((step, i) => (
            <Reveal key={step.week} delay={i * 0.05}>
              <div className="md:pl-14">
                <span
                  aria-hidden
                  className="absolute left-0 hidden h-10 w-10 place-items-center rounded-full border border-[var(--proposal-accent)]/30 bg-card font-mono text-[12px] font-bold text-[var(--proposal-accent)] md:grid"
                >
                  {i + 1}
                </span>
                <Panel interactive className="p-6 md:p-7">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <Label className="text-[var(--proposal-accent)]">{step.week}</Label>
                    <h3 className="text-[19px] font-semibold tracking-tight">{step.name}</h3>
                  </div>
                  <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {step.deliverables.map((d) => (
                      <li key={d} className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-muted-foreground">
                        {d}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- 13. pricing */

function Pricing({ doc }: { doc: ProposalDoc }) {
  const [compare, setCompare] = useState(false);
  const { tiers } = doc.pricing;

  const comparisonRows: { label: string; key: keyof (typeof tiers)[number] }[] = [
    { label: "Dedicated VA hours", key: "vaHours" },
    { label: "AI automations", key: "automations" },
    { label: "Custom development", key: "devHours" },
    { label: "Reporting", key: "reporting" },
    { label: "Meetings", key: "meetings" },
    { label: "Support", key: "support" },
    { label: "Response SLA", key: "sla" },
    { label: "Expected ROI", key: "roi" },
  ];

  return (
    <Section id="pricing" eyebrow="Investment" title="Clear prices." aside="No surprises." lede={doc.pricing.lede} align="center">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((t, i) => (
          <Reveal key={t.id} delay={i * 0.05}>
            <Panel
              className={cn(
                "relative flex h-full flex-col p-7",
                t.featured && "border-[var(--proposal-accent)]/45 shadow-[var(--shadow-elevated)]"
              )}
            >
              {t.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-[var(--proposal-accent)] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">
                  Most chosen
                </span>
              )}
              <h3 className="text-[20px] font-bold tracking-tight">{t.name}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t.forWho}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="font-mono text-[34px] font-bold tracking-tight text-[var(--proposal-accent)]">{t.price}</span>
                {t.period && <span className="text-[14px] text-muted-foreground">{t.period}</span>}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t.note}</p>

              <ul className="mt-6 space-y-2">
                {t.included.map((inc) => (
                  <li key={inc} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-foreground/85">
                    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--proposal-accent)]" strokeWidth={2.5} />
                    {inc}
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2 border-t border-border pt-5">
                <MiniRow label="SLA" value={t.sla} />
                <MiniRow label="Support" value={t.support} />
                <MiniRow label="Reviews" value={t.meetings} />
              </div>

              <div className="mt-auto pt-6">
                <Button asChild variant={t.featured ? "gradient" : "secondary"} className="w-full">
                  <a href="#start">
                    {t.price.toLowerCase().startsWith("custom") ? "Request a quote" : "Start with " + t.name} <ArrowRight />
                  </a>
                </Button>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            aria-expanded={compare}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[13.5px] font-medium transition-colors hover:border-[var(--proposal-accent)]/45"
          >
            {compare ? "Hide" : "Compare"} every tier side by side
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", compare && "rotate-180")} />
          </button>
        </div>
      </Reveal>

      <div className={cn("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", compare ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-4 pr-4 text-[13px] font-semibold">
                    What you get
                  </th>
                  {tiers.map((t) => (
                    <th key={t.id} scope="col" className="px-4 py-4 text-[13px] font-semibold">
                      {t.name}
                      <span className="mt-1 block font-mono text-[12px] font-bold text-[var(--proposal-accent)]">
                        {t.price}
                        {t.period}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <th scope="row" className="py-4 pr-4 align-top">
                      <Label>{row.label}</Label>
                    </th>
                    {tiers.map((t) => (
                      <td key={t.id} className="px-4 py-4 align-top text-[13px] leading-relaxed text-muted-foreground">
                        {String(t[row.key] ?? "—") || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Reveal delay={0.1}>
        <p className="mx-auto mt-10 max-w-3xl text-center text-[13.5px] leading-relaxed text-muted-foreground">{doc.pricing.footnote}</p>
      </Reveal>
    </Section>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label>{label}</Label>
      <span className="text-right text-[12.5px] text-muted-foreground">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------ 14. philosophy */

function Philosophy({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="why" eyebrow="Our philosophy" title="We don’t sell labor." aside="We build systems." lede={doc.philosophy.body} tone="ink">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {doc.philosophy.points.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.04}>
            <div className="h-full rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <span className="font-mono text-[11px] font-semibold text-[var(--proposal-accent)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-white">{p.name}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/65">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ 15. FAQ */

function Faq({ doc }: { doc: ProposalDoc }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" eyebrow="Questions we are always asked" title="Straight" aside="answers." align="center">
      <div className="mx-auto max-w-3xl space-y-3">
        {doc.faq.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={Math.min(i, 6) * 0.03}>
              <Panel className={cn("overflow-hidden", isOpen && "border-[var(--proposal-accent)]/35")}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                  <span className="text-[15.5px] font-semibold tracking-tight">{f.q}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180 text-[var(--proposal-accent)]")} />
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <p className="border-t border-border px-5 py-4 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
                  </div>
                </div>
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- 16. final CTA */

function FinalCta({ doc }: { doc: ProposalDoc }) {
  return (
    <Section id="start" tone="surface">
      <Reveal>
        <Panel glass className="relative overflow-hidden border-[var(--proposal-accent)]/25 px-8 py-16 text-center md:px-16 md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage: "radial-gradient(60% 70% at 50% 0%, color-mix(in oklab, var(--proposal-accent) 16%, transparent), transparent 70%)",
            }}
          />
          <h2 className="headline mx-auto max-w-3xl text-balance text-[32px] leading-[1.06] md:text-[52px]">{doc.finalCta.title}</h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-[16.5px] leading-relaxed text-muted-foreground">{doc.finalCta.body}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="xl">
              <a href="https://hostoscollective.com/#contact" target="_blank" rel="noreferrer">
                Schedule strategy call <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <a href={`mailto:hello@hostoscollective.com?subject=${encodeURIComponent(`Operations partnership — ${doc.client.company || "HostOS"}`)}`}>Reply to this proposal</a>
            </Button>
          </div>
          <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Free 45-minute call · No obligation · Leave with a practical plan</p>
        </Panel>
      </Reveal>
    </Section>
  );
}
