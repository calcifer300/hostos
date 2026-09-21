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
	{ href: '/#pricing', label: 'Pricing' },
	{ href: '/#proof', label: 'Work' },
	{ href: `${SITE.url}/team`, label: 'Team' },
	{ href: '/#film', label: 'Watch it run' }
];

export const CTA = { label: 'Book a working session', href: '/#contact', under: '45 minutes · Bring one operation · Leave with a plan' };

export const HERO = {
	eyebrow: 'For Car Rental Fleets · Restaurants · Field Services · Shops',
	lines: ['Run the business.', 'We’ll run the *operations*.'],
	body: 'We handle the rest behind the scenes so you can focus on what matters. AI where it helps, humans where it matters — from customer support to daily operations, AI and experienced operators work together so you don’t have to.',
	secondary: { label: 'See how it works', href: '#how' },
	/** What is in it for them, in four figures. */
	outcomes: [
		['Minutes', 'to every reply, day or night'],
		['0', 'missed orders, claims or estimates'],
		['~4 hrs', 'of your week spent on operations'],
		['1', 'board to read at 8 AM']
	]
};

/** The platforms the work runs on; a mark where one is published, the name where it isn't. */
export const LOGOS: { name: string; icon?: string }[] = [
	{ name: 'Turo' }, { name: 'DoorDash', icon: 'doordash' }, { name: 'Uber Eats', icon: 'ubereats' }, { name: 'Grubhub' }, { name: 'Shopify', icon: 'shopify' },
	{ name: 'Stripe', icon: 'stripe' }, { name: 'Google', icon: 'google' }, { name: 'Cloudflare', icon: 'cloudflare' }, { name: 'Supabase', icon: 'supabase' }, { name: 'Vercel', icon: 'vercel' }
];

export const PROBLEMS = {
	eyebrow: 'The problems we’re hired for',
	title: 'You didn’t start a business to be its *operating system*.',
	items: [
		{ scene: 'Your DoorDash tablet paused during dinner. Nobody noticed for 40 minutes.', answer: 'Tablets watched live, store re-opened in a minute, the missed orders counted and reported.' },
		{ scene: 'Three cars came back today. One has damage. The claim window closes Thursday.', answer: 'Photos at return, claim filed the same day, the calendar blocked until it’s fixed.' },
		{ scene: 'The estimate went out Monday. Nobody chased it.', answer: 'Quiet estimates chased on day two and day five; you see the pipeline, not the inbox.' },
		{ scene: 'Your website says “coming soon” on the page clients check first.', answer: 'A site that books, quotes and answers — built and kept by the same team that runs your inbox.' },
		{ scene: 'Every process lives in one person’s head.', answer: 'Written down, one page each, and the repetitive parts automated so nobody has to remember.' },
		{ scene: 'You learn something’s wrong from the bank balance, not from a dashboard.', answer: 'One board, updated as the work happens, on your phone at 8 AM' }
	]
};

export const HOW = {
	eyebrow: 'How HostOS works',
	title: 'People, systems, software. *In that order.*',
	pillars: [
		{ id: 'people', name: 'People', line: 'Trained operators inside your business.', body: 'On your hours, on your channels — phone, email, chat, the delivery tablets. Managed, covered, accountable. Not freelancers.' },
		{ id: 'systems', name: 'Systems', line: 'How the work gets done, written down.', body: 'Every operation becomes a one-page procedure. The repetitive parts are automated — reminders, follow-ups, reports — with software and, where it helps, AI. Nothing depends on memory.' },
		{ id: 'software', name: 'Software', line: 'HostOS: the board everyone works from.', body: 'Built by us, run by us, owned by you. Your team and ours look at the same jobs, orders, cars and conversations. Custom tools when the off-the-shelf ones don’t fit.' }
	]
};

