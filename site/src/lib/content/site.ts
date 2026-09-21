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
	tagline: 'Focus on what matters most. We’ll handle your operations.',
	description:
		'HostOS Collective runs the daily operations of growing businesses — car rental fleets, restaurants, field services, shops — with trained operators, written systems and one shared dashboard, so the owner does not have to handle every task alone.'
};

export const NAV = [
	{ href: '/#solutions', label: 'Solutions' },
	{ href: '/#industries', label: 'Industries' },
	{ href: '/#platform', label: 'Platform' },
	{ href: '/#pricing', label: 'Pricing' },
	{ href: '/#proof', label: 'Results' },
	{ href: `${SITE.url}/team`, label: 'Team' },
	{ href: '/#film', label: 'See it run' }
];

export const CTA = { label: 'Book a Free Strategy Call', href: '/#contact', under: 'Free 45-minute call · No obligation · Leave with a practical plan' };

export const HERO = {
	eyebrow: 'For Car Rental Fleets · Restaurants · Field Services · Shops',
	lines: ['Focus on what matters most.', 'We’ll handle your *operations*.'],
	body: 'AI where it helps. Humans where it matters. From customer support to daily operations, we combine intelligent automation with experienced operators so you can focus on growing your business.',
	secondary: { label: 'See how it works', href: '#how' },
	/** What is in it for them, in four figures. */
	outcomes: [
		['Minutes', 'to answer every customer, day or night'],
		['0', 'missed orders, claims or estimates'],
		['~4 hrs', 'a week is all you spend on operations'],
		['1', 'dashboard to read each morning']
	]
};

/** The platforms the work runs on; a mark where one is published, the name where it isn't. */
export const LOGOS: { name: string; icon?: string }[] = [
	{ name: 'Turo' }, { name: 'DoorDash', icon: 'doordash' }, { name: 'Uber Eats', icon: 'ubereats' }, { name: 'Grubhub' }, { name: 'Shopify', icon: 'shopify' },
	{ name: 'Stripe', icon: 'stripe' }, { name: 'Google', icon: 'google' }, { name: 'Cloudflare', icon: 'cloudflare' }, { name: 'Supabase', icon: 'supabase' }, { name: 'Vercel', icon: 'vercel' }
];

export const PROBLEMS = {
	eyebrow: 'The problems we solve',
	title: 'You didn’t start a business to *run every task* yourself.',
	items: [
		{ scene: 'Your DoorDash tablet paused during dinner. Nobody noticed for 40 minutes.', answer: 'We watch the tablets live, reopen the store within a minute, and report every missed order.' },
		{ scene: 'Three cars came back today. One has damage. The claim window closes Thursday.', answer: 'We photograph every return, file the claim the same day, and block the calendar until the car is fixed.' },
		{ scene: 'The estimate went out Monday. Nobody chased it.', answer: 'We follow up on day two and day five. You see the pipeline, not the inbox.' },
		{ scene: 'Your website says “coming soon” on the page clients check first.', answer: 'We build and maintain a site that takes bookings, sends quotes and answers questions.' },
		{ scene: 'Every process lives in one person’s head.', answer: 'We write each process down, one page each, and automate the repetitive parts so nobody has to remember.' },
		{ scene: 'You learn something’s wrong from the bank balance, not from a dashboard.', answer: 'One dashboard, updated as the work happens, on your phone every morning.' }
	]
};

export const HOW = {
	eyebrow: 'How HostOS works',
	title: 'People, systems, software — *working together*.',
	pillars: [
		{ id: 'people', name: 'People', line: 'Trained operators inside your business.', body: 'They work your hours on your channels — phone, email, chat and delivery tablets. We manage them, cover their time off, and stay accountable for the results. Not freelancers.' },
		{ id: 'systems', name: 'Systems', line: 'Every process written down, then automated.', body: 'Each task becomes a one-page procedure. The repetitive parts — reminders, follow-ups, reports — run automatically, with AI where it helps. Nothing depends on memory.' },
		{ id: 'software', name: 'Software', line: 'HostOS: one dashboard for everyone.', body: 'Built and run by us, owned by you. Your team and ours see the same jobs, orders, cars and conversations. We build custom tools when off-the-shelf ones don’t fit.' }
	]
};

