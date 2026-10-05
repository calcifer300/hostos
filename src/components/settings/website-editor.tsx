"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ExternalLink, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { restoreLandingIntro, saveLandingIntro, setLandingIntroEnabled, uploadSiteImage } from "@/lib/actions/site";
import { DEFAULT_INTRO, isIntroImageSrc, type IntroLayout, type IntroPanel, type LandingIntro } from "@/lib/site/intro";
import { cn } from "@/lib/utils";

const LAYOUTS: Record<IntroLayout, string> = { hero: "Opener — clock, stats, button", blueprint: "Blueprint — lines that move the marker", stack: "Stack — a ring of cards", readout: "Readout — tabs under a big figure" };

/**
 * The Founder's editor for the landing intro: the four systems, every word
 * and every photograph, the button, and the one switch that puts the
 * classic landing page back. Saves the whole thing at once; "Restore
 * defaults" drops the saved copy and the code's version shows again.
 */
export function WebsiteEditor({ intro: initial, fromDatabase }: { intro: LandingIntro; fromDatabase: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [intro, setIntro] = React.useState<LandingIntro>(initial);
  const [which, setWhich] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const panel = intro.panels[which];

  const patch = (next: Partial<LandingIntro>) => { setIntro((v) => ({ ...v, ...next })); setDirty(true); };
  const patchPanel = (next: Partial<IntroPanel>) => { setIntro((v) => ({ ...v, panels: v.panels.map((p, i) => (i === which ? { ...p, ...next } : p)) })); setDirty(true); };
  const patchItem = (j: number, next: Partial<IntroPanel["items"][number]>) => patchPanel({ items: panel.items.map((it, k) => (k === j ? { ...it, ...next } : it)) });
  const patchStat = (j: number, next: Partial<IntroPanel["stats"][number]>) => patchPanel({ stats: panel.stats.map((st, k) => (k === j ? { ...st, ...next } : st)) });

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success(done);
      setDirty(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold">Landing page intro</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Four full-screen systems ahead of the classic landing page — one per line of business. {fromDatabase ? "Showing your saved copy." : "Showing the built-in copy until you save."} Switch it off and the landing page is exactly as it was.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-[13px]"><Switch checked={intro.enabled} onCheckedChange={(v) => { patch({ enabled: v }); run(() => setLandingIntroEnabled(v), v ? "Intro is on" : "Intro is off — the classic landing page is back"); }} /> Show on the landing page</label>
            <Button asChild variant="ghost" size="sm"><Link href="/" target="_blank">View site <ExternalLink /></Link></Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("Drop your saved copy and go back to the built-in intro? Uploaded photographs that are no longer used are removed.")) run(async () => { const r = await restoreLandingIntro(); if (r.ok) { setIntro(DEFAULT_INTRO); setWhich(0); } return r; }, "Back to the built-in intro"); }}><RotateCcw /> Restore defaults</Button>
            <Button variant="primary" size="sm" loading={pending} disabled={!dirty && fromDatabase} onClick={() => run(() => saveLandingIntro(intro), "Saved — the landing page is updated")}>Save intro</Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="w-brand">Corner label</Label><Input id="w-brand" value={intro.brand} onChange={(e) => patch({ brand: e.target.value })} placeholder="COLLECTIVE //" /></div>
          <div className="space-y-1.5"><Label htmlFor="w-cta">Button</Label><Input id="w-cta" value={intro.ctaLabel} onChange={(e) => patch({ ctaLabel: e.target.value })} placeholder="Book a consultation" /></div>
          <div className="space-y-1.5"><Label htmlFor="w-href">Button link</Label><Input id="w-href" value={intro.ctaHref} onChange={(e) => patch({ ctaHref: e.target.value })} placeholder="/#contact" className="font-mono text-[12px]" /></div>
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-muted/50 p-1" role="tablist" aria-label="Systems">
        {intro.panels.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === which} onClick={() => setWhich(i)} className={cn("relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors", i === which ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {i === which && <motion.span layoutId="website-active" transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 -z-10 rounded-full bg-card shadow-[var(--shadow-card)]" />}
            <span className="font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span> {p.title} {p.accent}
          </button>
        ))}
      </div>

      {panel && (
        <Card padding="md">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-eyebrow">Eyebrow (the small line above the headline)</Label><Input id="p-eyebrow" value={panel.eyebrow} onChange={(e) => patchPanel({ eyebrow: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-title">Headline, first part</Label><Input id="p-title" value={panel.title} onChange={(e) => patchPanel({ title: e.target.value })} placeholder="FLEET //" /></div>
              <div className="space-y-1.5"><Label htmlFor="p-accent">Headline, coloured part</Label><Input id="p-accent" value={panel.accent} onChange={(e) => patchPanel({ accent: e.target.value })} placeholder="COMMAND" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-body">Paragraph</Label><Textarea id="p-body" rows={3} value={panel.body} onChange={(e) => patchPanel({ body: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-layout">Interaction</Label>
                <NativeSelect id="p-layout" value={panel.layout} onChange={(e) => patchPanel({ layout: e.target.value as IntroLayout })}>{(Object.keys(LAYOUTS) as IntroLayout[]).map((l) => <option key={l} value={l}>{LAYOUTS[l]}</option>)}</NativeSelect>
              </div>
              <div className="space-y-1.5"><Label htmlFor="p-caption">Caption under the photograph</Label><Input id="p-caption" value={panel.caption} onChange={(e) => patchPanel({ caption: e.target.value })} placeholder="FLEET // EVERY CAR ON ONE BOARD" /></div>
              <div className="space-y-1.5"><Label htmlFor="p-marker">Crosshair readout</Label><Input id="p-marker" value={panel.marker} onChange={(e) => patchPanel({ marker: e.target.value })} placeholder="CAR 07 // KEYS OUT 09:40" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="p-mx">Crosshair X %</Label><Input id="p-mx" type="number" min={0} max={100} value={panel.markerX} onChange={(e) => patchPanel({ markerX: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label htmlFor="p-my">Crosshair Y %</Label><Input id="p-my" type="number" min={0} max={100} value={panel.markerY} onChange={(e) => patchPanel({ markerY: Number(e.target.value) })} /></div>
              </div>

              {panel.layout === "hero" && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Three stats</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[0, 1, 2].map((j) => {
                      const st = panel.stats[j] ?? { label: "", value: "", unit: "" };
                      return (
                        <div key={j} className="grid grid-cols-[1fr_64px_64px] gap-1.5 rounded-xl border border-border p-2">
                          <Input aria-label={`Stat ${j + 1} label`} value={st.label} onChange={(e) => (panel.stats[j] ? patchStat(j, { label: e.target.value }) : patchPanel({ stats: [...panel.stats, { label: e.target.value, value: "", unit: "" }] }))} placeholder="Coverage" />
                          <Input aria-label={`Stat ${j + 1} value`} value={st.value} onChange={(e) => patchStat(j, { value: e.target.value })} placeholder="24/7" />
                          <Input aria-label={`Stat ${j + 1} unit`} value={st.unit} onChange={(e) => patchStat(j, { unit: e.target.value })} placeholder="LIVE" />
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {panel.layout !== "hero" && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{panel.layout === "blueprint" ? "Lines (up to 4)" : panel.layout === "stack" ? "Cards (up to 4)" : "Channels (up to 4)"}</legend>
                  <div className="space-y-2">
                    {panel.items.map((it, j) => (
                      <div key={j} className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 sm:grid-cols-[110px_1fr_80px_120px]">
                        <Input aria-label="Code" value={it.code} onChange={(e) => patchItem(j, { code: e.target.value })} placeholder="A-01" className="font-mono text-[12px]" />
                        <Input aria-label="Title" value={it.title} onChange={(e) => patchItem(j, { title: e.target.value })} placeholder="ORDERS & TABLETS" />
                        <Input aria-label="Figure" value={it.figure} onChange={(e) => patchItem(j, { figure: e.target.value })} placeholder="0" />
                        <Input aria-label="Unit" value={it.unit} onChange={(e) => patchItem(j, { unit: e.target.value })} placeholder="MISSED" />
                        <Textarea aria-label="Text" rows={2} value={it.body} onChange={(e) => patchItem(j, { body: e.target.value })} className="sm:col-span-3" />
                        <Input aria-label="Tags, comma-separated" value={it.tags.join(", ")} onChange={(e) => patchItem(j, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4) })} placeholder="TAG, TAG" className="font-mono text-[12px]" />
                        <div className="sm:col-span-4"><Button variant="ghost" size="sm" onClick={() => patchPanel({ items: panel.items.filter((_, k) => k !== j) })}>Remove</Button></div>
                      </div>
                    ))}
                    {panel.items.length < 4 && <Button variant="secondary" size="sm" onClick={() => patchPanel({ items: [...panel.items, { code: "", title: "", body: "", figure: "", unit: "", tags: [] }] })}>Add one</Button>}
                  </div>
                </fieldset>
              )}
            </div>

            <PhotoField panel={panel} onChange={(image) => patchPanel({ image })} onAlt={(imageAlt) => patchPanel({ imageAlt })} />
          </div>
        </Card>
      )}
    </div>
  );
}

/** The panel's photograph: drop or choose a file (as-is, 4K welcome), or paste a link; a preview shows what the page will get. */
function PhotoField({ panel, onChange, onAlt }: { panel: IntroPanel; onChange: (url: string) => void; onAlt: (alt: string) => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);

  async function take(file: File | undefined) {
    if (!file || busy) return;
    try {
      setBusy(true);
      const form = new FormData();
      form.set("file", file);
      form.set("slug", panel.id);
      const r = await uploadSiteImage(form);
      if (!r.ok || !r.url) throw new Error(r.error ?? "The upload failed.");
      onChange(r.url);
      toast.success("Photograph uploaded — save the intro to publish it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const ok = isIntroImageSrc(panel.image);
  return (
    <div className="space-y-2">
      <Label>Photograph</Label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a photograph"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={cn("relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl border border-dashed bg-surface transition-colors", over ? "border-accent" : "border-border hover:border-accent/50", busy && "cursor-progress")}
      >
        {panel.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-background/80 px-3 py-2 text-[12px] backdrop-blur">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-accent" />}
          {busy ? "Uploading…" : "Drop a photograph here, or click to choose (JPG, PNG or WebP, up to 16 MB)"}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      </div>
      <Input value={panel.image} onChange={(e) => onChange(e.target.value)} placeholder="…or paste a link (an upload, /path on this site, or images.unsplash.com)" className={cn("font-mono text-[12px]", !ok && panel.image && "border-danger")} aria-label="Photograph link" />
      {!ok && panel.image && <p className="text-[12px] text-danger">Only uploads, paths on this site and Unsplash links are shown.</p>}
      <Input value={panel.imageAlt} onChange={(e) => onAlt(e.target.value)} placeholder="Describe the photograph (for screen readers and search)" aria-label="Photograph description" />
      <p className="text-[11.5px] text-muted-foreground">Landscape works best — it fills half the screen on desktop. The starting photographs are from Unsplash; yours replace them.</p>
    </div>
  );
}
