/**
 * Everything the landing page says, in one typed file. Copy is written in
 * the voice of an experienced operator talking to an owner: short
 * sentences, nouns and numbers, the work named. No "leverage", no
 * "seamless", and AI appears as a sentence inside "Systems", never as a
 * headline.
 */

export const SITE = {
	name: 'HostOS',
	company: 'HostOS Collective',
	url: 'https://hostoscollective.com',
	app: 'https://hostoscollective.com/app',
	login: 'https://hostoscollective.com/login',
	email: 'hello@hostoscollective.com',
	phone: '+63 991 474 5117',
	whatsapp: 'https://wa.me/639914745117',
	tagline: 'Run the business. We’ll run the operations.',
	description:
		'HostOS Collective puts a trained team, written systems and one operations board behind growing businesses — car rental fleets, restaurants, field services, shops — so the owner stops being the software.'
};

export const NAV = [
	{ href: '/#solutions', label: 'Solutions' },
	{ href: '/#industries', label: 'Industries' },
	{ href: '/#platform', label: 'Platform' },
	{ href: '/#proof', label: 'Work' },
	{ href: `${SITE.url}/team`, label: 'Team' },
	{ href: '/#how', label: 'How it works' }
];

export const CTA = { label: 'Book a working session', href: '/#contact', under: '45 minutes · bring one operation · leave with a plan' };

export const HERO = {
	eyebrow: 'Operations · Systems · Software',
	lines: ['Run the business.', 'We’ll run the operations.'],
	body: SITE.description,
	secondary: { label: 'See how it works', href: '#how' }
};

export const LOGOS = ['Turo', 'DoorDash', 'Uber Eats', 'Grubhub', 'Shopify', 'Stripe', 'Google', 'Cloudflare', 'Supabase', 'Vercel'];

export const PROBLEMS = {
	eyebrow: 'The problems we’re hired for',
	title: 'You didn’t start a business to be its operating system.',
	items: [
		{ scene: 'Your DoorDash tablet paused during dinner. Nobody noticed for 40 minutes.', answer: 'Tablets watched live, store re-opened in a minute, the missed orders counted and reported.' },
		{ scene: 'Three cars came back today. One has damage. The claim window closes Thursday.', answer: 'Photos at return, claim filed the same day, the calendar blocked until it’s fixed.' },
		{ scene: 'The estimate went out Monday. Nobody chased it.', answer: 'Quiet estimates chased on day two and day five; you see the pipeline, not the inbox.' },
		{ scene: 'Your website says “coming soon” on the page clients check first.', answer: 'A site that books, quotes and answers — built and kept by the same team that runs your inbox.' },
		{ scene: 'Every process lives in one person’s head.', answer: 'Written down, one page each, and the repetitive parts automated so nobody has to remember.' },
		{ scene: 'You learn something’s wrong from the bank balance, not from a dashboard.', answer: 'One board, updated as the work happens, on your phone at 8 a.m.' }
	]
};

export const HOW = {
	eyebrow: 'How HostOS works',
	title: 'People, systems, software. In that order.',
	pillars: [
		{ id: 'people', name: 'People', line: 'Trained operators inside your business.', body: 'On your hours, on your channels — phone, email, chat, the delivery tablets. Managed, covered, accountable. Not freelancers.' },
		{ id: 'systems', name: 'Systems', line: 'How the work gets done, written down.', body: 'Every operation becomes a one-page procedure. The repetitive parts are automated — reminders, follow-ups, reports — with software and, where it helps, AI. Nothing depends on memory.' },
		{ id: 'software', name: 'Software', line: 'HostOS: the board everyone works from.', body: 'Built by us, run by us, owned by you. Your team and ours look at the same jobs, orders, cars and conversations. Custom tools when the off-the-shelf ones don’t fit.' }
	]
};

