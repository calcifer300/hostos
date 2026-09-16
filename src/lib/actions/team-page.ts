"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/team/photo-look";
import { asDepartment } from "@/lib/team/profiles";
import { deleteTeamProfile, getTeamProfiles, reorderTeamProfiles, seedTeamProfiles, upsertTeamProfile } from "@/lib/team/queries";
import { putTeamPhoto, removeTeamPhoto } from "@/lib/team/storage";
import { routes } from "@/lib/routes";

/**
 * Editing the public "Our Team" roster. Founder only — this is the
 * company's public face, not a workspace setting — and re-checked here
 * because a server action is a public endpoint.
 */

export interface TeamPageResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function founder(): Promise<true | string> {
  const session = await auth();
  return isFounderEmail(session?.user?.email) ? true : "Only the Founder can edit the team page.";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lines = (v: unknown, max: number) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => str(x, 200)).filter(Boolean).slice(0, max);
const hint = (e: string) => (/nickname/i.test(e) ? "Run migration 0031 (team_profiles.nickname) to save names." : /relation|team_profiles|does not exist/i.test(e) ? "Run migration 0029 to enable the team page editor." : e);

function refresh() {
  revalidatePath("/team");
  revalidatePath(`${routes.settings}/company`);
}

/** Copies the built-in roster into the database so every member becomes editable. No-op for rows that already exist. */
export async function saveDefaultTeam(): Promise<TeamPageResult> {
  const gate = await founder();
  if (gate !== true) return { ok: false, error: gate };
  const r = await seedTeamProfiles();
  if (!r.ok) return { ok: false, error: hint(r.error) };
  refresh();
  return { ok: true };
}

export async function saveTeamProfile(input: { id?: string | null; slug?: string; name: string; nickname?: string; title: string; department?: string; focus?: string | string[]; quote?: string; responsibilities?: string | string[]; photoUrl?: string; hue?: string; email?: string; active?: boolean }): Promise<TeamPageResult> {
  const gate = await founder();
  if (gate !== true) return { ok: false, error: gate };
  const name = str(input.name, 80);
  const title = str(input.title, 120);
  if (!name || !title) return { ok: false, error: "Name and title are required." };
  const slug = (str(input.slug, 40) || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `member-${Date.now()}`;
  const photo = str(input.photoUrl, 500);
  if (photo && !/^(https?:\/\/|\/)/.test(photo)) return { ok: false, error: "The photo must be a link (https://…) or a path on the site (/team/name.jpg)." };
  const { profiles } = await getTeamProfiles();
  const existing = input.id ? profiles.find((p) => p.id === input.id) : undefined;
  const id = existing && !existing.id.startsWith("default-") ? existing.id : null;
  const r = await upsertTeamProfile({
    id,
    slug,
    name,
    nickname: str(input.nickname, 40) || null,
    title,
    department: asDepartment(input.department),
    focus: lines(input.focus, 4).map((f) => f.replace(/\s*·\s*/g, " ").trim()),
    quote: str(input.quote, 160),
    responsibilities: lines(input.responsibilities, 10),
    photoUrl: photo || null,
    hue: /^#[0-9a-f]{6}$/i.test(str(input.hue, 7)) ? str(input.hue, 7).toLowerCase() : existing?.hue ?? null,
    email: str(input.email, 160).toLowerCase() || null,
    position: existing?.position ?? profiles.length,
    active: input.active ?? true,
  });
  if (!r.ok) return { ok: false, error: hint(r.error) };
  // The photo this save replaced, if it was one of ours, is no longer referenced.
  if (existing?.photoUrl && existing.photoUrl !== (photo || null)) await removeTeamPhoto(existing.photoUrl);
  refresh();
  return { ok: true, id: r.id };
}

/**
 * A portrait from the Founder's disk, already cropped and matched by the
 * browser (src/lib/team/photo-look.ts), into the team bucket. Returns the
 * public URL to put in the member's photo field.
 */
export async function uploadTeamPhoto(form: FormData): Promise<TeamPageResult & { url?: string }> {
  const gate = await founder();
  if (gate !== true) return { ok: false, error: gate };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP photo." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "That photo is over 12 MB." };
  const slug = str(form.get("slug"), 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  const r = await putTeamPhoto(await file.arrayBuffer(), file.type, slug);
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error };
}

export async function removeTeamProfile(id: string): Promise<TeamPageResult> {
  const gate = await founder();
  if (gate !== true) return { ok: false, error: gate };
  if (String(id).startsWith("default-")) return { ok: false, error: "Save the roster to the database first, then remove members." };
  const { profiles } = await getTeamProfiles();
  const gone = profiles.find((p) => p.id === String(id));
  const r = await deleteTeamProfile(str(id, 40));
  if (!r.ok) return { ok: false, error: hint(r.error) };
  await removeTeamPhoto(gone?.photoUrl);
  refresh();
  return { ok: true };
}

export async function moveTeamProfile(id: string, direction: "up" | "down"): Promise<TeamPageResult> {
  const gate = await founder();
  if (gate !== true) return { ok: false, error: gate };
  const { profiles, fromDatabase } = await getTeamProfiles();
  if (!fromDatabase) return { ok: false, error: "Save the roster to the database first, then reorder." };
  const ordered = [...profiles].sort((a, b) => a.position - b.position).map((p) => p.id);
  const i = ordered.indexOf(String(id));
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return { ok: true };
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  const r = await reorderTeamProfiles(ordered);
  if (!r.ok) return { ok: false, error: hint(r.error) };
  refresh();
  return { ok: true };
}
