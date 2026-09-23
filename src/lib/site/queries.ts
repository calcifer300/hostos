import "server-only";
import { cache } from "react";
import { runMutation, runQueryOr } from "@/lib/supabase/server";
import { DEFAULT_FILM, FILM_KEY, normalizeFilm, type LandingFilm } from "@/lib/site/film";
import { DEFAULT_INTRO, INTRO_KEY, normalizeIntro, type LandingIntro } from "@/lib/site/intro";

/**
 * Editable public-site content (migration 0032, `site_content`): one JSON
 * value per key. Reads are total — before the migration, or with nothing
 * saved, the code's defaults show.
 */

interface Row { value: unknown }

export const getLandingIntro = cache(async function getLandingIntro(): Promise<{ intro: LandingIntro; fromDatabase: boolean }> {
  const { data } = await runQueryOr<Row[]>("site_content.intro", [], (client) => client.from("site_content").select("value").eq("key", INTRO_KEY).limit(1).returns<Row[]>());
  if (data.length === 0) return { intro: DEFAULT_INTRO, fromDatabase: false };
  return { intro: normalizeIntro(data[0].value), fromDatabase: true };
});

export async function putLandingIntro(intro: LandingIntro, by: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("site_content.intro.put", (client) => client.from("site_content").upsert({ key: INTRO_KEY, value: intro, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: "key" }));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export const getLandingFilm = cache(async function getLandingFilm(): Promise<{ film: LandingFilm; fromDatabase: boolean }> {
  const { data } = await runQueryOr<Row[]>("site_content.film", [], (client) => client.from("site_content").select("value").eq("key", FILM_KEY).limit(1).returns<Row[]>());
  if (data.length === 0) return { film: DEFAULT_FILM, fromDatabase: false };
  return { film: normalizeFilm(data[0].value), fromDatabase: true };
});

export async function putLandingFilm(film: LandingFilm, by: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("site_content.film.put", (client) => client.from("site_content").upsert({ key: FILM_KEY, value: film, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: "key" }));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function clearLandingIntro(): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("site_content.intro.clear", (client) => client.from("site_content").delete().eq("key", INTRO_KEY));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
