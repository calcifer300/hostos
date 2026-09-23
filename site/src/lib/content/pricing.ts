/**
 * Services and pricing. Benchmarked against agencies serving US small
 * businesses from the Philippines and abroad (2025–26): dedicated VAs at
 * $1,200–2,000 a month, 24/7 support teams at $3,000–6,000, small business
 * sites at $1,500–8,000, automation retainers at $300–1,000, local SEO at
 * $500–2,000, brand identity at $1,500–5,000. HostOS sits premium-but-
 * accessible: below US agencies, above marketplace freelancers, and every
 * price names what it includes. Anything custom is a quote, never a number.
 * The Founder edits all of it at Settings → Website → Services & pricing.
 */
export type PriceModel = 'monthly' | 'one-time' | 'hourly' | 'custom';
export interface PriceTier { name: string; price: string; period: string; note: string }
export interface Service {
	id: string;
	name: string;
	blurb: string;
	stack: string[];
	included: string[];
	deliverables: string[];
	ideal: string;
	timeline: string;
	model: PriceModel;
	tiers: PriceTier[];
	support: string;
	why: string;
}

export const CUSTOM_LINE = 'Custom pricing based on scope, technical requirements, integrations, complexity, timeline and business goals.';

export const PRICING = {
	eyebrow: 'Services & pricing',
	title: 'Clear prices. *No surprises.*',
	lede: 'Every price shows exactly what is included. Custom work is quoted after we understand the scope. The strategy call is free either way.'
};

