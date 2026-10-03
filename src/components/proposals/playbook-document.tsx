"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { CLOSING_LINES, POSITIONING, PRICING_RULES } from "@/lib/proposals/playbook";
import { CALL_ARC, CHEAT_SHEET, DISCOVERY, DRILLS, OBJECTIONS } from "@/lib/proposals/sales-skills";
import type { ProposalDoc } from "@/lib/proposals/types";

/**
 * The Pricing & Sales Handbook — a standalone training document, not a
 * proposal.
 *
 * The proposal tells a client what something costs. This teaches our team
 * why it costs that, how to run the conversation around it, and how to
 * practice until saying the number stops being uncomfortable.
 *
 * It is internal on every page, by design: anyone who picks up a stray
 * printout should know immediately that it is not a client document.
 */
export function PlaybookDocument({ doc, auto = false }: { doc: ProposalDoc; auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const go = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* fonts are a nicety; never block the dialog on them */
      }
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
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-danger">Internal · sales enablement</p>
          <h1 className="headline mt-4 text-[46px] leading-[1.04]">
            Pricing &amp; <em>sales handbook</em>
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
            How to run a pricing conversation, what every service is worth and why, what to say when the number lands,
            and how to practice until saying it stops being uncomfortable.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border pt-6 text-[12.5px] sm:grid-cols-4">
            <Meta label="For" value="Everyone who talks to clients" />
            <Meta label="Read before" value="Any pricing conversation" />
            <Meta label="Version" value={today} />
            <Meta label="Circulation" value="Internal — never send to a client" />
          </dl>

          <p className="mt-8 rounded-xl border border-danger/30 bg-danger/[0.05] px-4 py-3 text-[12.5px] leading-relaxed">
            <strong>This document contains our cost anchors, margins and objection handling.</strong> It is written for
            our own team. If a client needs pricing, send them the proposal or the share link — never this.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- contents */}
      <section className="print-page">
        <h2 className="text-[26px] font-bold tracking-tight">Contents</h2>
        <ol className="mt-8 space-y-3">
          {[
            ["01", "The six rules", "The whole argument in six lines"],
            ["02", "How a pricing call runs", "Six stages, forty-five minutes"],
            ["03", "Discovery questions", "What to ask so pricing is easy later"],
            ["04", "Service by service", "Anchor, frame, what to say, what loses it"],
            ["05", "The objection library", "Price and everything else"],
            ["06", "The three deciding moments", "Expensive · smaller · silence"],
            ["07", "Practice drills", "Skills do not come from reading"],
            ["08", "The rate card", "One page, every tier"],
            ["09", "Cheat sheet", "Keep this one on the desk"],
          ].map(([n, name, note]) => (
            <li key={n} className="flex items-baseline gap-4">
              <span className="w-8 shrink-0 font-mono text-[12px] text-muted-foreground">{n}</span>
              <span>
                <span className="text-[15px] font-medium">{name}</span>
                <span className="ml-3 text-[12.5px] text-muted-foreground">{note}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------ 01 six rules */}
      <Chapter n="01" title="The six rules" lede="If you remember nothing else from this document, remember these. Every other page is an elaboration of one of them.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRICING_RULES.map((r, i) => (
            <div key={r.name} className="break-inside-avoid rounded-2xl border border-border bg-surface p-5">
              <span className="font-mono text-[11px] font-semibold text-[var(--proposal-accent)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-[15.5px] font-semibold tracking-tight">{r.name}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Chapter>

      {/* ------------------------------------------------- 02 the call arc */}
      <Chapter n="02" title="How a pricing call runs" lede="Forty-five minutes, six stages. The price is stage five for a reason: everything before it is what makes the number reasonable.">
        <div className="space-y-4">
          {CALL_ARC.map((s) => (
            <article key={s.n} className="break-inside-avoid rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline gap-3 border-b border-border pb-3">
                <span className="font-mono text-[12px] font-bold text-[var(--proposal-accent)]">{s.n}</span>
                <h3 className="text-[17px] font-semibold tracking-tight">{s.name}</h3>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{s.minutes}</span>
              </div>

              <p className="mt-4 text-[13.5px] leading-relaxed">
                <Tag>Goal</Tag>
                {s.goal}
              </p>

              <ul className="mt-4 space-y-1.5">
                {s.does.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--proposal-accent)]" />
                    {d}
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-4">
                <Tag accent>Sounds like</Tag>
                <p className="mt-1.5 text-[13px] leading-relaxed">{s.sounds}</p>
              </div>

              <div className="mt-3 rounded-xl border border-danger/25 bg-danger/[0.04] p-4">
                <Tag danger>The usual mistake</Tag>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.mistake}</p>
              </div>
            </article>
          ))}
        </div>
      </Chapter>

      {/* -------------------------------------------------- 03 discovery */}
      <Chapter n="03" title="Discovery questions" lede="A hard pricing conversation is almost always a symptom of a lazy discovery. These are the questions that make the number easy to say later.">
        <div className="space-y-6">
          {DISCOVERY.map((g) => (
            <div key={g.group} className="break-inside-avoid">
              <h3 className="text-[15px] font-semibold tracking-tight">{g.group}</h3>
              <div className="mt-3 space-y-2.5">
                {g.questions.map((q) => (
                  <div key={q.ask} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-[14px] font-medium">{q.ask}</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      <Tag>Why</Tag>
                      {q.why}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Chapter>

      {/* ----------------------------------------- 04 service by service */}
      <Chapter n="04" title="Service by service" lede="For each service: what the client is silently comparing us to, the sentence to say before the number, the lines that work, what loses the deal, and the objection that price always attracts.">
        <div className="space-y-5">
          {POSITIONING.map((p) => (
            <article key={p.service} className="break-inside-avoid rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
                <h3 className="text-[17px] font-bold tracking-tight">{p.service}</h3>
                <span className="font-mono text-[15px] font-bold text-[var(--proposal-accent)]">{p.price}</span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-danger/25 bg-danger/[0.04] p-4">
                  <Tag danger>They are comparing us to</Tag>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{p.anchor}</p>
                </div>
                <div className="rounded-xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-4">
                  <Tag accent>Say this before the number</Tag>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{p.frame}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <Tag>Say</Tag>
                  <ul className="mt-2 space-y-2">
                    {p.say.map((s) => (
                      <li key={s} className="text-[12.5px] leading-relaxed">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Tag danger>Avoid</Tag>
                  <ul className="mt-2 space-y-2">
                    {p.avoid.map((s) => (
                      <li key={s} className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <Tag>The objection this always attracts</Tag>
                <p className="mt-1.5 text-[13px] font-semibold">{p.objection.q}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{p.objection.a}</p>
              </div>
            </article>
          ))}
        </div>
      </Chapter>

      {/* ------------------------------------------- 05 objection library */}
      <Chapter n="05" title="The objection library" lede="What they say, what it usually means, how to answer it, and the reflex to suppress. Price is only the first of them.">
        <div className="space-y-4">
          {OBJECTIONS.map((o) => (
            <article key={o.says} className="break-inside-avoid rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15.5px] font-semibold tracking-tight">{o.says}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <Tag>Usually means</Tag>
                {o.means}
              </p>
              <div className="mt-3 rounded-xl border border-[var(--proposal-accent)]/25 bg-[var(--proposal-accent)]/[0.06] p-4">
                <Tag accent>Answer</Tag>
                <p className="mt-1.5 text-[13px] leading-relaxed">{o.answer}</p>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-danger">
                <Tag danger>Never</Tag>
                <span className="text-muted-foreground">{o.never}</span>
              </p>
            </article>
          ))}
        </div>
      </Chapter>

      {/* -------------------------------------- 06 the deciding moments */}
      <Chapter n="06" title="The three moments that decide most deals" lede="Almost every deal we lose is lost in one of these three seconds.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CLOSING_LINES.map((c) => (
            <div key={c.name} className="break-inside-avoid rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-[14.5px] font-semibold tracking-tight">{c.name}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </Chapter>

      {/* ----------------------------------------------------- 07 drills */}
      <Chapter n="07" title="Practice drills" lede="Nobody gets comfortable saying a price by reading about it. Run these in pairs, fifteen minutes, before any week with pricing calls in it.">
        <div className="space-y-4">
          {DRILLS.map((d) => (
            <article key={d.name} className="break-inside-avoid rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[15.5px] font-semibold tracking-tight">{d.name}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <Tag>Setup</Tag>
                {d.setup}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed">
                <Tag>Run it</Tag>
                {d.run}
              </p>
              <div className="mt-3 rounded-xl border border-border bg-surface p-4">
                <Tag>What good looks like</Tag>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{d.looksLike}</p>
              </div>
            </article>
          ))}
        </div>
      </Chapter>

      {/* -------------------------------------------------- 08 rate card */}
      <Chapter n="08" title="The rate card" lede="Every tier on one page, with what to anchor it against. Prices are in USD and are the same for every client unless the Founder says otherwise.">
        <table className="w-full border-collapse text-left">
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
      </Chapter>

      {/* ------------------------------------------------ 09 cheat sheet */}
      <section className="print-page break-before-page">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">09 · Keep this one on the desk</p>
        <h2 className="headline mt-3 text-[34px] leading-[1.06]">
          The <em>cheat sheet</em>.
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHEAT_SHEET.map((c) => (
            <div key={c.heading} className="break-inside-avoid rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-[14.5px] font-semibold tracking-tight">{c.heading}</h3>
              <ul className="mt-3 space-y-2">
                {c.lines.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--proposal-accent)]" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-[12.5px] leading-relaxed text-muted-foreground">
          HostOS Collective — internal. Questions about a price, or a client who does not fit any tier, go to the
          Founder before the call, not after it.
        </p>
      </section>
    </div>
  );
}

function Chapter({ n, title, lede, children }: { n: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section className="proposal-section chapter break-before-page px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--proposal-accent)]">{n}</p>
        <h2 className="headline mt-3 text-[32px] leading-[1.06] md:text-[40px]">{title}</h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{lede}</p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Tag({ children, accent, danger }: { children: React.ReactNode; accent?: boolean; danger?: boolean }) {
  return (
    <span
      className={`mr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
        danger ? "text-danger" : accent ? "text-[var(--proposal-accent)]" : "text-muted-foreground"
      }`}
    >
      {children}
    </span>
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
