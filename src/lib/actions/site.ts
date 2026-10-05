"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { isFilmSrc, normalizeFilm, type LandingFilm } from "@/lib/site/film";
import { DEFAULT_INTRO, isIntroImageSrc, normalizeIntro, type LandingIntro } from "@/lib/site/intro";
import { clearLandingIntro, getLandingFilm, getLandingIntro, putLandingFilm, putLandingIntro } from "@/lib/site/queries";
import { PHOTO_TYPES } from "@/lib/team/photo-look";
import { putPublicObject, removePublicObject, signPublicUpload } from "@/lib/team/storage";

/**
 * Editing the public landing page's intro. Founder only — this is the
 * company's front door — and re-checked here because a server action is a
 * public endpoint.
 */

export interface SiteResult { ok: boolean; error?: string; url?: string }

async function founder(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  return isFounderEmail(email) ? { ok: true, email } : { ok: false, error: "Only the Founder can edit the website." };
}

const hint = (e: string) => (/relation|site_content|does not exist/i.test(e) ? "Run migration 0032 (site_content) to enable website editing." : e);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function refresh() {
  revalidatePath("/");
  revalidatePath("/api/public/landing");
  revalidatePath("/app/settings/website");
}

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const VIDEO_MAX = 50 * 1024 * 1024; // the storage plan caps a single object at 50 MB

/** The landing page's footage: the hero clip and the four chapters. Uploads no longer referenced are removed after the save. */
export async function saveLandingFilm(input: unknown): Promise<SiteResult> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const film: LandingFilm = normalizeFilm(input);
  const raw = (input && typeof input === "object" ? input : {}) as { hero?: { src?: unknown }; chapters?: { src?: unknown }[]; extras?: Record<string, unknown>; tiles?: Record<string, unknown>; sections?: Record<string, { clip?: unknown }> };
  const offered = [raw.hero?.src, ...(raw.chapters ?? []).map((c) => c?.src), ...Object.values(raw.extras ?? {}), ...Object.values(raw.tiles ?? {}), ...Object.values(raw.sections ?? {}).map((s) => s?.clip)].filter((s): s is string => typeof s === "string" && s.trim() !== "");
  const bad = offered.find((s) => !isFilmSrc(s));
  if (bad) return { ok: false, error: "A clip must be an upload, a file on the site (/…) or a videos.pexels.com link." };
  const before = await getLandingFilm();
  const r = await putLandingFilm(film, gate.email);
  if (!r.ok) return { ok: false, error: hint(r.error) };
  const every = (f: LandingFilm) => [f.hero.src, ...f.chapters.map((c) => c.src), ...Object.values(f.extras), ...Object.values(f.tiles), ...Object.values(f.sections).map((s) => s.clip)].filter(Boolean);
  const still = new Set(every(film));
  for (const s of every(before.film)) if (!still.has(s)) await removePublicObject("site", s);
  refresh();
  return { ok: true };
}

/** Signs a direct upload for a clip (MP4, WebM or MOV, up to 50 MB). The browser PUTs the file to the returned URL; the public URL goes in the clip field. */
export async function signFilmUpload(input: { name?: unknown; type?: unknown; size?: unknown; slug?: unknown }): Promise<SiteResult & { uploadUrl?: string }> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const type = typeof input.type === "string" ? input.type : "";
  const ext = VIDEO_TYPES[type];
  if (!ext) return { ok: false, error: "Use an MP4, WebM or MOV clip." };
  const size = typeof input.size === "number" ? input.size : 0;
  if (size <= 0 || size > VIDEO_MAX) return { ok: false, error: "Clips can be up to 50 MB — export at 960p; an SD clip is 2–5 MB." };
  const slug = str(input.slug, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "clip";
  const r = await signPublicUpload("site", `film-${slug}`, ext);
  return r.ok ? { ok: true, uploadUrl: r.uploadUrl, url: r.publicUrl } : { ok: false, error: r.error };
}

/** Saves the whole intro (every panel), made whole against the defaults first. Photographs that were ours and are no longer used are removed. */
export async function saveLandingIntro(input: unknown): Promise<SiteResult> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const intro: LandingIntro = normalizeIntro(input);
  for (const p of intro.panels) {
    if (!isIntroImageSrc(p.image)) return { ok: false, error: `Panel "${p.title} ${p.accent}": the photograph must be an upload, a path on this site (/…) or an Unsplash link.` };
    if (!/^(\/|https?:\/\/)/.test(intro.ctaHref)) return { ok: false, error: "The button link must start with / or https://." };
  }
  const before = await getLandingIntro();
  const r = await putLandingIntro(intro, gate.email);
  if (!r.ok) return { ok: false, error: hint(r.error) };
  const still = new Set(intro.panels.map((p) => p.image));
  for (const p of before.intro.panels) if (!still.has(p.image)) await removePublicObject("site", p.image);
  refresh();
  return { ok: true };
}

/** Back to the code's defaults: the stored copy is dropped (its uploads too). */
export async function restoreLandingIntro(): Promise<SiteResult> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const before = await getLandingIntro();
  const r = await clearLandingIntro();
  if (!r.ok) return { ok: false, error: hint(r.error) };
  const defaults = new Set(DEFAULT_INTRO.panels.map((p) => p.image));
  for (const p of before.intro.panels) if (!defaults.has(p.image)) await removePublicObject("site", p.image);
  refresh();
  return { ok: true };
}

/** Switches the intro on or off without touching the copy — off is the landing page exactly as it was. */
export async function setLandingIntroEnabled(enabled: boolean): Promise<SiteResult> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { intro } = await getLandingIntro();
  const r = await putLandingIntro({ ...intro, enabled: Boolean(enabled) }, gate.email);
  if (!r.ok) return { ok: false, error: hint(r.error) };
  refresh();
  return { ok: true };
}

/** A photograph for a panel, as-is (4K welcome, up to 16 MB), into the public `site` bucket. Returns the URL for the panel's image field. */
export async function uploadSiteImage(form: FormData): Promise<SiteResult> {
  const gate = await founder();
  if (!gate.ok) return { ok: false, error: gate.error };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a photograph first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP photograph." };
  if (file.size > 16 * 1024 * 1024) return { ok: false, error: "That photograph is over 16 MB — export it a little smaller." };
  const slug = str(form.get("slug"), 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "panel";
  const r = await putPublicObject("site", await file.arrayBuffer(), file.type, slug);
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error };
}