export const BEFORE_AFTER = {
	eyebrow: 'Before and after',
	title: 'The same business, *before and after* HostOS.',
	lede: 'A 146-car Turo fleet: the month before it moved onto HostOS, and the month after.',
	rows: [
		{ label: 'Tools', before: '4 spreadsheets, 3 group chats, the Turo app', after: 'One dashboard' },
		{ label: 'People', before: 'The owner and two admins, working nights', after: '6 operators around the clock; the owner just reads the dashboard' },
		{ label: 'Guest messages', before: 'Answered whenever someone saw them', after: 'Answered in minutes, around the clock' },
		{ label: 'Damage claims', before: '5 missed the window', after: '0 missed; photos at every return' },
		{ label: 'Turnarounds', before: 'Discovered when the next guest called', after: 'Scheduled at booking, checked off on the phone' },
		{ label: 'Owner’s hours on operations', before: 'About 60 a week', after: 'About 4 a week, mostly reading' }
	]
};

export const SOLUTIONS = {
	eyebrow: 'Solutions',
	title: 'What we do *for your business*.',
	families: [
		{
			id: 'run', name: 'Run', line: 'Trained people and written procedures inside your business.',
			items: [
				{ id: 'va', name: 'Virtual assistant team', outcome: 'A trained team handling your customer channels, managed by us.', points: ['Phone, email, chat, delivery tablets', 'Procedures written for your business', 'A team that covers for each other, never a single person'], for: 'Any business with an inbox that never sleeps' },
				{ id: 'turo-ops', name: 'Turo operations', outcome: 'Every car, booking and turnaround on one dashboard.', points: ['Pricing and calendar management', 'Guest messages answered day and night', 'Claims filed on time, with photos at every return'], for: 'Hosts with 3 to 300 cars' },
				{ id: 'doordash-ops', name: 'DoorDash operations', outcome: 'Tablets watched, menus kept in sync, reviews answered.', points: ['Missed orders caught in minutes', 'Sold-out items removed from every app', 'Refund disputes filed with evidence'], for: 'Restaurants on two or more delivery apps' },
				{ id: 'consulting', name: 'Operations consulting', outcome: 'Your operations redesigned by the people who will then run them.', points: ['Every process mapped in plain language', 'What to automate and what to staff', 'A 30-day plan you can hold us to'], for: 'Owners growing faster than they can manage alone' }
			]
		},
		{
			id: 'build', name: 'Build', line: 'Software built around how your business works.',
			items: [
				{ id: 'webapps', name: 'Custom web applications', outcome: 'The tool your business needs but can’t buy off the shelf.', points: ['Designed around your workflow', 'Built on the same technology HostOS runs on', 'You own the code, data and accounts'], for: 'Businesses that have outgrown spreadsheets' },
				{ id: 'websites', name: 'Website design & development', outcome: 'A website that takes bookings, sends quotes and answers questions.', points: ['Designed and built in-house', 'Fast, mobile-first and easy to find on Google', 'Your domain, in your name'], for: 'Shops, clinics, trades and agencies' },
				{ id: 'crm', name: 'CRM & internal tools', outcome: 'Every customer, job and conversation in one place.', points: ['A full history for every customer', 'Pipelines your team will actually keep up to date', 'Portals for clients and staff'], for: 'Service businesses with repeat customers' },
				{ id: 'dashboards', name: 'Dashboards', outcome: 'The numbers that matter, live, on your phone.', points: ['One screen for each role', 'Updated as the work happens', 'No reports to run'], for: 'Owners who want to see the numbers without asking' }
			]
		},
		{
			id: 'connect', name: 'Connect', line: 'Your tools working together, so your people don’t have to copy data between them.',
			items: [
				{ id: 'automation', name: 'Process automation', outcome: 'Repetitive work done automatically, without anyone remembering.', points: ['Reminders, follow-ups and reports', 'Triggered by the tools you already use', 'A person checks anything that matters'], for: 'Any process that runs on a checklist' },
				{ id: 'integrations', name: 'Integrations', outcome: 'Turo, DoorDash, Shopify, Stripe and Google, all connected.', points: ['Orders and bookings flow in automatically', 'Payments and payouts reconciled', 'One place with the correct numbers'], for: 'Businesses juggling five different apps' },
				{ id: 'workflow', name: 'Workflow improvement', outcome: 'Fewer steps, fewer hands, fewer mistakes.', points: ['Every process mapped and timed', 'Wasted steps removed before anything is automated', 'Results measured, not assumed'], for: 'Teams that feel busy but behind' }
			]
		},
		{
			id: 'understand', name: 'Understand', line: 'Know what happened this week, and what is coming next.',
			items: [
				{ id: 'analytics', name: 'Operational analytics', outcome: 'See where the hours and the money go, week by week.', points: ['Utilization, response times and misses', 'Broken down per car, store or technician', 'Alerts when a number changes'], for: 'Owners who are still deciding on gut feel' },
				{ id: 'bi', name: 'Business intelligence', outcome: 'The questions you would ask an analyst, answered from your own data.', points: ['Your data organized and kept in order for you', 'Ask questions in plain English, get answers from your numbers', 'Forecasts you can act on'], for: 'Businesses with several locations or lines of business' }
			]
		}
	]
};

