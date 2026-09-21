"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clapperboard, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { saveLandingFilm, signFilmUpload, uploadSiteImage } from "@/lib/actions/site";
import { DEFAULT_FILM, isFilmSrc, SECTION_SLOTS, TILE_SLOTS, type FilmChapter, type LandingFilm } from "@/lib/site/film";
import { cn } from "@/lib/utils";

/**
 * The landing page's footage: the hero clip and the four chapters of
 * "Watch it run". Clips upload straight from the browser to storage (a
 * signed URL, so a 100 MB file never touches a server action) with a
 * progress bar; a link works too. Saved as one document; the site picks it
 * up within a few minutes.
 */
export function FilmEditor({ film: initial, fromDatabase }: { film: LandingFilm; fromDatabase: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [film, setFilm] = React.useState<LandingFilm>(initial);
  const [dirty, setDirty] = React.useState(false);

  const patchChapter = (i: number, next: Partial<FilmChapter>) => { setFilm((f) => ({ ...f, chapters: f.chapters.map((c, k) => (k === i ? { ...c, ...next } : c)) })); setDirty(true); };
  const patchEvent = (i: number, j: number, next: Partial<FilmChapter["events"][number]>) => patchChapter(i, { events: film.chapters[i].events.map((e, k) => (k === j ? { ...e, ...next } : e)) });

  function save() {
    startTransition(async () => {
      const r = await saveLandingFilm(film);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success("Saved — the site picks it up within a few minutes");
      setDirty(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold"><Clapperboard className="h-4 w-4 text-accent" /> Landing page footage</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              The clip behind the hero and the four chapters of “Watch it run” on hostoscollective.com. {fromDatabase ? "Showing your saved footage." : "Showing the stock clips until you save."} MP4, WebM or MOV, up to 300 MB; 960p or 1080p is plenty — it plays muted, small and dark.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("Put the stock clips and the built-in chapter text back? Your uploads are removed when you save.")) { setFilm(DEFAULT_FILM); setDirty(true); } }}><RotateCcw /> Stock footage</Button>
            <Button variant="primary" size="sm" loading={pending} disabled={!dirty && fromDatabase} onClick={save}>Save footage</Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <p className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Hero background</p>
        <ClipField slug="hero" value={film.hero.src} onChange={(src) => { setFilm((f) => ({ ...f, hero: { src } })); setDirty(true); }} hint="Plays at 30% behind the headline on desktop only. A slow, wide shot works best." />
      </Card>

      <Card padding="md">
        <p className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Three more places footage plays</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([["team", "Behind the Collective", "The team at work — plays dimmed behind the faces."], ["delivery", "Delivery tile", "Plays on the DoorDash & delivery tile under Industries."], ["closing", "Behind the final ask", "A slow city or road shot behind “Bring one operation”."]] as const).map(([k, label, hint]) => (
            <div key={k}>
              <Label className="mb-2 block">{label}</Label>
              <ClipField slug={k} value={film.extras[k]} onChange={(src) => { setFilm((f) => ({ ...f, extras: { ...f.extras, [k]: src } })); setDirty(true); }} hint={hint} />
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Section backgrounds · {SECTION_SLOTS.length} sections</summary>
          <p className="mt-1 text-[12px] text-muted-foreground">Each section has a slow, dimmed clip behind it and a colour its light leans towards. Clear the link to leave a section with just the light.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECTION_SLOTS.map(({ id, label }) => (
              <div key={id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{label}</Label>
                  <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">Light
                    <input type="color" aria-label={`${label} colour`} value={film.sections[id]?.tint ?? "#3b9cff"} onChange={(e) => { setFilm((f) => ({ ...f, sections: { ...f.sections, [id]: { ...f.sections[id], tint: e.target.value } } })); setDirty(true); }} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" />
                  </label>
                </div>
                <ClipField slug={`section-${id}`} value={film.sections[id]?.clip ?? ""} onChange={(clip) => { setFilm((f) => ({ ...f, sections: { ...f.sections, [id]: { ...f.sections[id], clip } } })); setDirty(true); }} />
              </div>
            ))}
          </div>
        </details>
      </Card>

      <Card padding="md">
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Tiles · {TILE_SLOTS.length} cards across the page</summary>
          <p className="mt-1 text-[12px] text-muted-foreground">Footage under the words on every card. Clear the link to leave a card plain.</p>
          {(["industry", "solution", "problem", "pillar", "week", "proof"] as const).map((group) => (
            <div key={group} className="mt-4">
              <p className="mb-2 text-[12px] font-semibold">{({ industry: "Industries", solution: "Solutions", problem: "The problems", pillar: "How HostOS works", week: "The first thirty days", proof: "Proof" })[group]}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TILE_SLOTS.filter((t) => t.id.startsWith(group + ":")).map(({ id, label }) => (
                  <div key={id} className="space-y-2">
                    <Label>{label}</Label>
                    <ClipField slug={`tile-${id.replace(":", "-")}`} value={film.tiles[id] ?? ""} onChange={(src) => { setFilm((f) => ({ ...f, tiles: { ...f.tiles, [id]: src } })); setDirty(true); }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </details>
      </Card>

      <Card padding="md">
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Testimonials and laurels</summary>
          <p className="mt-1 text-[12px] text-muted-foreground">What owners said, in their words, and the figures on the laurels above them. Keep it true — this is the page people check.</p>
          <div className="mt-4 space-y-3">
            {film.testimonials.map((t, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 md:grid-cols-[auto_1fr_160px_160px_auto]">
                <label className="relative block h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-surface" title="Their photo (paste a link below or drop a file)">
                  {t.photo && <img src={t.photo} alt="" className="h-full w-full object-cover" />}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("file", file); fd.append("slug", `face-${i}`); const r = await uploadSiteImage(fd); if (!r.ok || !r.url) return void toast.error(r.error ?? "Upload failed."); setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, photo: r.url! } : x)) })); setDirty(true); }} />
                </label>
                <Input aria-label="Quote" value={t.quote} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, quote: e.target.value } : x)) })); setDirty(true); }} placeholder="What they said" />
                <Input aria-label="Name" value={t.name} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })); setDirty(true); }} placeholder="Name" />
                <Input aria-label="Role" value={t.role} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)) })); setDirty(true); }} placeholder="Role · business" />
                <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, testimonials: f.testimonials.filter((_, k) => k !== i) })); setDirty(true); }}>Remove</Button>
                <Input aria-label="Photo link" value={t.photo} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, photo: e.target.value } : x)) })); setDirty(true); }} placeholder="Photo link (an upload, a file on the site, or images.pexels.com)" className="font-mono text-[12px] md:col-span-5" />
              </div>
            ))}
            {film.testimonials.length < 8 && <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, testimonials: [...f.testimonials, { quote: "", name: "", role: "", photo: "" }] })); setDirty(true); }}>Add a testimonial</Button>}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {film.laurels.map((l, i) => (
              <div key={i} className="grid grid-cols-[88px_1fr_auto] gap-2">
                <Input aria-label="Figure" value={l.value} onChange={(e) => { setFilm((f) => ({ ...f, laurels: f.laurels.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })); setDirty(true); }} className="font-mono" placeholder="98%" />
                <Input aria-label="What it counts" value={l.label} onChange={(e) => { setFilm((f) => ({ ...f, laurels: f.laurels.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })); setDirty(true); }} placeholder="client satisfaction" />
                <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, laurels: f.laurels.filter((_, k) => k !== i) })); setDirty(true); }}>×</Button>
              </div>
            ))}
            {film.laurels.length < 6 && <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, laurels: [...f.laurels, { value: "", label: "" }] })); setDirty(true); }}>Add a laurel</Button>}
          </div>
        </details>
      </Card>

      <Card padding="md">
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Testimonials and laurels</summary>
          <p className="mt-1 text-[12px] text-muted-foreground">What owners said, in their words, and the figures on the laurels above them. Keep it true — this is the page people check.</p>
          <div className="mt-4 space-y-3">
            {film.testimonials.map((t, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 md:grid-cols-[auto_1fr_160px_160px_auto]">
                <label className="relative block h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-surface" title="Their photo (paste a link below or drop a file)">
                  {t.photo && <img src={t.photo} alt="" className="h-full w-full object-cover" />}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("file", file); fd.append("slug", `face-${i}`); const r = await uploadSiteImage(fd); if (!r.ok || !r.url) return void toast.error(r.error ?? "Upload failed."); setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, photo: r.url! } : x)) })); setDirty(true); }} />
                </label>
                <Input aria-label="Quote" value={t.quote} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, quote: e.target.value } : x)) })); setDirty(true); }} placeholder="What they said" />
                <Input aria-label="Name" value={t.name} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })); setDirty(true); }} placeholder="Name" />
                <Input aria-label="Role" value={t.role} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)) })); setDirty(true); }} placeholder="Role · business" />
                <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, testimonials: f.testimonials.filter((_, k) => k !== i) })); setDirty(true); }}>Remove</Button>
                <Input aria-label="Photo link" value={t.photo} onChange={(e) => { setFilm((f) => ({ ...f, testimonials: f.testimonials.map((x, k) => (k === i ? { ...x, photo: e.target.value } : x)) })); setDirty(true); }} placeholder="Photo link (an upload, a file on the site, or images.pexels.com)" className="font-mono text-[12px] md:col-span-5" />
              </div>
            ))}
            {film.testimonials.length < 8 && <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, testimonials: [...f.testimonials, { quote: "", name: "", role: "", photo: "" }] })); setDirty(true); }}>Add a testimonial</Button>}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {film.laurels.map((l, i) => (
              <div key={i} className="grid grid-cols-[88px_1fr_auto] gap-2">
                <Input aria-label="Figure" value={l.value} onChange={(e) => { setFilm((f) => ({ ...f, laurels: f.laurels.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })); setDirty(true); }} className="font-mono" placeholder="98%" />
                <Input aria-label="What it counts" value={l.label} onChange={(e) => { setFilm((f) => ({ ...f, laurels: f.laurels.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })); setDirty(true); }} placeholder="client satisfaction" />
                <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, laurels: f.laurels.filter((_, k) => k !== i) })); setDirty(true); }}>×</Button>
              </div>
            ))}
            {film.laurels.length < 6 && <Button variant="ghost" size="sm" onClick={() => { setFilm((f) => ({ ...f, laurels: [...f.laurels, { value: "", label: "" }] })); setDirty(true); }}>Add a laurel</Button>}
          </div>
        </details>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {film.chapters.map((c, i) => (
          <Card key={c.id} padding="md">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">Chapter {i + 1} · {c.id}</p>
              <span className="font-mono text-[11px] text-accent">{c.time}</span>
            </div>
            <div className="grid grid-cols-[88px_1fr] gap-3">
              <div className="space-y-1.5"><Label htmlFor={`c-${i}-time`}>Time</Label><Input id={`c-${i}-time`} value={c.time} onChange={(e) => patchChapter(i, { time: e.target.value })} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor={`c-${i}-name`}>Name</Label><Input id={`c-${i}-name`} value={c.name} onChange={(e) => patchChapter(i, { name: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label htmlFor={`c-${i}-line`}>Caption on the footage</Label><Input id={`c-${i}-line`} value={c.line} onChange={(e) => patchChapter(i, { line: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5">
                <Label>Three events on the board</Label>
                {c.events.map((ev, j) => (
                  <div key={j} className="grid grid-cols-[88px_1fr] gap-2">
                    <Input aria-label={`Event ${j + 1} time`} value={ev.t} onChange={(e) => patchEvent(i, j, { t: e.target.value })} className="font-mono" />
                    <Input aria-label={`Event ${j + 1} text`} value={ev.text} onChange={(e) => patchEvent(i, j, { text: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="col-span-2"><ClipField slug={c.id} value={c.src} onChange={(src) => patchChapter(i, { src })} /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** A clip: drop or choose a file (uploads straight to storage with progress) or paste a link; a muted preview shows what the site gets. */
function ClipField({ slug, value, onChange, hint }: { slug: string; value: string; onChange: (url: string) => void; hint?: string }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [over, setOver] = React.useState(false);
  const busy = progress !== null;

  async function take(file: File | undefined) {
    if (!file || busy) return;
    try {
      setProgress(0);
      const signed = await signFilmUpload({ name: file.name, type: file.type, size: file.size, slug });
      if (!signed.ok || !signed.uploadUrl || !signed.url) throw new Error(signed.error ?? "Could not start the upload.");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.uploadUrl!);
        xhr.setRequestHeader("content-type", file.type);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Upload failed — check the connection and try again."));
        xhr.send(file);
      });
      onChange(signed.url);
      toast.success("Clip uploaded — save the footage to publish it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  const ok = isFilmSrc(value);
  return (
    <div className="space-y-2">
      <div
        role="button" tabIndex={0} aria-label="Upload a clip"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={cn("relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-dashed bg-surface transition-colors", over ? "border-accent" : "border-border hover:border-accent/50", busy && "cursor-progress")}
      >
        {value && ok && <video key={value} src={value} muted playsInline loop autoPlay preload="metadata" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-background/85 px-3 py-2 text-[12px] backdrop-blur">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-accent" />}
          {busy ? `Uploading… ${progress}%` : "Drop a clip here, or click to choose"}
        </div>
        {busy && <div className="absolute inset-x-0 top-0 h-1 bg-border"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div>}
        <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste a link (an upload, or videos.pexels.com)" className={cn("font-mono text-[12px]", !ok && value && "border-danger")} aria-label="Clip link" />
      {!ok && value && <p className="text-[12px] text-danger">Only uploads, files on the site and videos.pexels.com links are played.</p>}
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
