import { CUSTOM_LINE, type Service } from '$lib/content/pricing';
import { FAQ, SITE } from '$lib/content/site';

/**
 * Everything a service page says about itself, derived from the service the
 * Founder wrote (prices, inclusions, timeline) so the page, its schema and its
 * answers can never disagree with the pricing section on the home page.
 */

/** What people type when they are looking for this, where it differs from the plain name. */
const HEADLINES: Record<string, string> = {
	operations: 'Virtual assistant & operations team',
	web: 'Web development for small businesses',
	apps: 'App development for small businesses',
	ai: 'AI automation for small businesses',
	crm: 'CRM setup & automations',
	seo: 'Local SEO & marketing',
	design: 'Branding & UI/UX design',
	custom: 'Custom software development'
};

export const servicePath = (id: string) => `/services/${id}`;
export const headline = (s: Service) => HEADLINES[s.id] ?? s.name;

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
/** The numeric dollar amount a tier leads with, or null for "Custom quote". */
const amount = (price: string) => {
	const m = /^\$([\d,]+(?:\.\d+)?)/.exec(price.trim());
	return m ? Number(m[1].replace(/,/g, '')) : null;
};
const suffix = (t: { period: string }) => (t.period ? (t.period.startsWith('/') ? t.period : ` ${t.period}`) : '');

/** "From $1,490/mo", or null when every tier is a quote. */
export function fromPrice(s: Service): string | null {
	const priced = s.tiers.map((t) => ({ t, n: amount(t.price) })).filter((x): x is { t: Service['tiers'][number]; n: number } => x.n !== null);
	if (!priced.length) return null;
	const low = priced.reduce((a, b) => (b.n < a.n ? b : a));
	return `From ${usd(low.n)}${suffix(low.t)}`;
}

const firstSentence = (text: string) => (text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text).trim();
const clip = (text: string, max: number) => {
	if (text.length <= max) return text;
	const cut = text.slice(0, max - 1);
	return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

export const titleFor = (s: Service) => clip(`${headline(s)} | ${SITE.company}`, 62);

export function descriptionFor(s: Service): string {
	const from = fromPrice(s);
	return clip(`${firstSentence(s.blurb)} ${from ? `${from}. ` : ''}${s.timeline ? `${s.timeline}. ` : ''}From the Philippines, for US and worldwide businesses.`, 158);
}

/** Questions owners actually ask, answered from the service's own fields. */
export function faqFor(s: Service): { q: string; a: string }[] {
	const out: { q: string; a: string }[] = [];
	const tiers = s.tiers.filter((t) => t.name && t.price);
	if (tiers.length) {
		const lines = tiers.map((t) => `${t.name}: ${t.price}${suffix(t)}${t.note ? ` (${t.note})` : ''}`).join('. ');
		out.push({ q: `How much does ${s.name.toLowerCase()} cost?`, a: `${lines}. ${s.model === 'custom' ? `${CUSTOM_LINE} ` : ''}${s.why} All prices are in USD.`.trim() });
	}
	if (s.included.length) out.push({ q: `What is included in ${s.name.toLowerCase()}?`, a: `${s.included.join('. ')}.` });
	if (s.ideal) out.push({ q: `Who is ${s.name.toLowerCase()} for?`, a: `${s.ideal}.` });
	if (s.timeline) out.push({ q: `How long does ${s.name.toLowerCase()} take?`, a: `${s.timeline}.` });
	if (s.deliverables.length) out.push({ q: `What do I get at the end?`, a: `${s.deliverables.join(', ')}.` });
	if (s.support) out.push({ q: `What support do I get after launch?`, a: s.support });
	const own = FAQ.items.find((f) => /own/i.test(f.q));
	if (own) out.push(own);
	return out;
}

/** Service + offers, the questions, and the breadcrumb trail, for one service page. */
export function serviceLd(s: Service): string {
	const url = `${SITE.url}${servicePath(s.id)}`;
	const offers = s.tiers
		.map((t) => ({ t, n: amount(t.price) }))
		.filter((x) => x.n !== null)
		.map(({ t, n }) => ({
			'@type': 'Offer',
			name: t.name,
			description: t.note || undefined,
			price: n,
			priceCurrency: 'USD',
			url,
			priceSpecification: t.period.startsWith('/mo') ? { '@type': 'UnitPriceSpecification', price: n, priceCurrency: 'USD', unitText: 'MONTH' } : undefined
		}));
	const graph = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Service',
				'@id': `${url}#service`,
				name: s.name,
				description: s.blurb,
				url,
				serviceType: headline(s),
				provider: { '@type': 'Organization', '@id': `${SITE.url}/#org`, name: SITE.company, url: SITE.url },
				areaServed: ['US', 'PH', 'CA', 'AU', 'GB'],
				audience: s.ideal ? { '@type': 'Audience', audienceType: s.ideal } : undefined,
				offers: offers.length ? offers : undefined
			},
			{
				'@type': 'FAQPage',
				mainEntity: faqFor(s).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
			},
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
					{ '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE.url}/services` },
					{ '@type': 'ListItem', position: 3, name: s.name, item: url }
				]
			}
		]
	};
	return JSON.stringify(graph).replace(/</g, '\\u003c');
}

/** The services index: an ItemList of every service page. */
export function servicesIndexLd(services: Service[]): string {
	return JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'CollectionPage', '@id': `${SITE.url}/services#page`, url: `${SITE.url}/services`, name: `Services — ${SITE.company}`, isPartOf: { '@id': `${SITE.url}/#site` }, about: { '@id': `${SITE.url}/#org` } },
			{ '@type': 'ItemList', itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE.url}${servicePath(s.id)}` })) },
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
					{ '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE.url}/services` }
				]
			}
		]
	}).replace(/</g, '\\u003c');
}
