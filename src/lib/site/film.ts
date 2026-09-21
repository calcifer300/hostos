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
	/** Three more places the site plays footage: behind the Collective, on the delivery tile, behind the final ask. */
	extras: { team: string; delivery: string; closing: string };
	/** Footage on every industry tile and solution card, keyed "industry:<id>" / "solution:<id>". Empty string = no footage on that tile. */
	tiles: Record<string, string>;
	/** Every section's living background: a dimmed clip (or none) and the colour its light leans towards. */
	sections: Record<string, SectionLook>;
	/** What owners said, in their words. */
	testimonials: Testimonial[];
	/** The laurels above them: a figure and what it counts. */
	laurels: Laurel[];
	copy: LandingCopy;
}
export interface Testimonial { quote: string; name: string; role: string; photo: string }
/** The words the Founder can change without a deploy: the hero, every section's header, the trust line, how to reach him. */
export interface LandingCopy {
	hero: { eyebrow: string; line1: string; line2: string; body: string };
	sections: Record<string, { eyebrow: string; title: string; lede: string }>;
	rating: { value: string; note: string; count: string };
	contact: { facebookHandle: string; facebookUrl: string; founderEmail: string };
}
/** The words the Founder can change without a deploy: the hero, every section's header, the trust line, how to reach him. */
export interface LandingCopy {
	hero: { eyebrow: string; line1: string; line2: string; body: string };
	sections: Record<string, { eyebrow: string; title: string; lede: string }>;
	rating: { value: string; note: string; count: string };
	contact: { facebookHandle: string; facebookUrl: string; founderEmail: string };
}
/** A face: an upload in our storage, a file on the site, or a Pexels photo. */
export const isFaceSrc = (url: string): boolean => url === "" || url.startsWith("/") || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url) || /^https:\/\/images\.pexels\.com\//i.test(url);
export interface Laurel { value: string; label: string }
export interface SectionLook { clip: string; tint: string }

/** The tiles and sections the site has, with the labels the editor shows. */
export const TILE_SLOTS: { id: string; label: string }[] = [{"id":"industry:turo","label":"Turo & car rental"},{"id":"industry:doordash","label":"DoorDash & delivery"},{"id":"industry:hospitality","label":"Hospitality"},{"id":"industry:fleet","label":"Fleet operations"},{"id":"industry:property","label":"Property management"},{"id":"industry:services","label":"Professional & field services"},{"id":"industry:small","label":"Small businesses"},{"id":"industry:startups","label":"Growing startups"},{"id":"solution:va","label":"Virtual assistant solutions"},{"id":"solution:turo-ops","label":"Turo operations"},{"id":"solution:doordash-ops","label":"DoorDash operations"},{"id":"solution:consulting","label":"Business operations consulting"},{"id":"solution:webapps","label":"Custom web applications"},{"id":"solution:websites","label":"Website design & development"},{"id":"solution:crm","label":"CRM & internal tools"},{"id":"solution:dashboards","label":"Dashboard development"},{"id":"solution:automation","label":"Business process automation"},{"id":"solution:integrations","label":"API integrations"},{"id":"solution:workflow","label":"Workflow optimisation"},{"id":"solution:analytics","label":"Operational analytics"},{"id":"solution:bi","label":"Business intelligence"},{"id":"problem:1","label":"Problem 01 · the paused tablet"},{"id":"problem:2","label":"Problem 02 · the damaged car"},{"id":"problem:3","label":"Problem 03 · the unchased estimate"},{"id":"problem:4","label":"Problem 04 · the coming-soon site"},{"id":"problem:5","label":"Problem 05 · the process in one head"},{"id":"problem:6","label":"Problem 06 · the bank balance"},{"id":"pillar:people","label":"Pillar · People"},{"id":"pillar:systems","label":"Pillar · Systems"},{"id":"pillar:software","label":"Pillar · Software"},{"id":"week:1","label":"Week 1 · Map"},{"id":"week:2","label":"Week 2 · Set up"},{"id":"week:3","label":"Week 3 · Run alongside"},{"id":"week:4","label":"Week 4 · Hand you the board"},{"id":"proof:1","label":"Proof · claims"},{"id":"proof:2","label":"Proof · reply time"},{"id":"proof:3","label":"Proof · verticals"}];
export const SECTION_SLOTS: { id: string; label: string }[] = [{"id":"problems","label":"The problems"},{"id":"how","label":"How HostOS works"},{"id":"film","label":"Watch it run"},{"id":"before-after","label":"Before and after"},{"id":"solutions","label":"Solutions"},{"id":"industries","label":"Industries"},{"id":"proof","label":"Proof"},{"id":"platform","label":"The platform"},{"id":"start","label":"The first thirty days"},{"id":"faq","label":"FAQ"},{"id":"why","label":"Why HostOS Collective"},{"id":"devices","label":"HostOS on every screen"},{"id":"collective","label":"The Collective"},{"id":"voices","label":"What owners say"}];