export const INDUSTRIES = {
	eyebrow: 'Industries',
	title: 'Built for businesses with *daily operations* to run.',
	items: [
		{ id: 'turo', name: 'Turo & car rental', hue: '#0a84ff', line: 'Fleets from 3 to 300 cars', href: '/#solutions' },
		{ id: 'doordash', name: 'DoorDash & delivery', hue: '#ff375f', line: 'Restaurants on two or more apps', href: '/#solutions' },
		{ id: 'hospitality', name: 'Hospitality', hue: '#ff9f0a', line: 'Cafés, bars, small hotels', href: '/#solutions' },
		{ id: 'fleet', name: 'Fleet operations', hue: '#30d158', line: 'Vans, trucks, drivers, routes', href: '/#solutions' },
		{ id: 'property', name: 'Property management', hue: '#40c8e0', line: 'Units, tenants, maintenance', href: '/#solutions' },
		{ id: 'services', name: 'Professional & field services', hue: '#8b7cff', line: 'Auto glass, cleaning, trades, agencies', href: '/#solutions' },
		{ id: 'small', name: 'Small businesses', hue: '#f5b301', line: 'Shops, clinics, studios', href: '/#solutions' },
		{ id: 'startups', name: 'Growing startups', hue: '#af52de', line: 'Operations handled before you hire for it', href: '/#solutions' }
	]
};

export const PROOF = {
	eyebrow: 'Results',
	title: 'Real results. *Real businesses.*',
	lede: 'Measured on the businesses we run. Some client partnerships remain confidential under NDA.',
	cases: [
		{ figure: 0, suffix: '', label: 'Missed damage claims', line: 'A 146-car Turo fleet in Texas, six months on HostOS: every return photographed, every claim filed inside the window.', who: '146-car fleet · Founder-operated', when: '2026', hue: '#0a84ff' },
		{ figure: 4, suffix: ' min', label: 'Average guest response time', line: 'Night and weekend messages for 146 cars, answered by operators working from the same dashboard the owner reads each morning.', who: 'Same fleet', when: 'Q2 2026', hue: '#30d158' },
		{ figure: 8, suffix: '', label: 'Industries supported', line: 'Car rental, delivery, online stores, field service, websites, cafés, barbershops and custom software — one login, one team.', who: 'HostOS platform', when: 'Today', hue: '#8b7cff' }
	]
};