export const BEFORE_AFTER = {
	eyebrow: 'Before and after',
	title: 'One operation, *two ways* of running it.',
	lede: 'A 146-car Turo fleet, the month before and the month after it moved onto HostOS.',
	rows: [
		{ label: 'Tools', before: '4 spreadsheets, 3 group chats, the Turo app', after: 'One board' },
		{ label: 'People', before: 'The owner and two admins, at night', after: '6 operators around the clock; the owner reads it' },
		{ label: 'Guest messages', before: 'Answered when seen', after: 'Answered in minutes, every hour of the day' },
		{ label: 'Damage claims', before: '5 missed the window', after: '0 missed; photos at every return' },
		{ label: 'Turnarounds', before: 'Found out when the next guest called', after: 'Scheduled at booking, checked off on the phone' },
		{ label: 'Owner’s hours on operations', before: '~60 a week', after: '~4 a week, mostly reading' }
	]
};

export const SOLUTIONS = {
	eyebrow: 'Solutions',
	title: 'What we *run, build* and *connect*.',
	families: [
		{
			id: 'run', name: 'Run', line: 'People and procedures inside your business.',
			items: [
				{ id: 'va', name: 'Virtual assistant solutions', outcome: 'A trained team on your channels, managed by us.', points: ['Phone, email, chat, delivery tablets', 'Procedures written for your business', 'Coverage, not a single person'], for: 'Any business with an inbox that never sleeps' },
				{ id: 'turo-ops', name: 'Turo operations', outcome: 'Every car, booking and turnaround on one board.', points: ['Pricing and calendar', 'Guest messages, day and night', 'Claims filed on time, photos at return'], for: 'Hosts with 3 to 300 cars' },
				{ id: 'doordash-ops', name: 'DoorDash operations', outcome: 'Tablets watched, menus in sync, reviews answered.', points: ['Missed orders caught in minutes', '86’d items pulled across every app', 'Refund disputes filed with evidence'], for: 'Restaurants on two or more delivery apps' },
				{ id: 'consulting', name: 'Business operations consulting', outcome: 'The way you work, redesigned by people who then run it.', points: ['Process mapping in your language', 'What to automate, what to staff', 'A 30-day plan you can hold us to'], for: 'Owners growing past what they can watch' }
			]
		},
		{
			id: 'build', name: 'Build', line: 'Software that fits the business, not the other way round.',
			items: [
				{ id: 'webapps', name: 'Custom web applications', outcome: 'The tool your business needs and can’t buy.', points: ['Designed around your workflow', 'Built on the stack HostOS runs on', 'Yours — code, data, accounts'], for: 'Operations that outgrew spreadsheets' },
				{ id: 'websites', name: 'Website design & development', outcome: 'A site that books, quotes and answers.', points: ['Designed and built in-house', 'Fast, mobile-first, findable', 'Your domain in your name'], for: 'Shops, clinics, trades, agencies' },
				{ id: 'crm', name: 'CRM & internal tools', outcome: 'Every customer, job and conversation in one place.', points: ['A timeline per customer', 'Pipelines your team actually updates', 'Portals for clients and staff'], for: 'Service businesses with repeat customers' },
				{ id: 'dashboards', name: 'Dashboard development', outcome: 'The numbers that matter, live, on your phone.', points: ['One screen per role', 'Updated as the work happens', 'No reports to run'], for: 'Owners who want to see, not ask' }
			]
		},
		{
			id: 'connect', name: 'Connect', line: 'The systems talking to each other so people don’t have to.',
			items: [
				{ id: 'automation', name: 'Business process automation', outcome: 'The repetitive work, done without anyone remembering.', points: ['Reminders, follow-ups, reports', 'Triggers from the tools you already use', 'Human in the loop where it matters'], for: 'Any process that runs on a checklist' },
				{ id: 'integrations', name: 'API integrations', outcome: 'Turo, DoorDash, Shopify, Stripe, Google — connected.', points: ['Orders and bookings flow in', 'Payments and payouts reconciled', 'One source of truth'], for: 'Businesses running on five apps' },
				{ id: 'workflow', name: 'Workflow optimization', outcome: 'Fewer steps, fewer hands, fewer mistakes.', points: ['Every operation mapped and timed', 'The waste removed before it’s automated', 'Measured after, not assumed'], for: 'Teams that feel busy and behind' }
			]
		},
		{
			id: 'understand', name: 'Understand', line: 'Knowing what happened, and what’s about to.',
			items: [
				{ id: 'analytics', name: 'Operational analytics', outcome: 'Where the hours and the money go, by the week.', points: ['Utilization, response times, misses', 'Per car, per store, per tech', 'Alerts when a number moves'], for: 'Owners making decisions on gut feel' },
				{ id: 'bi', name: 'Business intelligence', outcome: 'The questions you’d ask an analyst, answered from your own data.', points: ['Warehouse and models, done for you', 'Plain-language questions over your numbers', 'Forecasts you can act on'], for: 'Multi-location and multi-vertical operators' }
			]
		}
	]
};

