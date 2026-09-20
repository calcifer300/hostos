import { FAQ, SITE } from '$lib/content/site';
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
				areaServed: ['PH', 'US', 'CA', 'AU', 'GB'],
				member: members.map((m) => ({ '@type': 'Person', name: m.name, alternateName: m.nickname, jobTitle: m.title, image: m.photo.startsWith('/') ? SITE.url + m.photo : m.photo }))
			},
			{
				'@type': 'FAQPage',
				mainEntity: FAQ.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
			}
		]
	};
	return JSON.stringify(org).replace(/</g, '\u003c');
}
