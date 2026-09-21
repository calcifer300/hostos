import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";
import { asDepartment, DEFAULT_TEAM, type TeamProfile } from "@/lib/team/profiles";

/** The public roster (migration 0029). Reads are total; the defaults stand in until the Founder saves the roster. */

interface Row {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  title: string;
  department: string;
  focus: string[] | null;
  quote: string;
  responsibilities: string[] | null;
  photo_url: string | null;
  photo_focus: string | null;
  hue: string | null;
  email: string | null;
  position: number;
  active: boolean;
}
const COLUMNS = "id, slug, name, nickname, title, department, focus, quote, responsibilities, photo_url, photo_focus, hue, email, position, active";
const FOCUS = /^\d{1,3}% \d{1,3}%$/;
const focusOf = (v: string | null | undefined) => (v && FOCUS.test(v) ? v : "50% 30%");
const rowToProfile = (r: Row): TeamProfile => ({ id: r.id, slug: r.slug, name: r.name, nickname: r.nickname, title: r.title, department: asDepartment(r.department), focus: r.focus ?? [], quote: r.quote, responsibilities: r.responsibilities ?? [], photoUrl: r.photo_url, photoFocus: focusOf(r.photo_focus), hue: r.hue, email: r.email, position: r.position, active: r.active });

/** Every saved profile, including inactive ones (the editor shows them greyed). */
export const getTeamProfiles = cache(async function getTeamProfiles(): Promise<{ profiles: TeamProfile[]; fromDatabase: boolean }> {
  const { data } = await runQueryOr<Row[]>("team_profiles.list", [], (client) => client.from("team_profiles").select(COLUMNS).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(100).returns<Row[]>());
  if (data.length === 0) return { profiles: DEFAULT_TEAM, fromDatabase: false };
  return { profiles: data.map(rowToProfile), fromDatabase: true };
});

/** What the public page shows: active profiles, in order. */
export async function getPublicTeam(): Promise<TeamProfile[]> {
  const { profiles } = await getTeamProfiles();
  return profiles.filter((p) => p.active).sort((a, b) => a.position - b.position);
}

type Done = { ok: true } | { ok: false; error: string };

export async function upsertTeamProfile(p: Omit<TeamProfile, "id"> & { id?: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const row = { slug: p.slug, name: p.name, nickname: p.nickname, title: p.title, department: p.department, focus: p.focus, quote: p.quote, responsibilities: p.responsibilities, photo_url: p.photoUrl, photo_focus: focusOf(p.photoFocus), hue: p.hue, email: p.email, position: p.position, active: p.active };
  const outcome = await runQuery<{ id: string }>("team_profiles.upsert", (client) =>
    (p.id ? client.from("team_profiles").update(row).eq("id", p.id) : client.from("team_profiles").insert(row)).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function deleteTeamProfile(id: string): Promise<Done> {
  const result = await runMutation("team_profiles.delete", (client) => client.from("team_profiles").delete().eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Writes the whole default roster — used once, when the Founder first saves, so every default becomes an editable row. */
export async function seedTeamProfiles(): Promise<Done> {
  const rows = DEFAULT_TEAM.map((p) => ({ slug: p.slug, name: p.name, nickname: p.nickname, title: p.title, department: p.department, focus: p.focus, quote: p.quote, responsibilities: p.responsibilities, photo_url: p.photoUrl, photo_focus: focusOf(p.photoFocus), hue: p.hue, email: p.email, position: p.position, active: true }));
  const result = await runMutation("team_profiles.seed", (client) => client.from("team_profiles").upsert(rows, { onConflict: "slug", ignoreDuplicates: true }));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function reorderTeamProfiles(ids: string[]): Promise<Done> {
  for (let i = 0; i < ids.length; i++) {
    const result = await runMutation("team_profiles.reorder", (client) => client.from("team_profiles").update({ position: i }).eq("id", ids[i]));
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true };
}
