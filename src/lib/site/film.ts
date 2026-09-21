/**
 * The landing page's footage — what hostoscollective.com (the SvelteKit
 * site) plays: the hero's background clip and the four chapters of "Watch
 * it run". The Founder edits it at Settings → Website; the site reads it
 * from /api/public/landing (ISR, a few minutes behind at most).
 *
 * Client-safe: no imports.
 */

export interface FilmEvent { t: string; text: string }
export interface FilmChapter { id: string; time: string; name: string; line: string; src: string; events: FilmEvent[] }
export interface LandingFilm {
	hero: { src: string };
	chapters: FilmChapter[];
}

export const FILM_KEY = "landing_film";

/** Pexels clips (free licence) until the company's own footage is uploaded. */
const clip = (id: number, fps: number) => `https://videos.pexels.com/video-files/${id}/${id}-sd_960_540_${fps}fps.mp4`;

export const DEFAULT_FILM: LandingFilm = {
	hero: { src: clip(5834188, 24) },
	chapters: [
		{ id: "fleet", time: "07:40", name: "Fleet", line: "146 cars. Eleven going out before nine.", src: clip(4208203, 24), events: [{ t: "07:41", text: "Guest asks for an early pickup — answered in 1 m" }, { t: "07:52", text: "Model 3 · keys out · lockbox code sent" }, { t: "08:10", text: "Civic back · 12 photos · no damage" }] },
		{ id: "kitchen", time: "11:30", name: "Kitchen", line: "Lunch rush on three delivery apps.", src: clip(8094279, 25), events: [{ t: "11:32", text: "Uber Eats store paused — reopened in 40 s" }, { t: "11:48", text: "86 garlic rice · pulled from 3 apps" }, { t: "12:05", text: "Refund dispute filed with photos" }] },
		{ id: "field", time: "14:00", name: "Field", line: "A windshield job from call to signature.", src: clip(20693196, 25), events: [{ t: "14:02", text: "Lead → customer → estimate · one screen" }, { t: "14:15", text: "Ramon dispatched · customer texted the ETA" }, { t: "15:40", text: "Work order signed on the phone · invoice sent" }] },
		{ id: "shop", time: "17:30", name: "Shop", line: "A barbershop’s site goes live.", src: clip(4177954, 30), events: [{ t: "17:31", text: "Domain in the owner’s name · DNS set" }, { t: "17:45", text: "Bookings page connected to the calendar" }, { t: "18:02", text: "First online booking · Saturday 10:00" }] },
	],
};

/** Footage the site will play: an upload in our storage, a file on the site, or a Pexels clip. Nothing else. */
export const isFilmSrc = (url: string): boolean => url.startsWith("/") || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url) || /^https:\/\/videos\.pexels\.com\//i.test(url);

const str = (v: unknown, fallback: string, max = 200): string => (typeof v === "string" ? v.slice(0, max) : fallback);

/** Whatever was stored, made whole against the defaults. */
export function normalizeFilm(raw: unknown): LandingFilm {
	const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const hero = (r.hero && typeof r.hero === "object" ? r.hero : {}) as Record<string, unknown>;
	const chaptersRaw = Array.isArray(r.chapters) ? r.chapters : [];
	const chapters = DEFAULT_FILM.chapters.map((d, i) => {
		const c = (chaptersRaw[i] && typeof chaptersRaw[i] === "object" ? chaptersRaw[i] : {}) as Record<string, unknown>;
		const ev = Array.isArray(c.events) ? c.events : null;
		return {
			id: d.id,
			time: str(c.time, d.time, 8),
			name: str(c.name, d.name, 24),
			line: str(c.line, d.line, 90),
			src: (() => { const s = str(c.src, d.src, 600); return isFilmSrc(s) ? s : d.src; })(),
			events: ev
				? ev.slice(0, 3).map((e, j) => { const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>; const dd = d.events[j] ?? { t: "", text: "" }; return { t: str(x.t, dd.t, 8), text: str(x.text, dd.text, 90) }; })
				: d.events,
		};
	});
	const heroSrc = str(hero.src, DEFAULT_FILM.hero.src, 600);
	return { hero: { src: isFilmSrc(heroSrc) ? heroSrc : DEFAULT_FILM.hero.src }, chapters };
}