export const BEFORE_AFTER = {
	eyebrow: 'Before and after',
	title: 'One operation, two ways of running it.',
	lede: 'A six-car Turo fleet, the month before and the month after it moved onto HostOS.',
	rows: [
		{ label: 'Tools', before: '3 spreadsheets, 2 group chats, the Turo app', after: 'One board' },
		{ label: 'People', before: 'The owner, at night', after: '2 operators, 7 days, the owner reads it' },
		{ label: 'Guest messages', before: 'Answered when seen', after: 'Answered in minutes, every hour of the day' },
		{ label: 'Damage claims', before: '2 missed the window', after: '0 missed; photos at every return' },
		{ label: 'Turnarounds', before: 'Found out when the next guest called', after: 'Scheduled at booking, checked off on the phone' },
		{ label: 'Owner’s hours on operations', before: '~25 a week', after: '~2 a week, mostly reading' }
	]
};

export const SOLUTIONS = {
	eyebrow: 'Solutions',
	title: 'What we run, build and connect.',
	families: [
		{
			id: 'run', name: 'Run', line: 'People and procedures inside your business.',
			items: [
				{ name: 'Virtual assistant solutions', outcome: 'A trained team on your channels, managed by us.', points: ['Phone, email, chat, delivery tablets', 'Procedures written for your business', 'Coverage, not a single person'], for: 'Any business with an inbox that never sleeps' },
				{ name: 'Turo operations', outcome: 'Every car, booking and turnaround on one board.', points: ['Pricing and calendar', 'Guest messages, day and night', 'Claims filed on time, photos at return'], for: 'Hosts with 3 to 300 cars' },
				{ name: 'DoorDash operations', outcome: 'Tablets watched, menus in sync, reviews answered.', points: ['Missed orders caught in minutes', '86’d items pulled across every app', 'Refund disputes filed with evidence'], for: 'Restaurants on two or more delivery apps' },
				{ name: 'Business operations consulting', outcome: 'The way you work, redesigned by people who then run it.', points: ['Process mapping in your language', 'What to automate, what to staff', 'A 30-day plan you can hold us to'], for: 'Owners growing past what they can watch' }
			]
		},
		{
			id: 'build', name: 'Build', line: 'Software that fits the business, not the other way round.',
			items: [
				{ name: 'Custom web applications', outcome: 'The tool your business needs and can’t buy.', points: ['Designed around your workflow', 'Built on the stack HostOS runs on', 'Yours — code, data, accounts'], for: 'Operations that outgrew spreadsheets' },
				{ name: 'Website design & development', outcome: 'A site that books, quotes and answers.', points: ['Designed and built in-house', 'Fast, mobile-first, findable', 'Your domain in your name'], for: 'Shops, clinics, trades, agencies' },
				{ name: 'CRM & internal tools', outcome: 'Every customer, job and conversation in one place.', points: ['A timeline per customer', 'Pipelines your team actually updates', 'Portals for clients and staff'], for: 'Service businesses with repeat customers' },
				{ name: 'Dashboard development', outcome: 'The numbers that matter, live, on your phone.', points: ['One screen per role', 'Updated as the work happens', 'No reports to run'], for: 'Owners who want to see, not ask' }
			]
		},
		{
			id: 'connect', name: 'Connect', line: 'The systems talking to each other so people don’t have to.',
			items: [
				{ name: 'Business process automation', outcome: 'The repetitive work, done without anyone remembering.', points: ['Reminders, follow-ups, reports', 'Triggers from the tools you already use', 'Human in the loop where it matters'], for: 'Any process that runs on a checklist' },
				{ name: 'API integrations', outcome: 'Turo, DoorDash, Shopify, Stripe, Google — connected.', points: ['Orders and bookings flow in', 'Payments and payouts reconciled', 'One source of truth'], for: 'Businesses running on five apps' },
				{ name: 'Workflow optimisation', outcome: 'Fewer steps, fewer hands, fewer mistakes.', points: ['Every operation mapped and timed', 'The waste removed before it’s automated', 'Measured after, not assumed'], for: 'Teams that feel busy and behind' }
			]
		},
		{
			id: 'understand', name: 'Understand', line: 'Knowing what happened, and what’s about to.',
			items: [
				{ name: 'Operational analytics', outcome: 'Where the hours and the money go, by the week.', points: ['Utilisation, response times, misses', 'Per car, per store, per tech', 'Alerts when a number moves'], for: 'Owners making decisions on gut feel' },
				{ name: 'Business intelligence', outcome: 'The questions you’d ask an analyst, answered from your own data.', points: ['Warehouse and models, done for you', 'Plain-language questions over your numbers', 'Forecasts you can act on'], for: 'Multi-location and multi-vertical operators' }
			]
		}
	]
};

