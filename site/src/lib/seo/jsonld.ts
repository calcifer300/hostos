import { CONTACT, FAQ, SITE, SOLUTIONS } from '$lib/content/site';
import type { Member } from '$lib/content/team';

/** Organization + FAQPage + the people, for search engines. Escaped so it can sit inline. */
export function jsonLd(members: Member[]): string {
	const org = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': `${SITE.url}/#org`,
				name: SITE.company,
				url: SITE.url,
				logo: `${SITE.url}/icon.svg`,
				email: SITE.email,
				telephone: SITE.phone,
				description: SITE.description,
				areaServed: ['US', 'PH', 'CA', 'AU', 'GB'],
				address: { '@type': 'PostalAddress', addressCountry: 'PH' },
				founder: { '@id': `${SITE.url}/#founder` },
				sameAs: [CONTACT.facebook.url],
				knowsAbout: ['virtual assistant agency', 'business operations outsourcing', 'Turo fleet management', 'DoorDash restaurant operations', 'field service dispatch', 'custom web applications', 'business process automation'],
				member: members.map((m) => ({ '@type': 'Person', name: m.name, alternateName: m.nickname, jobTitle: m.title, image: m.photo.startsWith('/') ? SITE.url + m.photo : m.photo }))
			},
			{
				'@type': 'Person',
				'@id': `${SITE.url}/#founder`,
				name: CONTACT.founder,
				alternateName: ['John Briones', 'bimbeez'],
				jobTitle: 'Founder',
				worksFor: { '@id': `${SITE.url}/#org` },
				url: `${SITE.url}/team`,
				sameAs: [CONTACT.facebook.url],
				nationality: 'Philippines'
			},
			{
				'@type': 'WebSite',
				'@id': `${SITE.url}/#site`,
				url: SITE.url,
				name: SITE.company,
				publisher: { '@id': `${SITE.url}/#org` },
				inLanguage: 'en'
			},
			...SOLUTIONS.families.flatMap((f) => f.items.map((s) => ({ '@type': 'Service', name: s.name, description: s.outcome, provider: { '@id': `${SITE.url}/#org` }, areaServed: ['US', 'PH'], serviceType: f.name }))),
			{
				'@type': 'FAQPage',
				mainEntity: FAQ.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
			}
		]
	};
	return JSON.stringify(org).replace(/</g, '\u003c');
}
