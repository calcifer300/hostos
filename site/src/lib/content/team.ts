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
	/** "x% y%" — where the portrait is centred in its circle. */
	focus: string;
	founder: boolean;
}

const photo = (slug: string) => `/team/${slug}.jpg`;

export const TEAM: Member[] = [
	{ slug: 'john', name: 'John Briones', nickname: 'John', title: 'Founder', hue: '#0a84ff', photo: photo('john'), focus: '50% 30%', founder: true },
	{ slug: 'karl', name: 'Karl Rodriguez', nickname: 'Karl', title: 'Platform Development', hue: '#8b7cff', photo: photo('karl'), focus: '50% 30%', founder: false },
	{ slug: 'gerald', name: 'Gerald Ramirez', nickname: 'Gerald', title: 'Fleet Operations', hue: '#30d158', photo: photo('gerald'), focus: '50% 30%', founder: false },
	{ slug: 'belle', name: 'Maribel Magbual', nickname: 'Belle', title: 'Finance & Admin', hue: '#f5b301', photo: photo('belle'), focus: '50% 30%', founder: false },
	{ slug: 'devie', name: 'John Devie Ulanday', nickname: 'Devie', title: 'Growth', hue: '#ff9f0a', photo: photo('devie'), focus: '50% 30%', founder: false },
	{ slug: 'red', name: 'Givhine Leosala', nickname: 'Red', title: 'Partnerships', hue: '#ff375f', photo: photo('red'), focus: '50% 30%', founder: false },
	{ slug: 'loisa', name: 'Loisa Celetaria', nickname: 'Loisa', title: 'Brand & Content', hue: '#40c8e0', photo: photo('loisa'), focus: '50% 30%', founder: false },
	{ slug: 'princess', name: 'Princess Vergara', nickname: 'Princess', title: 'Customer Experience', hue: '#5ac8fa', photo: photo('princess'), focus: '50% 30%', founder: false },
	{ slug: 'karu', name: 'John Reigner Karunaratne', nickname: 'Karu', title: 'Product Strategy', hue: '#af52de', photo: photo('karu'), focus: '50% 30%', founder: false },
	{ slug: 'david', name: 'David Briones', nickname: 'David', title: 'Research & Analytics', hue: '#1bdbdb', photo: photo('david'), focus: '50% 30%', founder: false },
	{ slug: 'ayie', name: 'Mariel Briones', nickname: 'Ayie', title: 'Client Experience', hue: '#c58a4f', photo: photo('ayie'), focus: '50% 30%', founder: false },
	{ slug: 'jb', name: 'Jasper Briones', nickname: 'JB', title: 'Project Operations', hue: '#ff6b6b', photo: photo('jb'), focus: '50% 30%', founder: false }
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
			focus: typeof x.photoFocus === 'string' && /^\d{1,3}% \d{1,3}%$/.test(x.photoFocus) ? x.photoFocus : (fallback?.focus ?? '50% 30%'),
			founder: Boolean(x.founder ?? fallback?.founder)
		});
	}
	return out.length ? out : TEAM;
}