export const INDUSTRIES = {
	eyebrow: 'Industries',
	title: 'Built for *operational* businesses.',
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
	title: 'Numbers first. *Names* where we’re allowed.',
	cases: [
		{ figure: 0, suffix: '', label: 'damage claims missed', line: 'A 146-car Turo fleet in Texas, six months on HostOS: every return photographed, every claim inside the window.', who: '146-car fleet · Founder-operated', when: '2026', hue: '#0a84ff' },
		{ figure: 4, suffix: ' min', label: 'median guest reply time', line: 'Night and weekend messages for 146 cars, answered by operators working from the same board the owner reads at 8 AM', who: 'Same fleet', when: 'Q2 2026', hue: '#30d158' },
		{ figure: 8, suffix: '', label: 'verticals, one workspace', line: 'Car rental, delivery, commerce, field service, websites, cafés, barbershops and custom — one login, one team.', who: 'HostOS platform', when: 'Today', hue: '#8b7cff' }
	]
};

export const PLATFORM = {
	eyebrow: 'The platform',
	title: 'The board your team and ours *work from*.',
	lede: 'HostOS is the software behind every engagement: one login, a dashboard per line of business. This is what an owner reads.',
	tabs: [
		{ id: 'board', name: 'Today', widgets: [
			{ kind: 'kpi', label: 'Pickups today', value: '14', note: '8 out · 6 back' },
			{ kind: 'kpi', label: 'Guest replies', value: '4 min', note: 'median, last 24 hrs' },
			{ kind: 'kpi', label: 'Needs attention', value: '3', note: '1 license · 2 messages' },
			{ kind: 'list', label: 'Next up', rows: [['09:40', 'Tesla Model 3 · keys out'], ['11:00', 'Civic · return + photos'], ['13:30', 'RAV4 · wash before 15:00'], ['16:15', 'Model Y · airport handoff']] }
		] },
		{ id: 'dispatch', name: 'Dispatch', widgets: [
			{ kind: 'kpi', label: 'Jobs today', value: '11', note: '9 assigned · 2 open' },
			{ kind: 'kpi', label: 'Estimates quiet', value: '2', note: 'chased this morning' },
			{ kind: 'kpi', label: 'Techs on the road', value: '4', note: 'all on time' },
			{ kind: 'list', label: 'Board', rows: [['Ramon', 'Windshield · Austin · 10:00'], ['Jess', 'Side glass · Round Rock · 11:30'], ['Open', 'Chip repair · Cedar Park · 14:00'], ['Miguel', 'Windshield · Georgetown · 15:30']] }
		] },
		{ id: 'butler', name: 'Butler', widgets: [
			{ kind: 'kpi', label: 'Tasks raised today', value: '7', note: 'by the Butler' },
			{ kind: 'kpi', label: 'Reviews to answer', value: '2', note: 'DoorDash · Google' },
			{ kind: 'kpi', label: 'Follow-ups sent', value: '5', note: 'estimates · quotes' },
			{ kind: 'list', label: 'Raised', rows: [['08:02', 'Store paused on Uber Eats — reopened'], ['08:15', 'Estimate #1042 quiet 5 days — chased'], ['09:00', 'License renewal due in 14 days'], ['09:30', '86’d: garlic rice, pulled from 3 apps']] }
		] }
	]
};

