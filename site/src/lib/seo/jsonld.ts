import { CONTACT, FAQ, SITE, SOLUTIONS } from '$lib/content/site';
import type { Member } from '$lib/content/team';

/** Organization + FAQPage + the people, for search engines. Escaped so it can sit inline. */
export function jsonLd(members: Member[], faq: { q: string; a: string }[] = FAQ.items): string {
	const org = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['Organization', 'ProfessionalService'],
				'@id': `${SITE.url}/#org`,
				name: SITE.company,
				url: SITE.url,
				logo: { '@type': 'ImageObject', url: `${SITE.url}/icon-512.png`, width: 512, height: 512 },
				image: `${SITE.url}/icon-512.png`,
				email: SITE.email,
				telephone: SITE.phone,
				description: SITE.description,
				areaServed: ['US', 'PH', 'CA', 'AU', 'GB'],
				address: { '@type': 'PostalAddress', addressCountry: 'PH' },
				slogan: SITE.tagline,
				contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: SITE.email, telephone: SITE.phone, availableLanguage: ['English', 'Filipino'] },
				founder: { '@id': `${SITE.url}/#founder` },
				sameAs: [CONTACT.facebook.url],
				knowsAbout: ['virtual assistant agency', 'business operations outsourcing', 'Turo fleet management', 'DoorDash restaurant operations', 'field service dispatch', 'custom web applications', 'business process automation'],
				member: members.map((m) => ({ '@type': 'Person', name: m.name, alternateName: m.nickname, jobTitle: m.title, image: m.photo.startsWith('/') ? SITE.url + m.photo : m.photo }))
			},
			{
				'@type': 'Person',
				'@id': `${SITE.url}/#founder`,
				name: CONTACT.founder,
				alternateName: ['John Briones', 'bimbeez96'],
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
			{
				'@type': 'WebPage',
				'@id': `${SITE.url}/#page`,
				url: `${SITE.url}/`,
				name: `${SITE.company} — VA agency & business operations, Philippines`,
				description: SITE.description,
				isPartOf: { '@id': `${SITE.url}/#site` },
				about: { '@id': `${SITE.url}/#org` },
				primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE.url}/opengraph-image` },
				inLanguage: 'en',
				// the lines an assistant should read aloud: the page title and the first answer on the page
				speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '#faq'] }
			},
			...SOLUTIONS.families.flatMap((f) => f.items.map((s) => ({ '@type': 'Service', name: s.name, description: s.outcome, provider: { '@id': `${SITE.url}/#org` }, areaServed: ['US', 'PH'], serviceType: f.name }))),
			{
				'@type': 'FAQPage',
				mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
			}
		]
	};
	return JSON.stringify(org).replace(/</g, '\u003c');
}
