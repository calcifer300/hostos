/**
 * What the site reads from the app at request time (ISR): the roster and
 * the landing footage the Founder saved. The app answers on its own
 * Vercel alias so the read never goes back through this site's proxy.
 * Every read falls back to the built-in content — a slow app never breaks
 * the front door.
 */
import { FILM, SECTIONS, TILES, VIDEO } from '$lib/content/site';
import { normalizeTeam, TEAM, type Member } from '$lib/content/team';

export const APP_ORIGIN = 'https://hostos-ten.vercel.app';

export type Chapter = (typeof FILM.chapters)[number];
export interface Landing {
	members: Member[];
	chapters: Chapter[];
	heroSrc: string;
	extras: { team: string; delivery: string; closing: string };
	tiles: Record<string, string>;
	sections: Record<string, { clip: string; tint: string }>;
}
/** The built-in landing, for the sections that render without a page load behind them. */
export const LANDING_DEFAULTS: Pick<Landing, 'tiles' | 'sections' | 'extras'> = { tiles: TILES, sections: SECTIONS, extras: { team: VIDEO.team, delivery: VIDEO.delivery, closing: VIDEO.closing } };

const str = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v : fb);
const src = (v: unknown, fb: string) => (typeof v === 'string' && /^(\/|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/|https:\/\/videos\.pexels\.com\/)/i.test(v) ? v : fb);

function chaptersFrom(raw: unknown): Chapter[] {
	const list = Array.isArray(raw) ? raw : [];
	return FILM.chapters.map((d, i) => {
		const c = (list[i] && typeof list[i] === 'object' ? list[i] : {}) as Record<string, unknown>;
		const ev = Array.isArray(c.events) ? c.events : [];
		const events = d.events.map((de, j) => {
			const e = (ev[j] && typeof ev[j] === 'object' ? ev[j] : {}) as Record<string, unknown>;
			return [str(e.t, de[0]), str(e.text, de[1])] as [string, string];
		});
		return { ...d, time: str(c.time, d.time), name: str(c.name, d.name), line: str(c.line, d.line), src: src(c.src, d.src), events };
	});
}

export async function loadLanding(fetchFn: typeof fetch): Promise<Landing> {
	const timeout = (ms: number) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
	const [team, landing] = await Promise.all([
		fetchFn(`${APP_ORIGIN}/api/public/team`, { signal: timeout(4000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
		fetchFn(`${APP_ORIGIN}/api/public/landing`, { signal: timeout(4000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
	]);
	const film = (landing && typeof landing === 'object' ? (landing as { film?: unknown }).film : null) as Record<string, unknown> | null;
	return {
		members: team ? normalizeTeam(team) : TEAM,
		chapters: chaptersFrom(film?.chapters),
		heroSrc: src((film?.hero as Record<string, unknown> | undefined)?.src, VIDEO.hero.src),
		extras: (() => { const ex = (film?.extras && typeof film.extras === 'object' ? film.extras : {}) as Record<string, unknown>; return { team: src(ex.team, VIDEO.team), delivery: src(ex.delivery, VIDEO.delivery), closing: src(ex.closing, VIDEO.closing) }; })(),
		tiles: (() => { const t = (film?.tiles && typeof film.tiles === 'object' ? film.tiles : {}) as Record<string, unknown>; return Object.fromEntries(Object.keys(TILES).map((k) => [k, t[k] === '' ? '' : src(t[k], TILES[k])])); })(),
		sections: (() => {
			const s = (film?.sections && typeof film.sections === 'object' ? film.sections : {}) as Record<string, unknown>;
			return Object.fromEntries(Object.entries(SECTIONS).map(([k, d]) => {
				const v = (s[k] && typeof s[k] === 'object' ? s[k] : {}) as Record<string, unknown>;
				return [k, { clip: v.clip === '' ? '' : src(v.clip, d.clip), tint: typeof v.tint === 'string' && /^#[0-9a-f]{6}$/i.test(v.tint) ? v.tint : d.tint }];
			}));
		})()
	};
}