export const SERVICES: Service[] = [
	{
		id: 'operations',
		name: 'Business Operations',
		blurb: 'Trained operators handle your phone, email, chat and delivery tablets, following procedures written for your business. For owners who want the daily work handled without hiring and managing staff.',
		stack: ['HostOS board', 'Google Workspace', 'Turo & DoorDash dashboards', 'Zendesk / Front', 'Slack & WhatsApp', 'Written SOPs'],
		included: ['Operators trained by the Founder, 5+ years of experience each', 'Procedures written for your business, one page each', 'A team that covers for each other, never a single person', 'Weekly numbers, monthly review', 'Quality checks on every conversation'],
		deliverables: ['Your HostOS workspace and board', 'SOP library', 'Weekly report', 'Named lead operator'],
		ideal: 'Fleet, restaurant, field-service and shop owners with an inbox that never sleeps',
		timeline: 'Live within 30 days',
		model: 'monthly',
		tiers: [
			{ name: 'Starter', price: '$1,490', period: '/mo', note: 'One dedicated operator · 40 hrs/wk · your hours' },
			{ name: 'Growth', price: '$2,890', period: '/mo', note: 'Two operators · 80 hrs/wk · cover for time off' },
			{ name: 'Around the clock', price: '$5,900', period: '/mo', note: '24/7 team coverage · lead operator · weekly review' }
		],
		support: 'Included. Add hours at $12/hr.',
		why: 'A US hire for the same coverage costs $3,500–4,500 a month before benefits. Freelancers cost less but bring no cover, no procedures and no dashboard. This sits in between and includes all three.'
	},
	{
		id: 'web',
		name: 'Web Development',
		blurb: 'A fast website that customers can find on Google and use to book, get a quote or ask a question. Built on the same technology HostOS runs on, and owned by you.',
		stack: ['SvelteKit', 'Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'PostgreSQL / Supabase', 'REST APIs', 'Vercel', 'Cloudflare'],
		included: ['Designed and built in-house', 'Mobile-first and tested for speed', 'Booking, quote or contact forms', 'Set up to rank on Google', 'Your domain, your accounts, your code'],
		deliverables: ['Live site on your domain', 'Source repository', 'Editing guide', '30 days of fixes'],
		ideal: 'Shops, clinics, trades, agencies and fleets that need to be found and booked online',
		timeline: '2–6 weeks',
		model: 'one-time',
		tiers: [
			{ name: 'Starter', price: '$1,900', period: 'one-time', note: 'Up to 5 pages · booking or contact form · SEO basics' },
			{ name: 'Professional', price: '$4,500', period: 'one-time', note: 'Up to 12 pages · integrations · CMS · analytics' },
			{ name: 'Enterprise', price: 'Custom quote', period: '', note: 'Multi-location, portals, e-commerce' }
		],
		support: 'Optional care plan from $190/mo — hosting, updates, small changes.',
		why: 'US agencies charge $5,000–15,000 for the Professional tier. Template builders charge less and leave you with a template. This is custom work at Philippine cost.'
	},
	{
		id: 'apps',
		name: 'App Development',
		blurb: 'Apps that install on any phone or computer, work offline and sign users in — for the tools your business needs but cannot buy off the shelf.',
		stack: ['Progressive Web Apps', 'React / SvelteKit', 'TypeScript', 'Supabase auth & database', 'Push notifications', 'Responsive UI', 'API integrations'],
		included: ['Discovery and scope', 'Screen design', 'Sign-in and user roles', 'Connections to the tools you already use', 'Testing on real devices'],
		deliverables: ['Installable app on iPhone, Android, Mac and Windows', 'Admin dashboard', 'Source and documentation'],
		ideal: 'Businesses that have outgrown spreadsheets and need one tool built around their workflow',
		timeline: '6–12 weeks',
		model: 'custom',
		tiers: [{ name: 'From', price: '$6,500', period: 'one-time', note: 'Starting point for a focused app; the rest is a quote' }],
		support: 'Optional from $390/mo — monitoring, updates, small features.',
		why: 'Custom software is priced on scope. We give you a starting price so you can plan, then quote the rest after the free strategy call.'
	},
	{
		id: 'ai',
		name: 'AI Automation',
		blurb: 'AI where it helps, humans where it matters. Assistants that draft replies, sort requests, send follow-ups and summarize the week — always checked by your operators.',
		stack: ['OpenAI & Claude APIs', 'Workflow automation', 'Knowledge bases', 'CRM and email automation', 'Prompt engineering', 'HostOS Butler'],
		included: ['A review of your repetitive work', 'Assistants built for your procedures', 'A person approves anything that matters', 'Monitoring and monthly tuning'],
		deliverables: ['Working automations in your tools', 'Playbook of what runs when', 'Monthly report of hours saved'],
		ideal: 'Businesses answering the same questions and chasing the same follow-ups every day',
		timeline: '2–4 weeks to first automation',
		model: 'custom',
		tiers: [{ name: 'Setup from', price: '$1,800', period: 'one-time', note: 'Then $350/mo to run, monitor and tune' }],
		support: 'Running and tuning from $350/mo.',
		why: 'Priced on the hours it gives back. A typical first setup replaces 30–60 hours of admin work a month. Anything beyond that is quoted by scope.'
	},
	{
		id: 'crm',
		name: 'CRM & Automations',
		blurb: 'Every customer, job and conversation in one place, with follow-ups that run automatically. For service businesses whose customers come back.',
		stack: ['HubSpot', 'GoHighLevel', 'Airtable', 'Notion', 'Zapier', 'Make', 'Custom APIs'],
		included: ['Sales pipeline set up for your business', 'Your existing data moved over', 'Automated reminders and follow-ups', 'Portals for clients and staff', 'Team training'],
		deliverables: ['Configured CRM', 'Automation map', 'Training session and guide'],
		ideal: 'Service businesses with repeat customers and five apps that do not talk to each other',
		timeline: '2–4 weeks',
		model: 'one-time',
		tiers: [
			{ name: 'Setup', price: '$1,200', period: 'one-time', note: 'One CRM · up to 5 automations · migration' },
			{ name: 'Setup + connect', price: '$2,600', period: 'one-time', note: 'Multiple tools connected · portals · reporting' }
		],
		support: 'Optional from $290/mo — changes, new automations, monitoring.',
		why: 'Comparable setups cost $2,500–6,000 from US consultancies. Tool subscriptions are billed to you directly.'
	},
	{
		id: 'seo',
		name: 'SEO & Marketing',
		blurb: 'Be the business that shows up when someone in your city searches — and the one whose reviews get answered. For local businesses that live on search and reviews.',
		stack: ['Technical SEO', 'Local SEO', 'Google Business Profile', 'Keyword research', 'On-page SEO', 'Content strategy', 'Performance', 'Analytics'],
		included: ['Website audit and fixes', 'Google Business Profile management', 'Monthly content', 'Review responses', 'A monthly report you can read in five minutes'],
		deliverables: ['Audit', 'Keyword map', 'Monthly content and report'],
		ideal: 'Local businesses that live on search and reviews',
		timeline: 'First results in 60–90 days',
		model: 'monthly',
		tiers: [
			{ name: 'Local', price: '$790', period: '/mo', note: 'Profile · reviews · technical fixes · 2 pieces of content' },
			{ name: 'Growth', price: '$1,490', period: '/mo', note: 'Everything in Local · 4 pieces · link outreach · quarterly strategy' }
		],
		support: 'Included.',
		why: 'US local-SEO retainers cost $1,000–2,500 a month. Ad spend, if any, is billed to you directly.'
	},
	{
		id: 'design',
		name: 'Branding & Design',
		blurb: 'A brand and screens that look professional at a glance — the way this page does. For new businesses, rebrands, and products that need designs before code.',
		stack: ['Figma', 'Design systems', 'Brand identity', 'UI/UX', 'Wireframes', 'Prototypes', 'Landing pages'],
		included: ['Discovery', 'Two directions, one refined', 'Logo, colors, fonts and usage guide', 'Screens for web and mobile', 'Clickable prototype'],
		deliverables: ['Brand kit', 'Figma file', 'Design system', 'Prototype'],
		ideal: 'New businesses and rebrands, and products that need screens before code',
		timeline: '2–5 weeks',
		model: 'one-time',
		tiers: [
			{ name: 'Brand identity', price: '$1,900', period: 'one-time', note: 'Logo · colors · type · guide' },
			{ name: 'Product UI/UX', price: '$2,400', period: 'from', note: 'Wireframes → screens → prototype · scoped per product' }
		],
		support: 'Design retainer from $490/mo.',
		why: 'Brand identity at US studios starts at $5,000; marketplaces offer $300 logos with no strategy. This is studio-quality work at Philippine cost.'
	},
	{
		id: 'custom',
		name: 'Custom Software',
		blurb: 'Software built for your business and owned by you: internal platforms, fleet software, marketplaces, mobile apps, dashboards and integrations.',
		stack: ['SvelteKit / Next.js', 'TypeScript', 'Supabase / PostgreSQL', 'Node.js', 'OpenAI', 'Vercel', 'Cloudflare'],
		included: ['Discovery and scope', 'Architecture', 'Build in milestones', 'Testing', 'Handover with source'],
		deliverables: ['Scope document', 'Milestone builds', 'Source, documentation, training'],
		ideal: 'Owners who need software that does not exist yet',
		timeline: 'Quoted per project',
		model: 'custom',
		tiers: [{ name: 'Custom quote', price: 'Custom quote', period: '', note: CUSTOM_LINE }],
		support: 'Quoted with the build.',
		why: 'No fixed price would be honest for custom software. Bring the operation to the free strategy call and leave with an estimate.'
	}
];
