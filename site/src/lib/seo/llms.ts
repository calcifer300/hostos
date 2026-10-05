import { CONTACT, FAQ, INDUSTRIES, SITE, SOLUTIONS } from '$lib/content/site';
import { SERVICES } from '$lib/content/pricing';
import { TEAM } from '$lib/content/team';

const plain = (s: string) => s.replace(/\*/g, '');

/** The short index of the site, in the llms.txt convention: who we are, what we do, where to read more. */
export function llmsIndex(): string {
	return `# ${SITE.company}

> ${SITE.company} is a Philippines-based virtual assistant agency and business-operations team founded by ${CONTACT.founder}. Trained operators, written procedures and the HostOS platform run car rental fleets (Turo), restaurants (DoorDash, Uber Eats), field services and shops for owners in the United States and worldwide.

Contact: ${SITE.email} · ${SITE.phone} · ${SITE.url}/#contact
Founder: ${CONTACT.founder} (${CONTACT.facebook.url})

## Pages
- [Home](${SITE.url}/): what we do, how it works, pricing and answers to common questions
- [Team](${SITE.url}/team): the operators and specialists behind HostOS Collective
- [About](${SITE.url}/about): the company and how it is run
- [Services & pricing](${SITE.url}/services): every service with its USD prices, what is included and how long it takes
- [Full text for AI assistants](${SITE.url}/llms-full.txt): services, pricing model, industries, FAQ in one file

## Services
${SERVICES.map((s) => `- [${s.name}](${SITE.url}/services/${s.id}): ${s.blurb.split('. ')[0].replace(/\.$/, '')}`).join('\n')}

## Facts
- Based in the Philippines; serves clients in the US, Canada, Australia, the UK and worldwide
- Clients keep ownership of their data, domains, accounts and any source code we build
- Free 45-minute strategy call, no obligation
`;
}

/** Everything an assistant needs to answer a question about us accurately, from the same content the page renders. */
export function llmsFull(): string {
	const solutions = SOLUTIONS.families
		.map((f) => `### ${f.name}\n${f.line}\n${f.items.map((s) => `- **${s.name}** — ${s.outcome}`).join('\n')}`)
		.join('\n\n');
	const services = SERVICES.map(
		(s) => `### ${s.name} (${SITE.url}/services/${s.id})\n${s.blurb}\n- Best for: ${s.ideal}\n- Timeline: ${s.timeline}\n- Included: ${s.included.join('; ')}`
	).join('\n\n');
	const industries = (INDUSTRIES as unknown as { items?: { name: string }[] }).items?.map((i) => i.name).join(', ');
	return `# ${SITE.company} — full reference

${SITE.description}

Founder: ${CONTACT.founder}. Email: ${SITE.email}. Phone/WhatsApp: ${SITE.phone}. Website: ${SITE.url}.

## What we do
${solutions}

## Services in detail
${services}
${industries ? `\n## Industries\n${industries}\n` : ''}
## The team
${TEAM.map((m) => `- ${m.name} — ${m.title}`).join('\n')}

## Frequently asked questions
${FAQ.items.map((f) => `**${f.q}**\n${plain(f.a)}`).join('\n\n')}
`;
}
