/**
 * What the site reads from the app at request time (ISR): the roster and
 * the landing footage the Founder saved. The app answers on its own
 * Vercel alias so the read never goes back through this site's proxy.
 * Every read falls back to the built-in content — a slow app never breaks
 * the front door.
 */
import { CONTACT, FILM, HERO, LAURELS, RATING, SECTIONS, TESTIMONIALS, TILES, VIDEO } from '$lib/content/site';
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
	testimonials: { quote: string; name: string; role: string; photo: string }[];
	laurels: { value: string; label: string }[];
	copy: LandingCopy;
	lists: LandingLists;
}
export interface ListRow { a: string; b: string; c: string }
export type ListKey = 'outcomes' | 'problems' | 'pillars' | 'why' | 'gains' | 'recognition' | 'faq' | 'faces' | 'industries' | 'steps' | 'beforeAfter';
export type LandingLists = Record<ListKey, ListRow[]>;
export const EMPTY_LISTS: LandingLists = { outcomes: [], problems: [], pillars: [], why: [], gains: [], recognition: [], faq: [], faces: [], industries: [], steps: [], beforeAfter: [] };
/** A list from the landing when the Founder wrote one, else the built-in rows. */
export const listOr = <T>(rows: ListRow[] | undefined, fallback: T[], map: (r: ListRow) => T): T[] => (rows && rows.length ? rows.map(map) : fallback);
export interface LandingCopy {
	hero: { eyebrow: string; line1: string; line2: string; body: string };
	sections: Record<string, { eyebrow: string; title: string; lede: string }>;
	rating: { value: string; note: string; count: string };
	contact: { facebookHandle: string; facebookUrl: string; founderEmail: string };
}
export const COPY_DEFAULTS: LandingCopy = {
	hero: { eyebrow: HERO.eyebrow, line1: HERO.lines[0], line2: HERO.lines[1], body: HERO.body },
	sections: {},
	rating: { value: RATING.value, note: RATING.note, count: RATING.count },
	contact: { facebookHandle: CONTACT.facebook.handle, facebookUrl: CONTACT.facebook.url, founderEmail: CONTACT.founderEmail }
};
/** The built-in landing, for the sections that render without a page load behind them. */
export const LANDING_DEFAULTS: Pick<Landing, 'tiles' | 'sections' | 'extras' | 'testimonials' | 'laurels' | 'copy' | 'lists'> = { tiles: TILES, sections: SECTIONS, extras: { team: VIDEO.team, delivery: VIDEO.delivery, closing: VIDEO.closing }, testimonials: TESTIMONIALS, laurels: LAURELS, copy: COPY_DEFAULTS, lists: EMPTY_LISTS };

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
		})(),
		testimonials: Array.isArray(film?.testimonials)
			? (film!.testimonials as unknown[]).map((t) => { const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>; const photo = typeof x.photo === 'string' && /^(\/|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/|https:\/\/images\.pexels\.com\/)/i.test(x.photo) ? x.photo : ''; return { quote: str(x.quote, ''), name: str(x.name, ''), role: str(x.role, ''), photo }; }).filter((t) => t.quote && t.name).slice(0, 8)
			: TESTIMONIALS,
		laurels: Array.isArray(film?.laurels)
			? (film!.laurels as unknown[]).map((l) => { const x = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>; return { value: str(x.value, ''), label: str(x.label, '') }; }).filter((l) => l.value && l.label).slice(0, 6)
			: LAURELS,
		lists: (() => {
			const l = (film?.lists && typeof film.lists === 'object' ? film.lists : {}) as Record<string, unknown>;
			const out = { ...EMPTY_LISTS };
			for (const k of Object.keys(EMPTY_LISTS) as ListKey[]) {
				const arr = Array.isArray(l[k]) ? (l[k] as unknown[]) : [];
				out[k] = arr.map((x) => { const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>; return { a: str(o.a, ''), b: str(o.b, ''), c: str(o.c, '') }; }).filter((x) => x.a).slice(0, 12);
			}
			return out;
		})(),
		copy: (() => {
			const c = (film?.copy && typeof film.copy === 'object' ? film.copy : {}) as Record<string, unknown>;
			const o = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
			const h = o(c.hero), rt = o(c.rating), ct = o(c.contact), secs = o(c.sections);
			const d = COPY_DEFAULTS;
			return {
				hero: { eyebrow: str(h.eyebrow, d.hero.eyebrow), line1: str(h.line1, d.hero.line1), line2: str(h.line2, d.hero.line2), body: str(h.body, d.hero.body) },
				sections: Object.fromEntries(Object.entries(secs).map(([k, v]) => { const x = o(v); return [k, { eyebrow: str(x.eyebrow, ''), title: str(x.title, ''), lede: str(x.lede, '') }]; })),
				rating: { value: typeof rt.value === 'string' ? rt.value : d.rating.value, note: str(rt.note, d.rating.note), count: str(rt.count, d.rating.count) },
				contact: { facebookHandle: str(ct.facebookHandle, d.contact.facebookHandle), facebookUrl: typeof ct.facebookUrl === 'string' && /^https:\/\/(www\.)?facebook\.com\//i.test(ct.facebookUrl) ? ct.facebookUrl : d.contact.facebookUrl, founderEmail: str(ct.founderEmail, d.contact.founderEmail) }
			};
		})()
	};
}
