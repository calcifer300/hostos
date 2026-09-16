"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { moveTeamProfile, removeTeamProfile, saveDefaultTeam, saveTeamProfile, uploadTeamPhoto } from "@/lib/actions/team-page";
import { prepareTeamPhoto } from "@/lib/team/photo-look";
import { DEPARTMENTS, DEPARTMENT_IDS, hueOf, type Department, type TeamProfile } from "@/lib/team/profiles";
import { MemberPhoto, Portrait, TeamTile } from "@/components/marketing/team-tiles";
import { cn } from "@/lib/utils";

type Draft = { id: string | null; slug: string; name: string; nickname: string; title: string; department: Department; focus: string; quote: string; responsibilities: string; photoUrl: string; hue: string; email: string; active: boolean };

const toDraft = (p?: TeamProfile): Draft => ({ id: p?.id ?? null, slug: p?.slug ?? "", name: p?.name ?? "", nickname: p?.nickname ?? "", title: p?.title ?? "", department: p?.department ?? "operations", focus: p?.focus.join(" · ") ?? "", quote: p?.quote ?? "", responsibilities: p?.responsibilities.join("\n") ?? "", photoUrl: p?.photoUrl ?? "", hue: p?.hue ?? (p ? DEPARTMENTS[p.department].hue : ""), email: p?.email ?? "", active: p?.active ?? true });

/**
 * The Founder's editor for hostoscollective.com/team: every member as a
 * tile preview, edit in place, add, remove, reorder, photo by upload (cropped
 * and matched in the browser, stored in the team bucket) or by link. The
 * built-in roster is what the page shows until "Save roster to database" is
 * pressed once.
 */

/**
 * The photo field: drop or choose a file and it becomes a 4:5 portrait in
 * the set's lighting, uploaded and linked in one step; or paste a link.
 */