export const FILM_KEY = "landing_film";

/** Pexels clips (free licence) until the company's own footage is uploaded. */
const clip = (id: number, fps: number) => `https://videos.pexels.com/video-files/${id}/${id}-sd_960_540_${fps}fps.mp4`;

export const DEFAULT_FILM: LandingFilm = {
	hero: { src: clip(5834188, 24) },
	extras: { team: clip(8865706, 25), delivery: clip(4168426, 25), closing: clip(8064422, 30) },
	tiles: {"industry:turo": clip(4208203, 24),"industry:doordash": clip(4168426, 25),"industry:hospitality": clip(7820478, 25),"industry:fleet": clip(5834188, 24),"industry:property": clip(4877217, 30),"industry:services": clip(8986482, 30),"industry:small": clip(7697073, 30),"industry:startups": clip(8266178, 25),"solution:va": clip(8865706, 25),"solution:turo-ops": clip(4208203, 24),"solution:doordash-ops": clip(7362583, 24),"solution:consulting": clip(7413764, 24),"solution:webapps": clip(854053, 25),"solution:websites": clip(4177954, 30),"solution:crm": clip(8632602, 25),"solution:dashboards": clip(8064422, 30),"solution:automation": clip(8094279, 25),"solution:integrations": clip(20693196, 25),"solution:workflow": clip(8986890, 30),"solution:analytics": clip(6868699, 30),"solution:bi": clip(6685171, 30),"problem:1": clip(8094279, 25),"problem:2": clip(4208203, 24),"problem:3": clip(3986119, 25),"problem:4": clip(4177954, 30),"problem:5": clip(7413764, 24),"problem:6": clip(8064422, 30),"pillar:people": clip(8865706, 25),"pillar:systems": clip(7413764, 24),"pillar:software": clip(8480293, 25),"week:1": clip(7413764, 24),"week:2": clip(8266178, 25),"week:3": clip(8865706, 25),"week:4": clip(6868699, 30),"proof:1": clip(4208203, 24),"proof:2": clip(3986119, 25),"proof:3": clip(8064422, 30)},
	testimonials: [{"quote":"HostOS Collective completely transformed how we handle online orders. Our operations are smoother, and we’ve seen a 30% boost in repeat customers since launching the new system.","name":"Zack Holmes","role":"Restaurant owner","photo":"/faces/3760046.jpg"},{"quote":"From building our website to setting up automated email campaigns, HostOS Collective delivered everything on time and on budget. Truly a one-stop shop for growing businesses.","name":"Miguel Chavez","role":"E-commerce startup","photo":"/faces/2379004.jpg"},{"quote":"Having a dedicated VA team that manages my fleet bookings and guest communication has been a game changer. Professional, reliable, and always responsive.","name":"Matt Tolley","role":"Turo host","photo":"/faces/6333501.jpg"}],
	copy: {
		hero: { eyebrow: "For car rental fleets · restaurants · field services · shops", line1: "Run the business.", line2: "We’ll run the *operations*.", body: "A trained team, written procedures and one live board — answering your guests and customers, watching your tablets, filing your claims and chasing your estimates. You keep the business. We carry the operations." },
		sections: {},
		rating: { value: "5.0", note: "from the owners we work with", count: "50+ clients served" },
		contact: { facebookHandle: "@bimbeez", facebookUrl: "https://www.facebook.com/bimbeez", founderEmail: "johnbriones774@gmail.com" },
	},
	laurels: [{"value":"98%","label":"client satisfaction"},{"value":"50+","label":"clients served"},{"value":"120+","label":"projects delivered"},{"value":"10+","label":"years in operations"},{"value":"5+ yrs","label":"BPO experience per operator"}],
	sections: { "problems": { clip: clip(8094279, 25), tint: "#ff375f" }, "how": { clip: clip(7413764, 24), tint: "#3b9cff" }, "film": { clip: "", tint: "#8b7cff" }, "before-after": { clip: clip(8064422, 30), tint: "#30d158" }, "solutions": { clip: "", tint: "#3b9cff" }, "industries": { clip: "", tint: "#ff9f0a" }, "proof": { clip: clip(6868699, 30), tint: "#40c8e0" }, "platform": { clip: clip(3986119, 25), tint: "#af52de" }, "start": { clip: clip(8266178, 25), tint: "#3b9cff" }, "faq": { clip: "", tint: "#8b7cff" }, "why": { clip: clip(8865706, 25), tint: "#ff9f0a" }, "devices": { clip: "", tint: "#3b9cff" }, "collective": { clip: "", tint: "#8b7cff" }, "voices": { clip: "", tint: "#3b9cff" } },
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
	const ex = (r.extras && typeof r.extras === "object" ? r.extras : {}) as Record<string, unknown>;
	const extra = (k: keyof LandingFilm["extras"]) => { const s = str(ex[k], DEFAULT_FILM.extras[k], 600); return isFilmSrc(s) ? s : DEFAULT_FILM.extras[k]; };
	const tilesRaw = (r.tiles && typeof r.tiles === "object" ? r.tiles : {}) as Record<string, unknown>;
	const tiles: Record<string, string> = {};
	for (const { id } of TILE_SLOTS) { const v = tilesRaw[id]; tiles[id] = typeof v === "string" ? (v === "" || isFilmSrc(v) ? v.slice(0, 600) : DEFAULT_FILM.tiles[id]) : DEFAULT_FILM.tiles[id]; }
	const secRaw = (r.sections && typeof r.sections === "object" ? r.sections : {}) as Record<string, unknown>;
	const sections: Record<string, SectionLook> = {};
	for (const { id } of SECTION_SLOTS) {
		const d = DEFAULT_FILM.sections[id];
		const s = (secRaw[id] && typeof secRaw[id] === "object" ? secRaw[id] : {}) as Record<string, unknown>;
		const c = typeof s.clip === "string" ? s.clip.slice(0, 600) : d.clip;
		const t = typeof s.tint === "string" && /^#[0-9a-f]{6}$/i.test(s.tint) ? s.tint.toLowerCase() : d.tint;
		sections[id] = { clip: c === "" || isFilmSrc(c) ? c : d.clip, tint: t };
	}
	const tRaw = Array.isArray(r.testimonials) ? r.testimonials : null;
	const testimonials = tRaw
		? tRaw.slice(0, 8).map((t) => { const x = (t && typeof t === "object" ? t : {}) as Record<string, unknown>; const photo = str(x.photo, "", 600); return { quote: str(x.quote, "", 400), name: str(x.name, "", 60), role: str(x.role, "", 60), photo: isFaceSrc(photo) ? photo : "" }; }).filter((t) => t.quote && t.name)
		: DEFAULT_FILM.testimonials;
	const lRaw = Array.isArray(r.laurels) ? r.laurels : null;
	const laurels = lRaw
		? lRaw.slice(0, 6).map((l) => { const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>; return { value: str(x.value, "", 12), label: str(x.label, "", 40) }; }).filter((l) => l.value && l.label)
		: DEFAULT_FILM.laurels;
	const cRaw = (r.copy && typeof r.copy === "object" ? r.copy : {}) as Record<string, unknown>;
	const dc = DEFAULT_FILM.copy;
	const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
	const h = obj(cRaw.hero), rt = obj(cRaw.rating), ct = obj(cRaw.contact), secs = obj(cRaw.sections);
	const copy: LandingCopy = {
		hero: { eyebrow: str(h.eyebrow, dc.hero.eyebrow, 120), line1: str(h.line1, dc.hero.line1, 80), line2: str(h.line2, dc.hero.line2, 80), body: str(h.body, dc.hero.body, 400) },
		sections: Object.fromEntries(Object.entries(secs).map(([k, v]) => { const o = obj(v); return [k.slice(0, 32), { eyebrow: str(o.eyebrow, "", 80), title: str(o.title, "", 140), lede: str(o.lede, "", 300) }]; }).filter(([k]) => k)),
		rating: { value: str(rt.value, dc.rating.value, 8), note: str(rt.note, dc.rating.note, 80), count: str(rt.count, dc.rating.count, 40) },
		contact: { facebookHandle: str(ct.facebookHandle, dc.contact.facebookHandle, 40), facebookUrl: (() => { const u = str(ct.facebookUrl, dc.contact.facebookUrl, 200); return /^https:\/\/(www\.)?facebook\.com\//i.test(u) ? u : dc.contact.facebookUrl; })(), founderEmail: (() => { const e = str(ct.founderEmail, dc.contact.founderEmail, 120); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : dc.contact.founderEmail; })() },
	};
	return { hero: { src: isFilmSrc(heroSrc) ? heroSrc : DEFAULT_FILM.hero.src }, chapters, extras: { team: extra("team"), delivery: extra("delivery"), closing: extra("closing") }, tiles, sections, testimonials, laurels, copy };
}
