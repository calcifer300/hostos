"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { ProposalView } from "@/components/proposals/proposal-view";
import { CLOSING_LINES, POSITIONING, PRICING_RULES } from "@/lib/proposals/playbook";
import type { ProposalDoc } from "@/lib/proposals/types";

/**
 * The printable proposal: a cover, the contents, the sixteen sections, and —
 * for the internal edition only — the pricing positioning playbook.
 *
 * Saving as PDF is the browser's own Print dialog. That keeps the document
 * identical to what everyone already reviews on screen, with no second
 * rendering pipeline to drift out of step, and it works from any machine.
 *
 * `auto` opens the print dialog as soon as the fonts have settled, so the
 * "Download PDF" button is one click rather than a page plus a menu.
 */
export function PrintDocument({
  doc,
  title,
  edition,
  auto = false,
}: {
  doc: ProposalDoc;
  title: string;
  /** internal: includes the playbook. client: the proposal alone. */
  edition: "internal" | "client";
  auto?: boolean;
}) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const go = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* fonts are a nicety; never block the dialog on them */
      }
      // one frame for layout to settle after the fonts land
      await new Promise((r) => window.setTimeout(r, 400));
      if (!cancelled) window.print();
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [auto]);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-document">
      {/* ------------------------------------------------------------ cover */}
      <section className="print-page print-cover">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <span className="text-[26px] font-bold tracking-tight">
            host<span className="text-gradient">OS</span>
          </span>
        </div>

        <div className="mt-auto">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--proposal-accent)]">
            {edition === "internal" ? "Internal · sales enablement" : "Operations partnership proposal"}
          </p>
          <h1 className="headline mt-4 text-[44px] leading-[1.04]">
            {doc.hero.line1}
            <br />
            <em>{doc.hero.line2}</em>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{doc.hero.body}</p>

          <dl className="mt-10 grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border pt-6 text-[12.5px] sm:grid-cols-4">
            <Meta label="Prepared for" value={doc.client.company || "The HostOS team"} />
            <Meta label="Document" value={title} />
            <Meta label="Date" value={today} />
            <Meta label="Edition" value={edition === "internal" ? "Internal — do not send" : "Client"} />
          </dl>

          {edition === "internal" && (
            <p className="mt-8 rounded-xl border border-danger/30 bg-danger/[0.05] px-4 py-3 text-[12.5px] leading-relaxed">
              <strong>Internal document.</strong> Section 17 contains our pricing positioning, anchors and objection
              handling. Never send this edition to a client — use the client share link for that.
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- contents */}
      <section className="print-page">
        <h2 className="text-[24px] font-bold tracking-tight">Contents</h2>
        <ol className="mt-8 space-y-2.5">
          {[
            "Executive summary",
            "Why companies choose HostOS",
            "Interactive product tour",
            "Industry solutions",
            "AI automations",
            "Human operations",
            "Software development",
            "Live case studies",
            "Demo gallery",
            "Before and after",
            "Implementation roadmap",
            "Investment",
            "Our philosophy",
            "Questions we are always asked",
            "Next step",
            ...(edition === "internal" ? ["Pricing positioning playbook — internal"] : []),
          ].map((name, i) => (
            <li key={name} className="flex items-baseline gap-4 text-[14px]">
              <span className="w-8 shrink-0 font-mono text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className={i === 15 ? "font-semibold text-[var(--proposal-accent)]" : ""}>{name}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* the proposal itself, exactly as it renders on screen */}
      <ProposalView doc={doc} mode="client" />

      {/* ----------------------------------------- 17. the internal playbook */}
      {edition === "internal" && <Playbook doc={doc} />}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Playbook({ doc }: { doc: ProposalDoc }) {
  return (
    <section className="proposal-section print-playbook border-t-4 border-[var(--proposal-accent)] px-6 py-16">
      <div className="mx-auto w-full max-w-7xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">Internal only · not for clients</p>
        <h2 className="headline mt-3 text-[34px] leading-[1.06] md:text-[44px]">
          How to position <em>every price</em>.
        </h2>
        <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-muted-foreground">
          The pages before this tell a client what something costs. This page tells us why it costs that, what it is
          being compared to, and what to say when the number lands. Read it before any pricing conversation.
        </p>

        {/* the rules */}
        <div className="mt-12">
          <h3 className="text-[18px] font-bold tracking-tight">The six rules</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PRICING_RULES.map((r, i) => (
              <div key={r.name} className="rounded-2xl border border-border bg-surface p-5">
                <span className="font-mono text-[11px] font-semibold text-[var(--proposal-accent)]">{String(i + 1).padStart(2, "0")}</span>
                <h4 className="mt-2 text-[14.5px] font-semibold tracking-tight">{r.name}</h4>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* service by service */}
        <div className="mt-14">
          <h3 className="text-[18px] font-bold tracking-tight">Service by service</h3>
          <div className="mt-5 space-y-5">
            {POSITIONING.map((p) => (
              <article key={p.service} className="break-inside-avoid rounded-3xl border border-border bg-card p-6 md:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
                  <h4 className="text-[18px] font-bold tracking-tight">{p.service}</h4>
                  <span className="font-mono text-[16px] font-bold text-[var(--proposal-accent)]">{p.price}</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Block label="They are comparing us to" tone="danger">
                      {p.anchor}
                    </Block>
                    <Block label="The frame — say this before the number" tone="accent">
                      {p.frame}
                    </Block>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <BlockLabel>Say</BlockLabel>
                      <ul className="mt-2 space-y-2">
                        {p.say.map((s) => (
                          <li key={s} className="text-[12.5px] leading-relaxed text-foreground/85">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <BlockLabel className="text-danger">Avoid</BlockLabel>
                      <ul className="mt-2 space-y-2">
                        {p.avoid.map((s) => (
                          <li key={s} className="text-[12.5px] leading-relaxed text-muted-foreground">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-4">
                  <BlockLabel className="text-[var(--proposal-accent)]">The objection this always attracts</BlockLabel>
                  <p className="mt-2 text-[13px] font-semibold">{p.objection.q}</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{p.objection.a}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* the three that decide deals */}
        <div className="mt-14 break-inside-avoid">
          <h3 className="text-[18px] font-bold tracking-tight">The three moments that decide most deals</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {CLOSING_LINES.map((c) => (
              <div key={c.name} className="rounded-2xl border border-border bg-surface p-5">
                <h4 className="text-[14px] font-semibold tracking-tight">{c.name}</h4>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* the rate card, one table */}
        <div className="mt-14 break-inside-avoid">
          <h3 className="text-[18px] font-bold tracking-tight">The rate card, in one place</h3>
          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 text-[12px] font-semibold">Tier</th>
                <th className="px-4 py-3 text-[12px] font-semibold">Price</th>
                <th className="px-4 py-3 text-[12px] font-semibold">Coverage</th>
                <th className="px-4 py-3 text-[12px] font-semibold">SLA</th>
                <th className="px-4 py-3 text-[12px] font-semibold">Anchor against</th>
              </tr>
            </thead>
            <tbody>
              {doc.pricing.tiers.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 align-top text-[12.5px] font-semibold">{t.name}</td>
                  <td className="px-4 py-3 align-top font-mono text-[12.5px] font-bold text-[var(--proposal-accent)]">
                    {t.price}
                    {t.period}
                  </td>
                  <td className="px-4 py-3 align-top text-[12px] text-muted-foreground">{t.vaHours}</td>
                  <td className="px-4 py-3 align-top text-[12px] text-muted-foreground">{t.sla}</td>
                  <td className="px-4 py-3 align-top text-[12px] text-muted-foreground">{t.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">{doc.pricing.footnote}</p>
        </div>
      </div>
    </section>
  );
}

function BlockLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${className ?? ""}`}>
      {children}
    </span>
  );
}

function Block({ label, tone, children }: { label: string; tone: "danger" | "accent"; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "danger" ? "border-danger/25 bg-danger/[0.04]" : "border-border bg-surface"}`}>
      <BlockLabel className={tone === "danger" ? "text-danger" : "text-[var(--proposal-accent)]"}>{label}</BlockLabel>
      <p className="mt-2 text-[12.5px] leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}