function PhotoField({ draft, onChange }: { draft: Draft; onChange: (photoUrl: string) => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<null | "preparing" | "uploading">(null);
  const [over, setOver] = React.useState(false);
  const [match, setMatch] = React.useState(true);
  const preview: TeamProfile = { id: "preview", slug: draft.slug || "new", name: draft.name || "?", nickname: draft.nickname || null, title: "", department: draft.department, focus: [], quote: "", responsibilities: [], photoUrl: draft.photoUrl || null, hue: /^#[0-9a-f]{6}$/i.test(draft.hue) ? draft.hue : null, email: null, position: 0, active: true };

  async function take(file: File | undefined) {
    if (!file || busy) return;
    try {
      setBusy("preparing");
      const blob = await prepareTeamPhoto(file, { match });
      setBusy("uploading");
      const form = new FormData();
      form.set("file", new File([blob], `${draft.slug || "member"}.jpg`, { type: "image/jpeg" }));
      form.set("slug", draft.slug || draft.name);
      const r = await uploadTeamPhoto(form);
      if (!r.ok || !r.url) throw new Error(r.error ?? "The upload failed.");
      onChange(r.url);
      toast.success("Photo uploaded — save the member to publish it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Photo</Label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a photo"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={cn("flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-3 transition-colors", over ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-surface/60", busy && "cursor-progress")}
      >
        <span className="relative block h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
          <Portrait member={preview} sizes="64px" fallbackSize={18} />
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-4 w-4 animate-spin" /></span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-medium"><ImagePlus className="h-4 w-4 text-accent" /> {busy === "preparing" ? "Preparing the portrait…" : busy === "uploading" ? "Uploading…" : "Drop a photo here, or click to choose"}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">JPG, PNG or WebP. It becomes a 4:5 portrait{match ? " in the set's lighting" : ""}, ready for the page.</p>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Switch checked={match} onCheckedChange={setMatch} /> Match the set&rsquo;s lighting</label>
        <Input value={draft.photoUrl} onChange={(e) => onChange(e.target.value)} placeholder="…or paste a link: https://… or /team/john.jpg" className="min-w-[240px] flex-1 font-mono text-[12px]" aria-label="Photo link" />
      </div>
    </div>
  );
}
export function TeamPageEditor({ profiles, fromDatabase }: { profiles: TeamProfile[]; fromDatabase: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const ordered = [...profiles].sort((a, b) => a.position - b.position);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success(done);
      setDraft(null);
      router.refresh();
    });
  }

  const preview: TeamProfile | null = draft
    ? { id: draft.id ?? "new", slug: draft.slug || "new", name: draft.name || "Name", nickname: draft.nickname || null, title: draft.title || "Title", department: draft.department, focus: draft.focus.split("·").map((s) => s.trim()).filter(Boolean), quote: draft.quote, responsibilities: draft.responsibilities.split("\n").map((s) => s.trim()).filter(Boolean), photoUrl: draft.photoUrl || null, hue: /^#[0-9a-f]{6}$/i.test(draft.hue) ? draft.hue : null, email: draft.email || null, position: 0, active: draft.active }
    : null;

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold">Our Team page</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {fromDatabase ? `${ordered.filter((p) => p.active).length} of ${ordered.length} members shown. The public page shows photo, name and role; The Collective (signed in) shows everything.` : "Showing the built-in roster. Save it to the database once to edit members, photos and order."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/team" target="_blank">Public page <ExternalLink /></Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/app/collective">The Collective</Link></Button>
            {!fromDatabase && <Button variant="primary" size="sm" loading={pending} onClick={() => run(saveDefaultTeam, "Roster saved — every member is now editable")}>Save roster to database</Button>}
            {fromDatabase && <Button variant="primary" size="sm" onClick={() => setDraft(toDraft())}><Plus /> Add member</Button>}
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {draft && (
          <motion.div key="editor" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card padding="md">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="t-name">Full name</Label><Input id="t-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Maribel Magbual" /></div>
                  <div className="space-y-1.5"><Label htmlFor="t-nick">Nickname (shown when the tile is opened)</Label><Input id="t-nick" value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} placeholder="Belle" /></div>
                  <div className="space-y-1.5"><Label htmlFor="t-title">Title</Label><Input id="t-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Director of Operations" /></div>
                  <div className="space-y-1.5"><Label htmlFor="t-dept">Department (colour)</Label>
                    <NativeSelect id="t-dept" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value as Department })}>{DEPARTMENT_IDS.map((d) => <option key={d} value={d}>{DEPARTMENTS[d].label}</option>)}</NativeSelect>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="t-focus">Focus words (separate with ·)</Label><Input id="t-focus" value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} placeholder="Vision · Strategy · Growth" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="t-quote">One-line promise</Label><Input id="t-quote" value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} placeholder="Leads the company toward a bigger future." /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="t-resp">Responsibilities (one per line)</Label><Textarea id="t-resp" rows={6} value={draft.responsibilities} onChange={(e) => setDraft({ ...draft, responsibilities: e.target.value })} /></div>
                  <PhotoField draft={draft} onChange={(photoUrl) => setDraft({ ...draft, photoUrl })} />
                  <div className="space-y-1.5"><Label htmlFor="t-hue">Tile colour</Label>
                    <div className="flex items-center gap-2">
                      <input id="t-hue" type="color" value={/^#[0-9a-f]{6}$/i.test(draft.hue) ? draft.hue : DEPARTMENTS[draft.department].hue} onChange={(e) => setDraft({ ...draft, hue: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5" aria-label="Tile colour" />
                      <Input value={draft.hue} onChange={(e) => setDraft({ ...draft, hue: e.target.value })} placeholder={DEPARTMENTS[draft.department].hue} className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="t-email">Sign-in email (optional)</Label><Input id="t-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} /> Shown on the public page</label>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button variant="primary" loading={pending} onClick={() => run(() => saveTeamProfile(draft), "Saved")}>Save member</Button>
                    <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                  {preview && <TeamTile member={preview} />}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <ul className="divide-y divide-border">
          {ordered.map((p, i) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${p.active ? "" : "opacity-60"}`}>
              <MemberPhoto member={p} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{p.name}{p.nickname && p.nickname !== p.name ? <span className="font-normal text-muted-foreground"> “{p.nickname}”</span> : null} <span className="font-normal text-muted-foreground">· {p.title}</span></p>
                <p className="truncate text-[12px]" style={{ color: hueOf(p) }}>{[DEPARTMENTS[p.department].label, ...p.focus.filter((f) => f.toLowerCase() !== DEPARTMENTS[p.department].label.toLowerCase())].join(" · ")}{p.active ? "" : " · hidden"}</p>
              </div>
              <div className="flex items-center gap-1">
                {fromDatabase && (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={pending || i === 0} onClick={() => run(() => moveTeamProfile(p.id, "up"), "Moved")}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={pending || i === ordered.length - 1} onClick={() => run(() => moveTeamProfile(p.id, "down"), "Moved")}><ArrowDown /></Button>
                  </>
                )}
                <Button variant="secondary" size="sm" disabled={!fromDatabase} onClick={() => setDraft(toDraft(p))}><Pencil /> Edit</Button>
                {fromDatabase && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} disabled={pending} onClick={() => { if (confirm(`Remove ${p.name} from the team page?`)) run(() => removeTeamProfile(p.id), "Removed"); }}><Trash2 /></Button>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