/**
 * Footage. Pexels clips (free licence, no attribution required), hotlinked
 * for now; self-host under /static/video before the domain cutover. Each
 * plays muted, only while on screen, never on reduced motion or data saver.
 */
const clip = (id: number, _fps: number) => `https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/${id}.mp4`;
export const VIDEO = {
	hero: { src: clip(5834188, 24) },
	team: clip(8865706, 25),
	delivery: clip(4168426, 25),
	closing: clip(8064422, 30)
};
/** Footage under every industry tile and solution card; the Founder can swap or clear any of them. */
export const TILES: Record<string, string> = {
	"industry:turo": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4208203.mp4",
	"industry:doordash": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4168426.mp4",
	"industry:hospitality": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7820478.mp4",
	"industry:fleet": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/5834188.mp4",
	"industry:property": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4877217.mp4",
	"industry:services": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8986482.mp4",
	"industry:small": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7697073.mp4",
	"industry:startups": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8266178.mp4",
	"solution:va": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8865706.mp4",
	"solution:turo-ops": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4208203.mp4",
	"solution:doordash-ops": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7362583.mp4",
	"solution:consulting": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7413764.mp4",
	"solution:webapps": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/854053.mp4",
	"solution:websites": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4177954.mp4",
	"solution:crm": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8632602.mp4",
	"solution:dashboards": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8064422.mp4",
	"solution:automation": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8094279.mp4",
	"solution:integrations": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/20693196.mp4",
	"solution:workflow": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8986890.mp4",
	"solution:analytics": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/6868699.mp4",
	"solution:bi": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/6685171.mp4",
	"problem:1": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8094279.mp4",
	"problem:2": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4208203.mp4",
	"problem:3": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/3986119.mp4",
	"problem:4": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4177954.mp4",
	"problem:5": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7413764.mp4",
	"problem:6": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8064422.mp4",
	"pillar:people": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8865706.mp4",
	"pillar:systems": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7413764.mp4",
	"pillar:software": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8480293.mp4",
	"week:1": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7413764.mp4",
	"week:2": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8266178.mp4",
	"week:3": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8865706.mp4",
	"week:4": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/6868699.mp4",
	"proof:1": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/4208203.mp4",
	"proof:2": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/3986119.mp4",
	"proof:3": "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8064422.mp4"
};
/** What owners said, in their words; the laurels carry the figures from the company's record. Both editable in the app. */
export const TESTIMONIALS = [
	{
		quote: "HostOS Collective completely transformed how we handle online orders. Our operations are smoother, and we’ve seen a 30% boost in repeat customers since launching the new system.",
		name: "Zack Holmes",
		role: "Restaurant owner",
		photo: '/faces/3760046.jpg'
	},
	{
		quote: "From building our website to setting up automated email campaigns, HostOS Collective delivered everything on time and on budget. Truly a one-stop shop for growing businesses.",
		name: "Miguel Chavez",
		role: "E-commerce startup",
		photo: '/faces/2379004.jpg'
	},
	{
		quote: "Having a dedicated VA team that manages my fleet bookings and guest communication has been a game changer. Professional, reliable, and always responsive.",
		name: "Matt Tolley",
		role: "Turo host",
		photo: '/faces/6333501.jpg'
	}
];
export const LAURELS = [
	{
		value: "98%",
		label: "client satisfaction"
	},
	{
		value: "50+",
		label: "clients served"
	},
	{
		value: "120+",
		label: "projects delivered"
	},
	{
		value: "10+",
		label: "years in operations"
	},
	{
		value: "5+ yrs",
		label: "VA & BPO experience per operator · trained by the Founder"
	}
];
export const VOICES = { eyebrow: 'What owners say', title: 'In their *own words*.' };
/** What the work is trusted for — stated, not claimed as prizes we have not won. */
export const RECOGNITION = {
	title: 'Trusted for the *whole* of it.',
	body: 'Operations, design and engineering under one roof: the team that answers your customers at 2 AM also builds the software it runs on. These are the disciplines clients hire us for.',
	marks: [
		{ name: 'Web & app development', note: 'Full-stack, shipped and owned by you' },
		{ name: 'Product & UI design', note: 'Interfaces owners read at 8 AM' },
		{ name: 'World-class customer service', note: '5+ yrs VA & BPO per operator · Founder-trained' },
		{ name: 'B2B operations', note: 'Fleets, kitchens, field service, shops' },
		{ name: 'Automation & AI', note: 'In the background, supervised — never the pitch' }
	]
};
/** The trust line under the hero's ask. */
/** Ten of the owners we work with (stock portraits until real ones are in), for the trust line. */
export const CLIENT_FACES = ['/faces/3760046.jpg', '/faces/2530364.jpg', '/faces/2379004.jpg', '/faces/3974017.jpg', '/faces/6333501.jpg', '/faces/2112714.jpg', '/faces/8217534.jpg', '/faces/1195111.jpg', '/faces/12871465.jpg', '/faces/6345373.jpg'];
/** No number we cannot verify: five stars and a plain line that does not repeat the laurels above. */
export const RATING = { value: '', stars: 5, note: 'Supporting growing businesses every day', count: '' };
/** Where to reach the Founder directly. */
export const CONTACT = { facebook: { handle: '@bimbeez96', url: 'https://www.facebook.com/bimbeez96', name: 'John Briones' }, founderEmail: 'johnbriones774@gmail.com', founder: 'John Jenrique Briones' };
/** HostOS on every screen, and what it does for the numbers. */
export const DEVICES = {
	eyebrow: 'HostOS on every screen',
	title: 'The board in your pocket, on your desk — *everywhere* the work is.',
	lede: 'One login on iPhone, Android, Mac and Windows. The board your operators work from is the one you read over coffee. Nothing to install, nothing to sync.',
	gains: [
		{ figure: '+18%', name: 'More bookings from faster replies', body: 'A guest answered in minutes books; one answered tomorrow booked elsewhere. Reply time is the single biggest lever on occupancy, and it is the first number we move.' },
		{ figure: '0', name: 'Missed orders, claims and estimates', body: 'Paused tablets are reopened in a minute, damage is photographed at return and filed inside the window, quiet estimates are chased on day two and day five.' },
		{ figure: '4–8 hrs', name: 'Of your week, back', body: 'The inbox, the calendar, the tablets and the follow-ups run without you. You read one board at 8 AM and decide; you stop being the software.' },
		{ figure: '+12%', name: 'Utilization and pricing', body: 'Calendars priced by demand, turnarounds scheduled at booking, cars and tables that stop sitting empty because someone forgot to open them.' },
		{ figure: '2×', name: 'Reviews and rankings', body: 'Every review answered the same day, every dispute filed with evidence — the ratings that decide where you appear on Turo, DoorDash and Google.' },
		{ figure: '1', name: 'Board for the whole business', body: 'Fleet, kitchen, field and shop on one screen with the same team behind it. Add a vertical without adding a vendor.' }
	]
};
export const WHY = {
	eyebrow: 'Why HostOS Collective',
	title: 'Why a team *from the Philippines* — and why this one.',
	lede: 'Based in the Philippines, working US hours, for owners in the US and anywhere else.',
	reasons: [
		{ id: 'hours', name: 'Awake when your customers are', body: 'Manila is 13 hours ahead of Austin. Your night is our working day, so a guest message at 2 AM your time is answered live, not queued for the morning.' },
		{ id: 'people', name: 'Senior operators, not a marketplace', body: 'Every operator is a virtual assistant with five or more years in BPO and customer operations, personally trained by the Founder from day one, on our payroll, trained on your procedures, and covered when they’re off. You get a team, not a freelancer.' },
		{ id: 'one', name: 'One team for people, systems and software', body: 'Most vendors sell one of the three. We run the operation, write it down, and build the board it runs on — so nothing falls between an agency, a SaaS and a VA firm.' },
		{ id: 'value', name: 'US-grade service at Philippine cost', body: 'The Philippines is the customer-operations capital of the world: English-fluent, US-aligned, and trained for it. The savings buy the round-the-clock coverage most owners can’t afford locally.' },
		{ id: 'own', name: 'You own everything', body: 'Your domain, workspace, data and code stay in your name. If we part ways, you keep all of it — including the map.' },
		{ id: 'plan', name: 'A plan you can hold us to', body: 'Thirty days, four milestones, the numbers in a weekly note. If it isn’t a fit after the working session, you keep the map at no charge.' }
	]
};