export const PLATFORM = {
	eyebrow: 'The platform',
	title: 'One dashboard for your team *and ours*.',
	lede: 'HostOS is the software behind every engagement: one login, one dashboard per line of business. This is what you read each morning.',
	tabs: [
		{ id: 'board', name: 'Today', widgets: [
			{ kind: 'kpi', label: 'Pickups today', value: '14', note: '8 out · 6 back' },
			{ kind: 'kpi', label: 'Guest response time', value: '4 min', note: 'average, last 24 hrs' },
			{ kind: 'kpi', label: 'Needs attention', value: '3', note: '1 license · 2 messages' },
			{ kind: 'list', label: 'Next up', rows: [['09:40', 'Tesla Model 3 · keys out'], ['11:00', 'Civic · return + photos'], ['13:30', 'RAV4 · wash before 15:00'], ['16:15', 'Model Y · airport handoff']] }
		] },
		{ id: 'dispatch', name: 'Dispatch', widgets: [
			{ kind: 'kpi', label: 'Jobs today', value: '11', note: '9 assigned · 2 open' },
			{ kind: 'kpi', label: 'Estimates waiting', value: '2', note: 'followed up this morning' },
			{ kind: 'kpi', label: 'Techs on the road', value: '4', note: 'all on time' },
			{ kind: 'list', label: 'Board', rows: [['Ramon', 'Windshield · Austin · 10:00'], ['Jess', 'Side glass · Round Rock · 11:30'], ['Open', 'Chip repair · Cedar Park · 14:00'], ['Miguel', 'Windshield · Georgetown · 15:30']] }
		] },
		{ id: 'butler', name: 'Butler', widgets: [
			{ kind: 'kpi', label: 'Tasks flagged today', value: '7', note: 'by the Butler' },
			{ kind: 'kpi', label: 'Reviews to answer', value: '2', note: 'DoorDash · Google' },
			{ kind: 'kpi', label: 'Follow-ups sent', value: '5', note: 'estimates · quotes' },
			{ kind: 'list', label: 'Raised', rows: [['08:02', 'Store paused on Uber Eats — reopened'], ['08:15', 'Estimate #1042 waiting 5 days — followed up'], ['09:00', 'License renewal due in 14 days'], ['09:30', 'Garlic rice sold out — removed from 3 apps']] }
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
		role: "Online store founder",
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
		label: "experience per operator · trained by the Founder"
	}
];
export const VOICES = { eyebrow: 'What owners say', title: 'In their *own words*.' };
/** What the work is trusted for — stated, not claimed as prizes we have not won. */
export const RECOGNITION = {
	title: 'Everything under *one roof*.',
	body: 'Operations, design and engineering in one team: the people who answer your customers at 2 AM also build the software they work on. This is what clients hire us for.',
	marks: [
		{ name: 'Web & app development', note: 'Built end to end, and owned by you' },
		{ name: 'Product & UI design', note: 'Screens an owner can read in a minute' },
		{ name: 'Customer service', note: '5+ years of experience per operator · trained by the Founder' },
		{ name: 'Business operations', note: 'Fleets, kitchens, field service, shops' },
		{ name: 'Automation & AI', note: 'In the background, always supervised by a person' }
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
	title: 'Your dashboard on your phone, your desk — *everywhere* the work is.',
	lede: 'One login on iPhone, Android, Mac and Windows. The dashboard your operators work from is the one you read over coffee. Nothing to install, nothing to sync.',
	gains: [
		{ figure: 'Minutes', name: 'To answer every customer', body: 'A guest answered in minutes books with you. One answered tomorrow has already booked elsewhere. Response time is the first number we improve.' },
		{ figure: '0', name: 'Missed orders, claims and estimates', body: 'Paused tablets are reopened within a minute. Damage is photographed at return and filed on time. Estimates are followed up on day two and day five.' },
		{ figure: '4–8 hrs', name: 'Of your week, back', body: 'The inbox, calendar, tablets and follow-ups run without you. You read one dashboard each morning and make the decisions.' },
		{ figure: 'Daily', name: 'Pricing and calendars kept current', body: 'Prices set by demand, turnarounds scheduled at booking, and no cars or tables sitting empty because someone forgot to open them.' },
		{ figure: 'Same day', name: 'Every review and dispute answered', body: 'Reviews answered the same day and disputes filed with evidence — these ratings decide where you appear on Turo, DoorDash and Google.' },
		{ figure: '1', name: 'Dashboard for the whole business', body: 'Fleet, kitchen, field service and shop on one screen, with the same team behind it. Add a line of business without adding a vendor.' }
	]
};
export const WHY = {
	eyebrow: 'Why HostOS Collective',
	title: 'Why a team *from the Philippines* — and why this one.',
	lede: 'Based in the Philippines, working US hours, for business owners in the US and anywhere else.',
	reasons: [
		{ id: 'hours', name: 'Awake when your customers are', body: 'Manila is 13 hours ahead of Texas. Your night is our working day, so a message at 2 AM your time is answered right away, not the next morning.' },
		{ id: 'people', name: 'Experienced operators, not freelancers', body: 'Every operator has five or more years of experience and was trained by the Founder from day one. They are on our payroll, learn your procedures, and are covered when they are off. You get a team, not a freelancer.' },
		{ id: 'one', name: 'One team for people, systems and software', body: 'Most vendors offer one of the three. We run your operations, write them down, and build the software they run on — so nothing falls between an agency, a software vendor and a VA firm.' },
		{ id: 'value', name: 'US-quality service at Philippine cost', body: 'The Philippines is the customer-service capital of the world: fluent in English, aligned with US business, and trained for it. The savings pay for round-the-clock coverage most owners could not afford locally.' },
		{ id: 'own', name: 'You own everything', body: 'Your domain, workspace, data and code stay in your name. If we part ways, you keep all of it — including the plan.' },
		{ id: 'plan', name: 'A plan you can hold us to', body: 'Thirty days, four milestones, and the numbers in a weekly note. If it is not a fit after the free strategy call, you keep the plan at no charge.' }
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
	eyebrow: 'See it run',
	title: 'One day, four businesses, *one dashboard*.',
	lede: 'The same team and the same software, running a different business every few hours.',
	chapters: [
		{ id: 'fleet', time: '07:40', name: 'Fleet', src: clip(4208203, 24), line: '146 cars. Eleven going out before 9 AM.', events: [['07:41', 'Guest asks for an early pickup — answered in 1 min'], ['07:52', 'Model 3 · keys out · lockbox code sent'], ['08:10', 'Civic back · 12 photos · no damage']] },
		{ id: 'kitchen', time: '11:30', name: 'Kitchen', src: clip(8094279, 25), line: 'Lunch rush on three delivery apps.', events: [['11:32', 'Uber Eats store paused — reopened in 40 sec'], ['11:48', 'Garlic rice sold out · removed from 3 apps'], ['12:05', 'Refund dispute filed with photos']] },
		{ id: 'field', time: '14:00', name: 'Field', src: clip(20693196, 25), line: 'A windshield job from call to signature.', events: [['14:02', 'Lead to customer to estimate · one screen'], ['14:15', 'Ramon dispatched · customer texted the ETA'], ['15:40', 'Work order signed on the phone · invoice sent']] },
		{ id: 'shop', time: '17:30', name: 'Shop', src: clip(4177954, 30), line: 'A barbershop’s site goes live.', events: [['17:31', 'Domain in the owner’s name · DNS set'], ['17:45', 'Bookings page connected to the calendar'], ['18:02', 'First online booking · Saturday 10:00']] }
	]
};

export const THIRTY_DAYS = {
	eyebrow: 'How we start',
	title: 'Your first *thirty days*.',
	steps: [
		{ week: 'Week 1', name: 'Map', body: 'We sit inside your operation — the inbox, the calendar, the tablets — and write down how it actually runs. You keep this plan whether or not we continue.' },
		{ week: 'Week 2', name: 'Set up', body: 'We set up your HostOS workspace, write the procedures, and connect Turo, DoorDash, Shopify or whatever you run on. Operators are trained on your business, not on a script.' },
		{ week: 'Week 3', name: 'Run it together', body: 'We run your operations while you watch. Every miss gets a procedure; every repetitive step becomes a candidate for automation.' },
		{ week: 'Week 4', name: 'Hand you the dashboard', body: 'You read the dashboard; we run the operations. A weekly note on the numbers, and a monthly conversation about what to change.' }
	]
};

export const FAQ = {
	eyebrow: 'Common questions',
	title: 'Straight *answers*.',
	items: [
		{ q: 'Do I need to replace my current tools?', a: 'No. HostOS connects to what you already use — Turo, DoorDash, Uber Eats, Shopify, Stripe, Google. If a tool works, we plug it in. If one is missing, we build it.' },
		{ q: 'Who owns the data and accounts?', a: 'You do. Your domain is in your name, your workspace is yours, and anything we build for you comes with the source code. If we part ways, you keep everything.' },
		{ q: 'What happens if an operator leaves?', a: 'Nothing you will notice. Every procedure is written down, every conversation is on the dashboard, and you are covered by a team, not one person. A replacement is trained on your procedures before they touch your inbox.' },
		{ q: 'Is this a VA agency or a software company?', a: 'Both, and that is the point. Our people run your operations, our systems make them repeatable, and our software is where it all happens. You pay for results, not for seats.' },
		{ q: 'How do you use AI?', a: 'As a tool in the background: drafting replies an operator approves, spotting a paused store or a waiting estimate, summarizing the week. It never talks to your customers unsupervised.' },
		{ q: 'Where is the team based?', a: 'In the Philippines, working US hours — or your hours, wherever you are. Every operator is on our payroll, trained on your procedures, and covered when they are off.' },
		{ q: 'What does it cost?', a: 'Operations are a monthly fee based on the hours of coverage you need. Software and websites are quoted from the plan we make in week one. See the prices above. The strategy call is free, and you keep the plan either way.' },
		{ q: 'How fast can we start?', a: 'The free strategy call this week, the plan the week after, and operators on your channels by the end of the month.' }
	]
};

export const FINAL = {
	title: 'Start with *one* operation.',
	body: 'On a free 45-minute call, we map how it runs today, where it loses time and money, and how it would run on HostOS. Not a fit? You keep the plan.',
	channels: [
		{ label: 'Email', value: SITE.email, href: `mailto:${SITE.email}` },
		{ label: 'WhatsApp', value: SITE.phone, href: SITE.whatsapp }
	]
};

export const FOOTER = {
	columns: [
		{ title: 'Services', links: [['Operations', '/#solutions'], ['Software & websites', '/#solutions'], ['Automation', '/#solutions'], ['Pricing', '/#pricing'], ['Results', '/#proof']] },
		{ title: 'Company', links: [['The Collective', `${SITE.url}/team`], ['About', `${SITE.url}/about`], ['Contact', '/#contact']] },
		{ title: 'Platform', links: [['Open HostOS', SITE.app], ['Sign in', SITE.login], ['Install the app', `${SITE.url}/install`]] }
	]
};