export const INDUSTRIES = {
	eyebrow: 'Industries',
	title: 'Built for operational businesses.',
	items: [
		{ id: 'turo', name: 'Turo & car rental', hue: '#0a84ff', line: 'Fleets from 3 to 300 cars', href: '/#solutions' },
		{ id: 'doordash', name: 'DoorDash & delivery', hue: '#ff375f', line: 'Restaurants on two or more apps', href: '/#solutions' },
		{ id: 'hospitality', name: 'Hospitality', hue: '#ff9f0a', line: 'Cafés, bars, small hotels', href: '/#solutions' },
		{ id: 'fleet', name: 'Fleet operations', hue: '#30d158', line: 'Vans, trucks, drivers, routes', href: '/#solutions' },
		{ id: 'property', name: 'Property management', hue: '#40c8e0', line: 'Units, tenants, maintenance', href: '/#solutions' },
		{ id: 'services', name: 'Professional & field services', hue: '#8b7cff', line: 'Auto glass, cleaning, trades, agencies', href: '/#solutions' },
		{ id: 'small', name: 'Small businesses', hue: '#f5b301', line: 'Shops, clinics, studios', href: '/#solutions' },
		{ id: 'startups', name: 'Growing startups', hue: '#af52de', line: 'Operations before the ops hire', href: '/#solutions' }
	]
};

export const PROOF = {
	eyebrow: 'Proof',
	title: 'Numbers first. Names where we’re allowed.',
	cases: [
		{ figure: 0, suffix: '', label: 'damage claims missed', line: 'A six-car Turo fleet in the Philippines, six months on HostOS: every return photographed, every claim inside the window.', who: 'Founder-operated fleet', when: '2026', hue: '#0a84ff' },
		{ figure: 4, suffix: ' min', label: 'median guest reply time', line: 'Night and weekend messages answered by operators working from the same board the owner reads at 8 a.m.', who: 'Same fleet', when: 'Q2 2026', hue: '#30d158' },
		{ figure: 8, suffix: '', label: 'verticals, one workspace', line: 'Car rental, delivery, commerce, field service, websites, cafés, barbershops and custom — one login, one team.', who: 'HostOS platform', when: 'Today', hue: '#8b7cff' }
	]
};

export const PLATFORM = {
	eyebrow: 'The platform',
	title: 'The board your team and ours work from.',
	lede: 'HostOS is the software behind every engagement — a separate dashboard for each line of business, one login. This is a live look at the kind of screens an owner reads.',
	tabs: [
		{ id: 'board', name: 'Today', widgets: [
			{ kind: 'kpi', label: 'Pickups today', value: '14', note: '8 out · 6 back' },
			{ kind: 'kpi', label: 'Guest replies', value: '4 min', note: 'median, last 24 h' },
			{ kind: 'kpi', label: 'Needs attention', value: '3', note: '1 licence · 2 messages' },
			{ kind: 'list', label: 'Next up', rows: [['09:40', 'Tesla Model 3 · keys out'], ['11:00', 'Civic · return + photos'], ['13:30', 'RAV4 · wash before 15:00'], ['16:15', 'Model Y · airport handoff']] }
		] },
		{ id: 'dispatch', name: 'Dispatch', widgets: [
			{ kind: 'kpi', label: 'Jobs today', value: '11', note: '9 assigned · 2 open' },
			{ kind: 'kpi', label: 'Estimates quiet', value: '2', note: 'chased this morning' },
			{ kind: 'kpi', label: 'Techs on the road', value: '4', note: 'all on time' },
			{ kind: 'list', label: 'Board', rows: [['Ramon', 'Windshield · Makati · 10:00'], ['Jess', 'Side glass · BGC · 11:30'], ['Open', 'Chip repair · Pasig · 14:00'], ['Miguel', 'Windshield · QC · 15:30']] }
		] },
		{ id: 'butler', name: 'Butler', widgets: [
			{ kind: 'kpi', label: 'Tasks raised today', value: '7', note: 'by the Butler' },
			{ kind: 'kpi', label: 'Reviews to answer', value: '2', note: 'DoorDash · Google' },
			{ kind: 'kpi', label: 'Follow-ups sent', value: '5', note: 'estimates · quotes' },
			{ kind: 'list', label: 'Raised', rows: [['08:02', 'Store paused on Uber Eats — reopened'], ['08:15', 'Estimate #1042 quiet 5 days — chased'], ['09:00', 'Licence renewal due in 14 days'], ['09:30', '86’d: garlic rice, pulled from 3 apps']] }
		] }
	]
};