/** Every section's living background: a dimmed clip (or none) and the colour its light leans towards. */
export const SECTIONS: Record<string, { clip: string; tint: string }> = {
	problems: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8094279.mp4",
		tint: "#ff375f"
	},
	how: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/7413764.mp4",
		tint: "#3b9cff"
	},
	film: {
		clip: "",
		tint: "#8b7cff"
	},
	'before-after': {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8064422.mp4",
		tint: "#30d158"
	},
	solutions: {
		clip: "",
		tint: "#3b9cff"
	},
	industries: {
		clip: "",
		tint: "#ff9f0a"
	},
	proof: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/6868699.mp4",
		tint: "#40c8e0"
	},
	platform: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/3986119.mp4",
		tint: "#af52de"
	},
	start: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8266178.mp4",
		tint: "#3b9cff"
	},
	faq: {
		clip: "",
		tint: "#8b7cff"
	},
	why: {
		clip: "https://yrijcgeictfrumkqwqeu.supabase.co/storage/v1/object/public/site/clips/8865706.mp4",
		tint: "#ff9f0a"
	},
	devices: { clip: "", tint: "#3b9cff" },
	collective: { clip: "", tint: "#8b7cff" },
	voices: { clip: "", tint: "#3b9cff" },
	pricing: { clip: "", tint: "#2c3ef3" }
};

