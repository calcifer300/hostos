/**
 * The roster, as the landing page shows it. The source of truth is the
 * app's public endpoint (/api/public/team, edited by the Founder in
 * HostOS); this list is the fallback at build time and the shape the page
 * expects. Photos are the portraits published with the app.
 */
export interface Member {
	slug: string;
	name: string;
	nickname: string;
	title: string;
	hue: string;
	photo: string;
	founder: boolean;
}

const photo = (slug: string) => `/team/${slug}.jpg`;

export const TEAM: Member[] = [
	{ slug: 'john', name: 'John Briones', nickname: 'John', title: 'Founder & CEO', hue: '#0a84ff', photo: photo('john'), founder: true },
	{ slug: 'karl', name: 'Karl Rodriguez', nickname: 'Karl', title: 'Chief Technology Officer', hue: '#8b7cff', photo: photo('karl'), founder: false },
	{ slug: 'gerald', name: 'Gerald Ramirez', nickname: 'Gerald', title: 'Director of Operations', hue: '#30d158', photo: photo('gerald'), founder: false },
	{ slug: 'belle', name: 'Maribel Magbual', nickname: 'Belle', title: 'Director of Finance', hue: '#f5b301', photo: photo('belle'), founder: false },
	{ slug: 'devie', name: 'John Devie Ulanday', nickname: 'Devie', title: 'Director of Marketing & Growth', hue: '#ff9f0a', photo: photo('devie'), founder: false },
	{ slug: 'red', name: 'Givhine Leosala', nickname: 'Red', title: 'Director of Sales & Partnerships', hue: '#ff375f', photo: photo('red'), founder: false },
	{ slug: 'loisa', name: 'Loisa Celetaria', nickname: 'Loisa', title: 'Director of Content & Communications', hue: '#40c8e0', photo: photo('loisa'), founder: false },
	{ slug: 'princess', name: 'Princess Vergara', nickname: 'Princess', title: 'Director of Operations Support & Scheduling', hue: '#5ac8fa', photo: photo('princess'), founder: false },
	{ slug: 'karu', name: 'John Reigner Karunaratne', nickname: 'Karu', title: 'Strategy & Innovation Specialist', hue: '#af52de', photo: photo('karu'), founder: false },
	{ slug: 'david', name: 'David Briones', nickname: 'David', title: 'Research & Data Operations Specialist', hue: '#1bdbdb', photo: photo('david'), founder: false },
	{ slug: 'ayie', name: 'Mariel Briones', nickname: 'Ayie', title: 'Client Support Specialist', hue: '#c58a4f', photo: photo('ayie'), founder: false },
	{ slug: 'jb', name: 'Jasper Briones', nickname: 'JB', title: 'Project & People Coordinator', hue: '#ff6b6b', photo: photo('jb'), founder: false }
];

/** Whatever the app answers, made whole against the fallback. */
export function normalizeTeam(raw: unknown): Member[] {
	if (!Array.isArray(raw) || raw.length === 0) return TEAM;
	const out: Member[] = [];
	for (const r of raw) {
		if (!r || typeof r !== 'object') continue;
		const x = r as Record<string, unknown>;
		const slug = typeof x.slug === 'string' ? x.slug : '';
		const name = typeof x.name === 'string' ? x.name : '';
		if (!slug || !name) continue;
		const fallback = TEAM.find((t) => t.slug === slug);
		out.push({
			slug,
			name,
			nickname: typeof x.nickname === 'string' && x.nickname ? x.nickname : name.split(/\s+/)[0],
			title: typeof x.title === 'string' ? x.title : (fallback?.title ?? ''),
			hue: typeof x.hue === 'string' && /^#[0-9a-f]{6}$/i.test(x.hue) ? x.hue : (fallback?.hue ?? '#3b9cff'),
			photo: typeof x.photoUrl === 'string' && x.photoUrl ? x.photoUrl : (fallback?.photo ?? photo(slug)),
			founder: Boolean(x.founder ?? fallback?.founder)
		});
	}
	return out.length ? out : TEAM;
}