export const THIRTY_DAYS = {
	eyebrow: 'How an engagement starts',
	title: 'The first thirty days.',
	steps: [
		{ week: 'Week 1', name: 'Map', body: 'We sit in your operation — the inbox, the calendar, the tablets — and write down how it actually runs. You get the map whether or not we continue.' },
		{ week: 'Week 2', name: 'Set up', body: 'Your workspace on HostOS, the procedures, the connections to Turo, DoorDash, Shopify or whatever you run on. Operators trained on your business, not on a script.' },
		{ week: 'Week 3', name: 'Run alongside', body: 'We run it with you watching. Every miss gets a procedure; every repetitive step gets a candidate for automation.' },
		{ week: 'Week 4', name: 'Hand you the board', body: 'You read the board; we run the board. A weekly note on the numbers, a monthly conversation on what to change.' }
	]
};

export const FAQ = {
	eyebrow: 'Questions owners ask',
	title: 'Straight answers.',
	items: [
		{ q: 'Do I have to switch software?', a: 'No. HostOS connects to what you already run — Turo, DoorDash, Uber Eats, Shopify, Stripe, Google. Where a tool is missing we build it; where one works, we plug it in.' },
		{ q: 'Who owns the data, the accounts, the code?', a: 'You do. Your domain is in your name, your workspace is yours, and anything we build for you is delivered with the source. If we part ways, you keep everything.' },
		{ q: 'What happens when an operator leaves?', a: 'Nothing you notice. Every procedure is written down, every conversation is on the board, and coverage is a team, not a person. Replacement operators train on your procedures before they touch your inbox.' },
		{ q: 'Is this an agency, a SaaS, or a VA company?', a: 'It’s the three together, which is the point. The people run the operation, the systems make it repeatable, the software is where both happen. You pay for an outcome, not for seats.' },
		{ q: 'How do you use AI?', a: 'As a tool, in the background: drafting replies an operator approves, spotting a paused store or a quiet estimate, summarising a week. It never talks to your customers unsupervised, and it is never the reason to hire us.' },
		{ q: 'Where is the team?', a: 'The Philippines, working on your hours. Every operator is on our payroll, trained on your procedures, and covered when they’re off.' },
		{ q: 'What does it cost?', a: 'Operations retainers start with the hours of coverage you need; builds are quoted from the map we make in week one. The working session is free and you keep the map either way.' },
		{ q: 'How fast can we start?', a: 'The working session this week; the map the week after; operators on your channels by the end of the month.' }
	]
};

export const FINAL = {
	title: 'Bring one operation.',
	body: 'In 45 minutes we’ll map how it runs today, where it leaks, and what it looks like on HostOS. If it’s not a fit, you keep the map.',
	channels: [
		{ label: 'Email', value: SITE.email, href: `mailto:${SITE.email}` },
		{ label: 'WhatsApp', value: SITE.phone, href: SITE.whatsapp }
	]
};

export const FOOTER = {
	columns: [
		{ title: 'Solutions', links: [['Run', '/#solutions'], ['Build', '/#solutions'], ['Connect', '/#solutions'], ['Understand', '/#solutions']] },
		{ title: 'Company', links: [['The Collective', `${SITE.url}/team`], ['About', `${SITE.url}/about`], ['Contact', '/#contact']] },
		{ title: 'Platform', links: [['Open HostOS', SITE.app], ['Sign in', SITE.login], ['Install the app', `${SITE.url}/install`]] }
	]
};