export const FILM = {
	eyebrow: 'Watch it run',
	title: 'One day, four businesses, *one board*.',
	lede: 'Same team, same software, a different business every few hours. It plays itself.',
	chapters: [
		{ id: 'fleet', time: '07:40', name: 'Fleet', src: clip(4208203, 24), line: '146 cars. Eleven going out before nine.', events: [['07:41', 'Guest asks for an early pickup — answered in 1 min'], ['07:52', 'Model 3 · keys out · lockbox code sent'], ['08:10', 'Civic back · 12 photos · no damage']] },
		{ id: 'kitchen', time: '11:30', name: 'Kitchen', src: clip(8094279, 25), line: 'Lunch rush on three delivery apps.', events: [['11:32', 'Uber Eats store paused — reopened in 40 sec'], ['11:48', '86 garlic rice · pulled from 3 apps'], ['12:05', 'Refund dispute filed with photos']] },
		{ id: 'field', time: '14:00', name: 'Field', src: clip(20693196, 25), line: 'A windshield job from call to signature.', events: [['14:02', 'Lead → customer → estimate · one screen'], ['14:15', 'Ramon dispatched · customer texted the ETA'], ['15:40', 'Work order signed on the phone · invoice sent']] },
		{ id: 'shop', time: '17:30', name: 'Shop', src: clip(4177954, 30), line: 'A barbershop’s site goes live.', events: [['17:31', 'Domain in the owner’s name · DNS set'], ['17:45', 'Bookings page connected to the calendar'], ['18:02', 'First online booking · Saturday 10:00']] }
	]
};

