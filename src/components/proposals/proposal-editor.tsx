"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, History, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label as FieldLabel } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { restoreProposalVersion, saveProposal } from "@/lib/actions/proposals";
import type { ProposalDoc } from "@/lib/proposals/types";

/**
 * The proposal editor.
 *
 * Every field a proposal needs to be re-pitched for a different client:
 * who it is for and what branding it wears, the hero, the pricing, the case
 * studies, and the internal notes. Anything left alone keeps the house copy.
 *
 * Saving keeps the previous version first, so a save can always be undone.
 */
export function ProposalEditor({
  id,
  title,
  notes,
  doc,
  versions,
}: {
  id: string;
  title: string;
  notes: string;
  doc: ProposalDoc;
  versions: { version: number; savedBy: string | null; savedAt: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [meta, setMeta] = useState({ title, notes });
  const [draft, setDraft] = useState<ProposalDoc>(doc);

  const patchClient = (k: keyof ProposalDoc["client"], v: string) => setDraft((d) => ({ ...d, client: { ...d.client, [k]: v } }));
  const patchHero = (k: keyof ProposalDoc["hero"], v: string) => setDraft((d) => ({ ...d, hero: { ...d.hero, [k]: v } }));

  const patchTier = (index: number, k: string, v: string | boolean) =>
    setDraft((d) => ({
      ...d,
      pricing: { ...d.pricing, tiers: d.pricing.tiers.map((t, i) => (i === index ? { ...t, [k]: v } : t)) },
    }));

  const patchCase = (index: number, k: string, v: string) =>
    setDraft((d) => ({ ...d, caseStudies: d.caseStudies.map((c, i) => (i === index ? { ...c, [k]: v } : c)) }));

  const patchGallery = (index: number, k: string, v: string) =>
    setDraft((d) => ({ ...d, gallery: d.gallery.map((g, i) => (i === index ? { ...g, [k]: v } : g)) }));

  const patchTour = (index: number, k: string, v: string) =>
    setDraft((d) => ({ ...d, tour: d.tour.map((t, i) => (i === index ? { ...t, [k]: v } : t)) }));

  const save = () =>
    start(async () => {
      const result = await saveProposal(id, draft, meta);
      if (result.ok) {
        toast.success("Proposal saved. The previous version is kept.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not save.");
      }
    });

  const restore = (version: number) =>
    start(async () => {
      const result = await restoreProposalVersion(id, version);
      if (result.ok) {
        toast.success(`Restored version ${version}.`);
        router.refresh();
        router.push(`/app/proposals/${id}`);
      } else {
        toast.error(result.error ?? "Could not restore.");
      }
    });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/proposals/${id}`}>
            <ArrowLeft /> Back to proposal
          </Link>
        </Button>
        <span className="flex-1" />
        <Button variant="primary" onClick={save} loading={pending}>
          <Save /> Save proposal
        </Button>
      </div>

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">Client &amp; branding</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="cases">Case studies</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="notes">Notes &amp; versions</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ client & branding */}
        <TabsContent value="client">
          <Card title="Who this proposal is for" body="The cover, the accent colour and the client logo. The accent re-tints every section.">
            <Grid>
              <Field label="Proposal title">
                <Input value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} />
              </Field>
              <Field label="Client company">
                <Input value={draft.client.company} onChange={(e) => patchClient("company", e.target.value)} />
              </Field>
              <Field label="Contact name">
                <Input value={draft.client.contact} onChange={(e) => patchClient("contact", e.target.value)} />
              </Field>
              <Field label="Contact email">
                <Input type="email" value={draft.client.email} onChange={(e) => patchClient("email", e.target.value)} />
              </Field>
              <Field label="Industry">
                <Input value={draft.client.industry} onChange={(e) => patchClient("industry", e.target.value)} />
              </Field>
              <Field label="Client logo URL" hint="https:// — shown beside our mark on the cover">
                <Input value={draft.client.logoUrl} onChange={(e) => patchClient("logoUrl", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Accent colour" hint="Re-tints the whole proposal">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(draft.client.accent) ? draft.client.accent : "#5B7CFF"}
                    onChange={(e) => patchClient("accent", e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-card p-1"
                    aria-label="Accent colour"
                  />
                  <Input value={draft.client.accent} onChange={(e) => patchClient("accent", e.target.value)} className="font-mono" />
                </div>
              </Field>
            </Grid>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------ hero */}
        <TabsContent value="hero">
          <Card title="The opening" body="The first ten seconds. Keep the promise concrete.">
            <Grid>
              <Field label="Eyebrow">
                <Input value={draft.hero.eyebrow} onChange={(e) => patchHero("eyebrow", e.target.value)} />
              </Field>
              <Field label="Headline, first line">
                <Input value={draft.hero.line1} onChange={(e) => patchHero("line1", e.target.value)} />
              </Field>
              <Field label="Headline, second line" hint="Set in the serif italic">
                <Input value={draft.hero.line2} onChange={(e) => patchHero("line2", e.target.value)} />
              </Field>
            </Grid>
            <Field label="Opening paragraph" className="mt-5">
              <Textarea rows={4} value={draft.hero.body} onChange={(e) => patchHero("body", e.target.value)} />
            </Field>
            <div className="mt-6">
              <FieldLabel>Figures under the ask</FieldLabel>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {draft.hero.figures.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      className="w-28 font-mono"
                      value={f.value}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, hero: { ...d.hero, figures: d.hero.figures.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) } }))
                      }
                    />
                    <Input
                      value={f.label}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, hero: { ...d.hero, figures: d.hero.figures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------- pricing */}
        <TabsContent value="pricing">
          <Card title="Investment" body="Price this client on what the engagement is worth to them, not on a rate card.">
            <Field label="Pricing lede">
              <Textarea rows={3} value={draft.pricing.lede} onChange={(e) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, lede: e.target.value } }))} />
            </Field>
            <div className="mt-6 space-y-5">
              {draft.pricing.tiers.map((t, i) => (
                <div key={t.id} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[14.5px] font-semibold tracking-tight">{t.name}</h3>
                    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <input type="checkbox" checked={t.featured} onChange={(e) => patchTier(i, "featured", e.target.checked)} className="h-4 w-4 accent-accent" />
                      Highlight this tier
                    </label>
                  </div>
                  <Grid className="mt-4">
                    <Field label="Name">
                      <Input value={t.name} onChange={(e) => patchTier(i, "name", e.target.value)} />
                    </Field>
                    <Field label="For who">
                      <Input value={t.forWho} onChange={(e) => patchTier(i, "forWho", e.target.value)} />
                    </Field>
                    <Field label="Price">
                      <Input className="font-mono" value={t.price} onChange={(e) => patchTier(i, "price", e.target.value)} />
                    </Field>
                    <Field label="Period">
                      <Input value={t.period} onChange={(e) => patchTier(i, "period", e.target.value)} placeholder="/mo" />
                    </Field>
                    <Field label="VA hours">
                      <Input value={t.vaHours} onChange={(e) => patchTier(i, "vaHours", e.target.value)} />
                    </Field>
                    <Field label="Automations">
                      <Input value={t.automations} onChange={(e) => patchTier(i, "automations", e.target.value)} />
                    </Field>
                    <Field label="Custom development">
                      <Input value={t.devHours} onChange={(e) => patchTier(i, "devHours", e.target.value)} />
                    </Field>
                    <Field label="Response SLA">
                      <Input value={t.sla} onChange={(e) => patchTier(i, "sla", e.target.value)} />
                    </Field>
                    <Field label="Reporting">
                      <Input value={t.reporting} onChange={(e) => patchTier(i, "reporting", e.target.value)} />
                    </Field>
                    <Field label="Meetings">
                      <Input value={t.meetings} onChange={(e) => patchTier(i, "meetings", e.target.value)} />
                    </Field>
                    <Field label="Support">
                      <Input value={t.support} onChange={(e) => patchTier(i, "support", e.target.value)} />
                    </Field>
                    <Field label="Expected ROI">
                      <Input value={t.roi} onChange={(e) => patchTier(i, "roi", e.target.value)} />
                    </Field>
                  </Grid>
                  <Field label="Note under the price" className="mt-4">
                    <Input value={t.note} onChange={(e) => patchTier(i, "note", e.target.value)} />
                  </Field>
                  <Field label="What is included" hint="One per line" className="mt-4">
                    <Textarea
                      rows={5}
                      value={t.included.join("\n")}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          pricing: {
                            ...d.pricing,
                            tiers: d.pricing.tiers.map((x, j) => (j === i ? { ...x, included: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } : x)),
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
            <Field label="Footnote" className="mt-6">
              <Textarea rows={3} value={draft.pricing.footnote} onChange={(e) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, footnote: e.target.value } }))} />
            </Field>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------- case studies */}
        <TabsContent value="cases">
          <Card title="Live case studies" body="Only what we can stand behind. A figure here should survive the question ‘how do you know?’.">
            <div className="space-y-5">
              {draft.caseStudies.map((c, i) => (
                <div key={c.id} className="rounded-2xl border border-border bg-surface p-5">
                  <Grid>
                    <Field label="Client">
                      <Input value={c.client} onChange={(e) => patchCase(i, "client", e.target.value)} />
                    </Field>
                    <Field label="Industry">
                      <Input value={c.industry} onChange={(e) => patchCase(i, "industry", e.target.value)} />
                    </Field>
                    <Field label="Hours saved">
                      <Input value={c.hoursSaved} onChange={(e) => patchCase(i, "hoursSaved", e.target.value)} />
                    </Field>
                    <Field label="Revenue impact">
                      <Input value={c.revenue} onChange={(e) => patchCase(i, "revenue", e.target.value)} />
                    </Field>
                    <Field label="Response improvement">
                      <Input value={c.response} onChange={(e) => patchCase(i, "response", e.target.value)} />
                    </Field>
                    <Field label="Automations created">
                      <Input value={c.automations} onChange={(e) => patchCase(i, "automations", e.target.value)} />
                    </Field>
                    <Field label="Timeline">
                      <Input value={c.timeline} onChange={(e) => patchCase(i, "timeline", e.target.value)} />
                    </Field>
                    <Field label="ROI">
                      <Input value={c.roi} onChange={(e) => patchCase(i, "roi", e.target.value)} />
                    </Field>
                    <Field label="Screenshot URL">
                      <Input value={c.image} onChange={(e) => patchCase(i, "image", e.target.value)} placeholder="https://…" />
                    </Field>
                    <Field label="Video URL">
                      <Input value={c.video} onChange={(e) => patchCase(i, "video", e.target.value)} placeholder="https://…" />
                    </Field>
                  </Grid>
                  <Field label="The challenge" className="mt-4">
                    <Textarea rows={3} value={c.challenge} onChange={(e) => patchCase(i, "challenge", e.target.value)} />
                  </Field>
                  <Field label="What we implemented" hint="One per line" className="mt-4">
                    <Textarea
                      rows={5}
                      value={c.implementation.join("\n")}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          caseStudies: d.caseStudies.map((x, j) =>
                            j === i ? { ...x, implementation: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } : x
                          ),
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------ media */}
        <TabsContent value="media">
          <Card title="Screenshots and recordings" body="Paste an https URL for any capture. Anything left empty keeps its framed placeholder.">
            <h3 className="mb-3 text-[13px] font-semibold tracking-tight">Product tour</h3>
            <div className="space-y-3">
              {draft.tour.map((t, i) => (
                <div key={t.id} className="grid gap-2 sm:grid-cols-[140px_1fr_1fr]">
                  <span className="self-center text-[13px] font-medium">{t.name}</span>
                  <Input value={t.image} onChange={(e) => patchTour(i, "image", e.target.value)} placeholder="Screenshot URL" />
                  <Input value={t.video} onChange={(e) => patchTour(i, "video", e.target.value)} placeholder="Video URL" />
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-8 text-[13px] font-semibold tracking-tight">Demo gallery</h3>
            <div className="space-y-3">
              {draft.gallery.map((g, i) => (
                <div key={g.id} className="grid gap-2 sm:grid-cols-[140px_90px_1fr_1fr]">
                  <span className="self-center text-[13px] font-medium">{g.name}</span>
                  <Input className="font-mono" value={g.duration} onChange={(e) => patchGallery(i, "duration", e.target.value)} placeholder="3:20" />
                  <Input value={g.thumb} onChange={(e) => patchGallery(i, "thumb", e.target.value)} placeholder="Thumbnail URL" />
                  <Input value={g.video} onChange={(e) => patchGallery(i, "video", e.target.value)} placeholder="Video URL" />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- notes & versions */}
        <TabsContent value="notes">
          <Card title="Internal notes" body="Never rendered in the client's view — deal context, objections, what was promised on the call.">
            <Textarea rows={8} value={meta.notes} onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))} placeholder="What we learned on the discovery call…" />
          </Card>

          <Card title="Version history" body="Every save keeps what it replaced. Restoring writes a new version, so nothing is ever lost." className="mt-5">
            {versions.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">No earlier versions yet.</p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
                    <span className="text-[13.5px]">
                      <span className="font-mono font-semibold">v{v.version}</span>
                      <span className="ml-3 text-muted-foreground">
                        {new Date(v.savedAt).toLocaleString()}
                        {v.savedBy ? ` · ${v.savedBy}` : ""}
                      </span>
                    </span>
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => restore(v.version)}>
                      <History /> Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-end">
        <Button variant="primary" size="lg" onClick={save} loading={pending}>
          <Save /> Save proposal
        </Button>
      </div>
    </div>
  );
}

function Card({ title, body, children, className }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border bg-card p-6 md:p-7 ${className ?? ""}`}>
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${className ?? ""}`}>{children}</div>;
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