export const THIRTY_DAYS = {
	eyebrow: 'How an engagement starts',
	title: 'The first *thirty days*.',
	steps: [
		{ week: 'Week 1', name: 'Map', body: 'We sit in your operation — the inbox, the calendar, the tablets — and write down how it actually runs. You get the map whether or not we continue.' },
		{ week: 'Week 2', name: 'Set up', body: 'Your workspace on HostOS, the procedures, the connections to Turo, DoorDash, Shopify or whatever you run on. Operators trained on your business, not on a script.' },
		{ week: 'Week 3', name: 'Run alongside', body: 'We run it with you watching. Every miss gets a procedure; every repetitive step gets a candidate for automation.' },
		{ week: 'Week 4', name: 'Hand you the board', body: 'You read the board; we run the board. A weekly note on the numbers, a monthly conversation on what to change.' }
	]
};

export const FAQ = {
	eyebrow: 'Questions owners ask',
	title: '*Straight* answers.',
	items: [
		{ q: 'Do I have to switch software?', a: 'No. HostOS connects to what you already run — Turo, DoorDash, Uber Eats, Shopify, Stripe, Google. Where a tool is missing we build it; where one works, we plug it in.' },
		{ q: 'Who owns the data, the accounts, the code?', a: 'You do. Your domain is in your name, your workspace is yours, and anything we build for you is delivered with the source. If we part ways, you keep everything.' },
		{ q: 'What happens when an operator leaves?', a: 'Nothing you notice. Every procedure is written down, every conversation is on the board, and coverage is a team, not a person. Replacement operators train on your procedures before they touch your inbox.' },
		{ q: 'Is this an agency, a SaaS, or a VA company?', a: 'It’s the three together, which is the point. The people run the operation, the systems make it repeatable, the software is where both happen. You pay for an outcome, not for seats.' },
		{ q: 'How do you use AI?', a: 'As a tool, in the background: drafting replies an operator approves, spotting a paused store or a quiet estimate, summarizing a week. It never talks to your customers unsupervised, and it is never the reason to hire us.' },
		{ q: 'Where is the team?', a: 'The Philippines, working US hours — or yours, wherever you are. Every operator is on our payroll, trained on your procedures, and covered when they’re off.' },
		{ q: 'What does it cost?', a: 'Operations are a monthly retainer sized to the hours of coverage you need. Builds are quoted from the map we make in week one. The working session is free, and you keep the map either way.' },
		{ q: 'How fast can we start?', a: 'The working session this week; the map the week after; operators on your channels by the end of the month.' }
	]
};

export const FINAL = {
	title: 'Bring *one* operation.',
	body: 'In 45 minutes we map how it runs today, where it leaks, and how it would run on HostOS. Not a fit? You keep the map.',
	channels: [
		{ label: 'Email', value: SITE.email, href: `mailto:${SITE.email}` },
		{ label: 'WhatsApp', value: SITE.phone, href: SITE.whatsapp }
	]
};

export const FOOTER = {
	columns: [
		{ title: 'Solutions', links: [['Run', '/#solutions'], ['Build', '/#solutions'], ['Connect', '/#solutions'], ['Understand', '/#solutions'], ['Pricing', '/#pricing']] },
		{ title: 'Company', links: [['The Collective', `${SITE.url}/team`], ['About', `${SITE.url}/about`], ['Contact', '/#contact']] },
		{ title: 'Platform', links: [['Open HostOS', SITE.app], ['Sign in', SITE.login], ['Install the app', `${SITE.url}/install`]] }
	]
};
