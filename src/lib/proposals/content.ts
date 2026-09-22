import "server-only";
import type { ProposalDoc } from "@/lib/proposals/types";

/**
 * The house story every new proposal starts from.
 *
 * This is the argument HostOS makes to a business that is deciding between
 * us and another VA agency: we are not selling hours, we are installing an
 * operations department — people, written procedures, automation and the
 * software they all work from. Everything here is editable per proposal.
 *
 * Rules the copy follows: plain English for a busy owner, a number only
 * where we can stand behind it, and every claim written so it survives the
 * question "how do you know?". Figures drawn from our own operated fleet are
 * labelled as such.
 */
export const HOUSE_PROPOSAL: ProposalDoc = {
  client: { company: "", contact: "", email: "", industry: "", logoUrl: "", accent: "#5B7CFF" },

  hero: {
    eyebrow: "Operations partnership proposal",
    line1: "We don’t just provide virtual assistants.",
    line2: "We build operations.",
    body: "HostOS combines trained operators, written procedures, AI automation and the software they all work from into one operating system for your business. You stop coordinating the work. You read one dashboard and decide.",
    ctas: [
      { label: "Start partnership", href: "#pricing" },
      { label: "Book strategy call", href: "https://hostoscollective.com/#contact" },
      { label: "Watch product demo", href: "#tour" },
    ],
    figures: [
      { value: "Minutes", label: "to answer every customer, day or night" },
      { value: "30 days", label: "from first call to fully running" },
      { value: "1", label: "dashboard for the whole business" },
      { value: "100%", label: "of your procedures written down and owned by you" },
    ],
  },

  summary: {
    title: "Executive summary",
    lede: "Most growing businesses don’t lose money on strategy. They lose it in the gaps: the message nobody answered, the estimate nobody chased, the claim filed a day late, the process that lives in one person’s head. Those gaps are invisible until they show up in the bank balance.",
    losses: [
      { name: "Manual work", body: "Skilled people spend their day copying data between apps, re-typing orders and chasing the same follow-ups. It is the most expensive way to do the least valuable work." },
      { name: "Inconsistent communication", body: "Two customers ask the same question and get two different answers, at two different speeds, depending on who happened to see the message." },
      { name: "Missed follow-ups", body: "Quotes and estimates go quiet. Nobody is assigned to chase them, so revenue that was already earned quietly leaks away." },
      { name: "Disconnected software", body: "The booking platform, the inbox, the spreadsheet and the accounting tool each hold part of the truth, and none of them agree." },
      { name: "No visibility", body: "The owner finds out something went wrong from a customer or from the bank, not from a dashboard — always too late to fix it cheaply." },
      { name: "Hiring and turnover", body: "Every hire costs months of training, and when they leave, the knowledge leaves with them. The business restarts from zero." },
    ],
    answer: "HostOS closes those gaps as one system. Trained operators work your channels on your hours. Every process is written down as a one-page procedure, so nothing depends on memory. The repetitive parts are automated, with AI drafting and sorting under human supervision. And all of it runs on one dashboard that you and our team read from the same screen. You are not buying assistants. You are installing the operations department you would otherwise spend two years hiring.",
  },

  outcomes: [
    { id: "repetitive", name: "Reduce repetitive work", problem: "Your team re-types the same information into three systems every day.", current: "A person copies bookings into a spreadsheet, updates a calendar, then messages the customer by hand.", solution: "We map the repetitive path, write it down, then automate it end to end — with a person approving anything that carries risk.", impact: "The same work happens in seconds, identically, every time, without anyone remembering to do it.", roi: "Typically 30–60 hours of admin a month returned to the business." },
    { id: "response", name: "Respond faster to customers", problem: "Messages arrive at night and on weekends; answers wait for business hours.", current: "Whoever sees the notification first replies, if they are free. Otherwise it waits.", solution: "Operators cover your channels across the clock, working from written procedures and AI-drafted replies they approve before sending.", impact: "Every customer gets a correct answer in minutes, in your voice, at any hour.", roi: "Faster replies convert more enquiries into bookings — the single biggest lever we move first." },
    { id: "centralize", name: "Centralize operations", problem: "The truth about the business is scattered across five tools and three group chats.", current: "Answering a simple question means opening four tabs and asking two people.", solution: "One HostOS workspace holds jobs, orders, customers and conversations; the tools you already use feed into it.", impact: "One place to look, and everyone — your staff and ours — is looking at it.", roi: "Removes the daily status meeting and the ‘who knows about this?’ search." },
    { id: "satisfaction", name: "Increase customer satisfaction", problem: "Service quality depends on who is working that day.", current: "Good people improvise; standards drift; reviews reflect the worst day, not the average.", solution: "Written procedures, quality checks on conversations, and same-day responses to every review and dispute.", impact: "Consistent service your customers can predict, and ratings that reflect it.", roi: "Ratings decide placement on Turo, DoorDash and Google — which decides volume." },
    { id: "scale", name: "Scale without management complexity", problem: "Every new location or line of business adds another person for you to manage.", current: "Growth means more direct reports, more chasing, more of your week gone.", solution: "You manage one partner. We manage the operators, the coverage, the training and the software.", impact: "Add a vertical without adding a vendor or a management layer.", roi: "Growth stops costing you your calendar." },
    { id: "cost", name: "Reduce operational costs", problem: "Round-the-clock coverage priced locally is out of reach for most owners.", current: "You either pay for a full local hire or leave nights and weekends uncovered.", solution: "Senior operators at a Philippine cost base, supported by automation that removes the low-value hours entirely.", impact: "Coverage you could not previously afford, with the repetitive work stripped out before anyone is paid to do it.", roi: "A US hire for comparable coverage runs $3,500–4,500/mo before benefits." },
    { id: "reporting", name: "Improve reporting", problem: "Numbers arrive late, by request, and rarely the same way twice.", current: "Someone exports a spreadsheet when asked, and the definitions change each time.", solution: "A weekly note and a live dashboard with the same metrics, defined once and measured the same way every week.", impact: "You can compare this week to last week and trust the comparison.", roi: "Decisions made on evidence instead of impression." },
    { id: "standard", name: "Create standardized workflows", problem: "Everyone does the same job slightly differently.", current: "Training is shadowing; quality is personality.", solution: "Every operation becomes a one-page procedure with a named owner and a checked outcome.", impact: "Any trained operator can run the process correctly on their first day.", roi: "Onboarding drops from months to days." },
    { id: "continuity", name: "Business continuity", problem: "One person being sick stops part of the business.", current: "Coverage is informal and depends on goodwill.", solution: "Coverage is a team, not a person; every procedure is documented and every conversation is on the board.", impact: "Illness, holidays and turnover stop being events.", roi: "No single point of failure in daily operations." },
    { id: "knowledge", name: "Knowledge retention", problem: "When someone leaves, the business loses how the work is actually done.", current: "Knowledge lives in heads, chat history and one person’s spreadsheet.", solution: "Documentation is a deliverable, not a by-product — and it is yours, in your account, from week one.", impact: "The business owns its own operating knowledge permanently.", roi: "You keep everything, including if we part ways." },
  ],

  tour: [
    { id: "inbox", name: "Inbox", line: "Every customer conversation, one thread.", how: "Email, chat, platform messages and SMS arrive in one place, assigned to an operator, with the customer’s history beside them.", before: "Four apps, two logins, messages seen by whoever happens to be online.", after: "One queue, an owner on every conversation, nothing unanswered overnight.", timeSaved: "8–12 hrs/week", costSaved: "$600–1,200/mo", image: "", video: "", demoHref: "/app/messages" },
    { id: "ai", name: "AI Assistant", line: "Drafts the reply. A person sends it.", how: "The assistant reads the thread and your procedures, drafts a reply in your voice, and flags anything unusual for a human decision.", before: "Operators write every answer from scratch, or paste from a stale template.", after: "Replies drafted in seconds, approved by a trained operator, consistent every time.", timeSaved: "6–10 hrs/week", costSaved: "$400–900/mo", image: "", video: "", demoHref: "/app/butler" },
    { id: "fleet", name: "Fleet Dashboard", line: "Every vehicle, booking and turnaround.", how: "Pickups, returns, cleaning, damage photos and claim windows tracked per vehicle, with the day laid out in order.", before: "A spreadsheet, the platform app, and a memory for what is due back when.", after: "Today’s movements on one screen, with the risky ones surfaced first.", timeSaved: "5–8 hrs/week", costSaved: "$400–700/mo", image: "", video: "", demoHref: "/app/fleet" },
    { id: "tasks", name: "Task Management", line: "Work with a name and a deadline on it.", how: "Every commitment becomes a task with an owner, a due time and a visible state — raised by a person or by an automation.", before: "Tasks live in chat messages and get lost in the scroll.", after: "Nothing is ‘someone will do it’; everything has a name and a clock.", timeSaved: "3–5 hrs/week", costSaved: "$250–450/mo", image: "", video: "", demoHref: "/app/tasks" },
    { id: "analytics", name: "Analytics", line: "The numbers that decide what to change.", how: "Response times, utilization, misses, revenue and cost per job, measured the same way each week and trended.", before: "Numbers pulled by hand, defined differently each time, arriving late.", after: "One definition, updated live, comparable week to week.", timeSaved: "4–6 hrs/month", costSaved: "$300–500/mo", image: "", video: "", demoHref: "/app/insights" },
    { id: "calendar", name: "Calendar", line: "Bookings, jobs and people in one view.", how: "Availability, scheduled work and staff coverage on a single calendar, synced with the platforms you take bookings on.", before: "Double bookings found by the customer who turns up.", after: "Conflicts caught before they are confirmed.", timeSaved: "2–4 hrs/week", costSaved: "$200–400/mo", image: "", video: "", demoHref: "/app/services/schedule" },
    { id: "crm", name: "CRM", line: "Every customer, with the whole history.", how: "One record per customer holding jobs, messages, quotes, payments and notes — visible to whoever picks up the next conversation.", before: "The relationship lives with whoever handled it last.", after: "Any operator can continue any conversation with full context.", timeSaved: "3–6 hrs/week", costSaved: "$250–550/mo", image: "", video: "", demoHref: "/app/services/customers" },
    { id: "automation", name: "Automation Builder", line: "If this happens, do that — reliably.", how: "Triggers from your tools start a sequence: notify, draft, assign, chase, record. A human approves anything that matters.", before: "Follow-ups depend on someone remembering on a busy day.", after: "The follow-up happens on day two and day five, always.", timeSaved: "10–20 hrs/month", costSaved: "$500–1,100/mo", image: "", video: "", demoHref: "/app/automations" },
    { id: "exec", name: "Executive Dashboard", line: "The five-minute read at 8 AM.", how: "What happened overnight, what needs you today, and which numbers moved — on one screen, on your phone.", before: "Status by interrogation: asking three people how things are.", after: "You read, you decide, you get on with the day.", timeSaved: "3–5 hrs/week", costSaved: "$400–800/mo", image: "", video: "", demoHref: "/app/overview" },
    { id: "notifications", name: "Notifications", line: "Only what deserves your attention.", how: "Routine work never reaches you. Exceptions — a missed window, a paused store, an unhappy customer — do, immediately.", before: "Either no alerts, or so many that they are ignored.", after: "A short list that is always worth reading.", timeSaved: "2–4 hrs/week", costSaved: "$150–350/mo", image: "", video: "", demoHref: "/app/notifications" },
    { id: "timeline", name: "Customer Timeline", line: "What we did for them, in order.", how: "Every touch — message, job, quote, complaint, resolution — on one timeline you can show the customer.", before: "Disputes argued from memory and screenshots.", after: "Evidence on demand, in seconds.", timeSaved: "1–3 hrs/week", costSaved: "$150–300/mo", image: "", video: "", demoHref: "/app/services/customers" },
    { id: "ops", name: "Operations Center", line: "The day as it actually runs.", how: "Live board of jobs, orders and conversations moving through their stages, with the stuck ones highlighted.", before: "Problems discovered at the end of the day.", after: "Problems handled inside the hour.", timeSaved: "5–9 hrs/week", costSaved: "$450–800/mo", image: "", video: "", demoHref: "/app/operations" },
    { id: "admin", name: "Admin Dashboard", line: "Who can see what, and who did what.", how: "Access per member, per line of business, with an audit trail on the actions that matter.", before: "Shared logins and hope.", after: "Named access, revocable in one click, nothing shared.", timeSaved: "1–2 hrs/week", costSaved: "$100–250/mo", image: "", video: "", demoHref: "/app/settings" },
    { id: "team", name: "Team Dashboard", line: "Coverage, load and quality.", how: "Who is on shift, what they are carrying, how fast they are answering, and how their conversations scored on review.", before: "Performance judged on impression.", after: "Coverage and quality both visible and managed by us.", timeSaved: "2–4 hrs/week", costSaved: "$200–400/mo", image: "", video: "", demoHref: "/app/settings/team" },
    { id: "settings", name: "Settings", line: "Your business, configured — not ours.", how: "Hours, escalation rules, tone of voice, integrations and procedures are all yours to change, with our team applying them the same day.", before: "Change requests that take a vendor a fortnight.", after: "The system bends to how you actually work.", timeSaved: "—", costSaved: "—", image: "", video: "", demoHref: "/app/settings" },
  ],

  industries: [
    { id: "turo", name: "Turo Hosts", line: "Fleets from 3 to 300 cars.", problems: ["Guest messages at every hour decide whether a booking happens", "Damage claims missed inside the filing window", "Turnarounds discovered when the next guest calls"], solutions: ["Operators on guest messaging across the clock", "Photos at every return, claims filed same day", "Turnarounds scheduled at the moment of booking"], automations: ["Booking confirmed → cleaning scheduled, guest messaged, calendar blocked", "Trip ends → photo checklist raised, damage reviewed, claim started if needed", "Quiet enquiry → followed up within the hour"], va: ["Guest support", "Claims handling", "Calendar and pricing upkeep"], reporting: "Weekly: response time, utilization, claims filed and won, revenue per vehicle.", roi: "Faster replies raise booking conversion; zero missed claim windows protects revenue already earned." },
    { id: "fleet", name: "Fleet Operators", line: "Vans, trucks, drivers and routes.", problems: ["Maintenance and compliance dates tracked in a spreadsheet", "Driver messages and route changes handled ad hoc", "No single view of vehicle availability"], solutions: ["Compliance calendar with alerts before the deadline", "Dispatch board every driver reads from", "One availability view across the fleet"], automations: ["Service due in 14 days → task raised, garage contacted, vehicle blocked", "Driver reports an issue → job created, replacement assigned, customer notified"], va: ["Dispatch support", "Compliance chasing", "Driver coordination"], reporting: "Weekly: uptime, jobs per vehicle, overdue compliance, cost per route.", roi: "Fewer idle vehicles and no compliance surprises." },
    { id: "doordash", name: "DoorDash", line: "Restaurants on two or more delivery apps.", problems: ["A paused tablet loses an entire dinner service before anyone notices", "Sold-out items keep selling on one app", "Refund disputes go unchallenged"], solutions: ["Tablets watched live and reopened within a minute", "Menu sync across every app the moment an item runs out", "Disputes filed with evidence, same day"], automations: ["Store paused → alert, reopen, missed orders counted and reported", "Item marked sold out → removed from every app automatically", "1-star review → drafted response for approval within the hour"], va: ["Order monitoring", "Menu management", "Review and dispute handling"], reporting: "Weekly: uptime by store, missed orders, disputes filed and recovered, rating trend.", roi: "Recovered orders and refunds typically cover the retainer on their own." },
    { id: "restaurants", name: "Restaurants", line: "Dine-in, delivery and everything between.", problems: ["Phone reservations compete with the floor for attention", "Supplier and staff admin eats the owner’s evening", "Reviews go unanswered"], solutions: ["Reservations and enquiries handled off the floor", "Supplier chasing and rota admin taken over", "Every review answered the same day"], automations: ["Reservation request → confirmed, added to the book, reminder sent", "Stock below threshold → supplier order drafted for approval"], va: ["Reservations", "Supplier admin", "Review management"], reporting: "Weekly: covers, no-show rate, review scores, supplier spend.", roi: "The owner gets their evenings back; no-shows fall with automated reminders." },
    { id: "home", name: "Home Services", line: "Auto glass, cleaning, trades, HVAC.", problems: ["Estimates sent and never chased", "Technicians called constantly for scheduling", "Jobs completed but not invoiced for days"], solutions: ["Every estimate chased on a schedule", "Dispatch board technicians read from their phone", "Invoice raised the moment a job is signed off"], automations: ["Estimate sent → chased day 2 and day 5, escalated day 10", "Job completed → invoice drafted, customer messaged, review requested"], va: ["Booking and dispatch", "Estimate follow-up", "Invoice chasing"], reporting: "Weekly: jobs completed, estimate conversion, days to payment, revenue per technician.", roi: "Estimate follow-up alone usually recovers more than the retainer." },
    { id: "property", name: "Property Management", line: "Units, tenants and maintenance.", problems: ["Maintenance requests arrive by text and get lost", "Rent chasing is awkward and inconsistent", "Turnovers are organized by phone call"], solutions: ["One intake for every request, with an owner and a clock", "Rent reminders sent on a schedule, escalation by policy", "Turnover checklists run the same way every time"], automations: ["Maintenance request → triaged, contractor assigned, tenant updated", "Rent overdue → reminder sequence, then escalation to the manager"], va: ["Tenant communication", "Contractor coordination", "Rent chasing"], reporting: "Weekly: open requests by age, occupancy, arrears, turnover time.", roi: "Faster turnovers and fewer arrears days." },
    { id: "realestate", name: "Real Estate", line: "Agents and small brokerages.", problems: ["Leads go cold in the first hour", "Listing admin competes with selling", "Follow-up depends on the agent’s memory"], solutions: ["Every lead contacted within minutes, at any hour", "Listing and compliance paperwork handled for you", "A follow-up cadence that runs itself"], automations: ["New lead → qualified, routed to the right agent, reminder set", "Viewing booked → confirmation, reminder, feedback request"], va: ["Lead qualification", "Listing admin", "Viewing coordination"], reporting: "Weekly: lead response time, viewings booked, pipeline by stage.", roi: "Speed to first contact is the strongest predictor of conversion." },
    { id: "startups", name: "Startups", line: "Operations before the ops hire.", problems: ["Founders doing support, billing and scheduling", "No documented process to hand over", "Tools bought faster than they are connected"], solutions: ["An operations layer that runs without a full-time hire", "Documentation written as we go, owned by you", "Integrations that make the tools agree"], automations: ["Signup → onboarding sequence, CRM record, first-week check-in", "Support request → triaged, answered, escalated by rule"], va: ["Customer support", "Billing admin", "Research and data"], reporting: "Weekly: support volume and response time, onboarding completion, churn signals.", roi: "Operations coverage at a fraction of a first ops hire." },
    { id: "agencies", name: "Agencies", line: "Client work without the admin drag.", problems: ["Billable people doing unbillable admin", "Client reporting done by hand each month", "Project status scattered across tools"], solutions: ["Admin lifted off the billable team", "Reporting generated and checked by us", "One board per client, visible to everyone"], automations: ["Project stage change → client update drafted, next task assigned", "Month end → report assembled from live data for review"], va: ["Project admin", "Client reporting", "Scheduling and QA"], reporting: "Weekly: utilization, project health, overdue deliverables.", roi: "Billable hours returned to billable work." },
    { id: "small", name: "Small Businesses", line: "Shops, clinics and studios.", problems: ["The owner is the switchboard", "Appointments managed by phone tag", "Online presence neglected because there is no time"], solutions: ["Phone, email and chat answered by trained operators", "Bookings handled end to end", "Website, listings and reviews maintained"], automations: ["Appointment booked → confirmation, reminder, follow-up", "Missed call → text sent within a minute offering to book"], va: ["Front desk", "Booking management", "Review and listing upkeep"], reporting: "Weekly: calls answered, bookings made, no-shows, review scores.", roi: "Missed-call recovery alone typically pays for the engagement." },
  ],

  automations: [
    { id: "guest", name: "Guest messages", trigger: "A customer message arrives on any channel, at any hour", steps: ["Thread matched to the customer record", "AI drafts a reply from your procedures", "Operator reviews, corrects and sends", "Anything unusual escalated by rule"], outcome: "Every message answered in minutes, in your voice, correctly.", saves: "8–12 hrs/week" },
    { id: "lead", name: "Lead qualification", trigger: "A new enquiry arrives from the site, a platform or a call", steps: ["Qualifying questions asked immediately", "Answers written to the CRM", "Routed to the right person or queue", "Reminder set if it goes quiet"], outcome: "No lead sits unattended, and the right person gets it.", saves: "4–8 hrs/week" },
    { id: "email", name: "Email routing", trigger: "Mail lands in a shared inbox", steps: ["Classified by intent", "Assigned to the owning queue", "Low-value mail archived by rule", "Urgent mail raised as a task"], outcome: "A shared inbox that never becomes a swamp.", saves: "3–6 hrs/week" },
    { id: "crm", name: "CRM updates", trigger: "Anything happens on a job, order or conversation", steps: ["Record updated automatically", "Stage advanced where the rule is unambiguous", "Owner notified of the change"], outcome: "The CRM is accurate without anyone maintaining it.", saves: "4–7 hrs/week" },
    { id: "followup", name: "Follow-up reminders", trigger: "A quote or estimate has gone quiet", steps: ["Chased on day two", "Chased again on day five", "Escalated to a call on day ten", "Marked lost with a reason if unanswered"], outcome: "Revenue already earned stops leaking.", saves: "Recovers quotes that would otherwise be abandoned" },
    { id: "assign", name: "Task assignment", trigger: "Work is created by a person or a rule", steps: ["Owner chosen by skill and load", "Due time set from the procedure", "Reminder before it is late", "Reassigned automatically if unstarted"], outcome: "Nothing waits for someone to volunteer.", saves: "3–5 hrs/week" },
    { id: "booking", name: "Booking workflow", trigger: "A booking is confirmed", steps: ["Calendar blocked", "Preparation task raised", "Customer confirmation and reminder sent", "Post-visit follow-up scheduled"], outcome: "Every booking runs the same way, start to finish.", saves: "5–9 hrs/week" },
    { id: "incident", name: "Incident workflow", trigger: "Something breaks: a paused store, damage, a complaint", steps: ["Incident raised with a severity", "Owner assigned and customer informed", "Evidence gathered and attached", "Resolution recorded and reviewed weekly"], outcome: "Problems handled inside the hour, with a record.", saves: "Prevents the costs that follow a slow response" },
    { id: "calendar", name: "Calendar sync", trigger: "Availability changes anywhere", steps: ["Change propagated to every connected platform", "Conflicts detected before confirmation", "Staff coverage re-checked"], outcome: "No double bookings, no manual re-entry.", saves: "2–4 hrs/week" },
    { id: "reporting", name: "Executive reporting", trigger: "Every Monday morning", steps: ["Metrics assembled from live data", "Week-on-week movement calculated", "Anomalies flagged for comment", "Note reviewed by your lead operator and sent"], outcome: "A five-minute read that tells you what changed and why.", saves: "4–6 hrs/month" },
  ],

  humanOps: {
    lede: "Every operator on your account is a virtual assistant with five or more years in customer and business operations, trained by our Founder from day one, on our payroll, and covered when they are off. They learn your procedures before they touch your inbox.",
    roles: [
      { name: "Guest Support", body: "Booking questions, changes and problems answered in your voice, on your hours or around the clock." },
      { name: "Customer Service", body: "Complaints, refunds and escalations handled to a written standard, with quality checks on the conversations." },
      { name: "Admin", body: "The paperwork that follows the work: records, filings, supplier chasing, reconciliation support." },
      { name: "Email", body: "Shared inboxes triaged, answered and kept at zero, with urgent mail raised as tasks." },
      { name: "Scheduling", body: "Calendars, dispatch and coverage managed so the day is arranged before it starts." },
      { name: "Research", body: "Competitor pricing, supplier options, lead lists and market checks, delivered as a decision, not a spreadsheet." },
      { name: "Data Entry", body: "Accurate records where automation cannot reach — and a written case for automating it next." },
      { name: "Quality Assurance", body: "Conversations and jobs reviewed against the procedure, with findings fed back into training." },
      { name: "Documentation", body: "Every process written as a one-page procedure, kept current, owned by you." },
      { name: "Operations", body: "A lead operator who owns your account, runs the weekly review, and is accountable for the numbers." },
    ],
    why: "AI alone is fast and confidently wrong at the worst moment. People alone are accurate and cannot be awake at 3 AM for the price of a subscription. Together, the assistant drafts, sorts, chases and summarizes, and a trained operator decides — so you get machine speed with human judgement, and a person is always accountable for what your customer receives.",
  },

  software: {
    lede: "We build the software your operation runs on, and we run our own company on it. What we sell you is what we use every day — the same board, the same automations, the same dashboards.",
    capabilities: [
      { name: "Custom Dashboards", body: "One screen per role, built around the decisions that role actually makes." },
      { name: "Internal Tools", body: "The tool your business needs and cannot buy, built around your workflow." },
      { name: "Chrome Extensions", body: "Where a platform has no API, we automate the browser your team already uses." },
      { name: "CRM", body: "Customer records, pipelines and portals that your team will actually keep current." },
      { name: "SaaS Platforms", body: "Multi-tenant products, billing and admin, built to be handed over and owned." },
      { name: "Web Applications", body: "Fast, findable sites and apps that book, quote and answer." },
      { name: "Client Portals", body: "A branded place for your customers to see status, documents and invoices." },
      { name: "Admin Portals", body: "Named access, roles and audit trails — no shared logins." },
      { name: "API Integrations", body: "Turo, DoorDash, Shopify, Stripe and Google connected so the numbers agree." },
      { name: "AI Systems", body: "Assistants grounded in your procedures, with human approval on anything that matters." },
    ],
    stack: ["SvelteKit", "Next.js", "TypeScript", "Supabase", "PostgreSQL", "Cloudflare", "Vercel", "Resend", "OpenAI", "Anthropic"],
  },

  caseStudies: [
    {
      id: "fleet-146",
      client: "146-car Turo fleet · Texas",
      industry: "Car rental",
      challenge: "The owner and two admins were running a 146-vehicle fleet from four spreadsheets, three group chats and the Turo app — roughly 60 hours a week of operations, with guest messages answered whenever someone saw them and damage claims regularly missed inside the filing window.",
      implementation: ["Mapped the operation in week one and wrote a procedure per process", "Moved the fleet onto one HostOS board", "Put six operators on guest messaging around the clock", "Automated turnaround scheduling at the moment of booking", "Photo checklist at every return, with claims filed the same day"],
      results: [
        { value: "0", label: "missed damage claims" },
        { value: "Minutes", label: "median guest reply, day or night" },
        { value: "~4 hrs", label: "owner’s week on operations, from ~60" },
      ],
      hoursSaved: "~56 hrs/week",
      revenue: "Claims recovered inside every window",
      response: "From ‘when seen’ to minutes",
      automations: "Turnarounds, photo checklist, claim filing, guest replies",
      timeline: "Live within 30 days",
      roi: "Founder-operated fleet · measured over six months on HostOS",
      image: "",
      video: "",
    },
    {
      id: "multi-vertical",
      client: "HostOS platform",
      industry: "Cross-vertical",
      challenge: "Owners running more than one line of business had to buy a separate vendor and a separate tool for each — car rental, delivery, field service, retail — with no common view and no shared team.",
      implementation: ["Built one workspace with a dashboard per line of business", "One login and one operator team across all of them", "Shared procedures and shared reporting definitions"],
      results: [
        { value: "8", label: "industries on one workspace" },
        { value: "1", label: "login, one team, one board" },
        { value: "0", label: "extra vendors to add a vertical" },
      ],
      hoursSaved: "Removes duplicated admin per vertical",
      revenue: "Growth without a new vendor each time",
      response: "Consistent across every line of business",
      automations: "Shared automation library across verticals",
      timeline: "Available today",
      roi: "Add a line of business without adding management overhead",
      image: "",
      video: "",
    },
  ],

  gallery: [
    { id: "dashboard", name: "Dashboard walkthrough", body: "The 8 AM read: what happened overnight and what needs you today.", duration: "3:20", thumb: "", video: "" },
    { id: "beforeafter", name: "Before / after workflow", body: "The same operation run manually, then run on HostOS.", duration: "4:05", thumb: "", video: "" },
    { id: "inbox", name: "Inbox in operation", body: "A night of guest messages handled end to end.", duration: "2:45", thumb: "", video: "" },
    { id: "automation", name: "Automation recording", body: "Building a follow-up sequence from trigger to outcome.", duration: "5:10", thumb: "", video: "" },
    { id: "analytics", name: "Analytics walkthrough", body: "How the weekly numbers are defined and read.", duration: "3:35", thumb: "", video: "" },
    { id: "onboarding", name: "Client onboarding", body: "Week one to go-live, compressed.", duration: "6:00", thumb: "", video: "" },
    { id: "website", name: "Website transformation", body: "A site rebuilt to book, quote and answer.", duration: "2:30", thumb: "", video: "" },
    { id: "extension", name: "Chrome extension demo", body: "Automating a platform that has no API.", duration: "3:15", thumb: "", video: "" },
    { id: "exec", name: "Executive dashboard", body: "The owner’s five-minute view.", duration: "2:20", thumb: "", video: "" },
    { id: "ai", name: "AI assistant demo", body: "Draft, review, approve, send — with a person in the loop.", duration: "4:40", thumb: "", video: "" },
  ],

  beforeAfter: {
    before: [
      "Several spreadsheets holding different versions of the truth",
      "Manual re-entry between booking, inbox and accounting",
      "Messages missed overnight and at weekends",
      "Response time measured in hours or days",
      "Tools that do not talk to each other",
      "No analytics beyond the bank balance",
      "Process knowledge inside one person’s head",
      "The owner as the switchboard",
    ],
    after: [
      "One platform holding jobs, orders, customers and conversations",
      "AI drafting and sorting under human supervision",
      "An operations dashboard your team and ours both read",
      "Automation for every repetitive step",
      "Real-time reporting with one definition per metric",
      "Coverage and quality visible across the team",
      "Documented procedures owned by your business",
      "The owner reading one board and deciding",
    ],
  },

  roadmap: [
    { week: "Week 1", name: "Discovery", body: "We sit inside your operation — the inbox, the calendar, the tablets — and write down how it actually runs today, where it leaks and what it costs.", deliverables: ["Operations map", "Prioritised list of what to automate and what to staff", "Success metrics agreed in writing"] },
    { week: "Week 2", name: "System setup", body: "Your HostOS workspace, your procedures, and the connections to the platforms you already run on.", deliverables: ["Workspace and dashboards configured", "Integrations connected", "First procedures written"] },
    { week: "Week 3", name: "Training", body: "Your named operators train on your business, not on a script, and we run alongside your team while you watch.", deliverables: ["Operators trained and shadowing", "First automations live", "Escalation rules agreed"] },
    { week: "Week 4", name: "Go live", body: "We take the operation. You read the board.", deliverables: ["Full coverage begins", "Weekly reporting starts", "Named lead operator accountable"] },
    { week: "Week 5+", name: "Optimization", body: "Every miss becomes a procedure; every repetitive step becomes a candidate for automation. The numbers are reviewed weekly and the system improves monthly.", deliverables: ["Weekly numbers note", "Monthly review and roadmap", "Continuous automation of the repetitive work"] },
  ],

  pricing: {
    lede: "You are not buying hours. You are buying an operations department: people, procedures, automation and the software they run on. Every tier includes all four — they differ in coverage and build capacity.",
    tiers: [
      { id: "starter", name: "Starter", forWho: "Solo operators and owner-run businesses", price: "$1,490", period: "/mo", note: "One dedicated operator on your hours", vaHours: "40 hrs/week, one dedicated operator", automations: "Up to 5 live automations", devHours: "—", reporting: "Weekly numbers note", meetings: "Monthly review", support: "Business hours, your timezone", sla: "1 hour first response", roi: "Replaces a part-time hire and the admin that comes with it", included: ["One dedicated operator, trained by the Founder", "HostOS workspace and dashboards", "Procedures written for your business", "Up to 5 automations", "Weekly numbers note", "Quality checks on conversations"], featured: false },
      { id: "growth", name: "Growth", forWho: "Growing businesses with real daily volume", price: "$2,890", period: "/mo", note: "Two operators, cover for time off", vaHours: "80 hrs/week across two operators", automations: "Up to 15 live automations", devHours: "5 hrs/month of custom work", reporting: "Weekly note plus live dashboard", meetings: "Fortnightly review", support: "Extended hours, cover for time off", sla: "30 minutes first response", roi: "Typically returns 30–60 hours of admin a month", included: ["Everything in Starter", "Two operators with mutual cover", "Up to 15 automations", "5 hrs/month custom development", "Live executive dashboard", "Fortnightly review with your lead operator"], featured: true },
      { id: "professional", name: "Professional", forWho: "Established businesses that cannot go quiet", price: "$5,900", period: "/mo", note: "Around-the-clock team coverage", vaHours: "24/7 team coverage with a named lead", automations: "Unlimited automations, actively tuned", devHours: "15 hrs/month of custom work", reporting: "Live dashboards plus a monthly business review", meetings: "Weekly review", support: "24/7, including weekends", sla: "15 minutes first response", roi: "Coverage a comparable US team could not match at this cost", included: ["Everything in Growth", "Round-the-clock coverage as a team", "Named lead operator accountable for your numbers", "Unlimited automations, tuned monthly", "15 hrs/month custom development", "Weekly review and monthly business review"], featured: false },
      { id: "enterprise", name: "Enterprise", forWho: "Multi-location and multi-vertical operations", price: "Custom", period: "", note: "Scoped to your operation", vaHours: "Scoped per location and line of business", automations: "Unlimited, with a dedicated automation engineer", devHours: "Dedicated development capacity", reporting: "Custom dashboards and board-level reporting", meetings: "Weekly operational, monthly executive", support: "24/7 with named escalation path", sla: "Agreed in writing", roi: "Quoted against the operation we map in week one", included: ["Everything in Professional", "Multi-location and multi-vertical coverage", "Dedicated development capacity", "Custom software and integrations", "Board-level reporting", "Contractual SLAs and named escalation"], featured: false },
    ],
    footnote: "All prices in USD. Tool subscriptions and ad spend are billed to you directly. Custom software is priced on scope, technical requirements, integrations, complexity, timeline and business goals. Every engagement starts with a free 45-minute strategy call — no obligation, and you keep the plan either way.",
  },

  philosophy: {
    title: "Why HostOS",
    body: "Most vendors sell one of three things: people, software, or advice. Each on its own leaves the hardest part to you — making them work together. We do all three, which is why nothing falls between an agency, a SaaS and a VA firm.",
    points: [
      { name: "We don’t sell labor", body: "Hours are the input, not the product. What you are buying is an operation that runs correctly whether or not anyone remembers to run it." },
      { name: "We build systems", body: "Every engagement leaves behind a working system — procedures, automations and software — not just a person who knew what to do." },
      { name: "We create documentation", body: "Documentation is a deliverable from week one, written as we go, kept current, and owned by you." },
      { name: "We automate repetitive work", body: "If a task is the same every time, it should not be a job. We remove it before anyone is paid to do it." },
      { name: "We make businesses easier to run", body: "The measure of our work is simple: how much of your week the business takes back." },
    ],
  },

  faq: [
    { q: "Why not Upwork?", a: "Upwork gives you a freelancer. You still write the procedures, manage the person, cover their time off, and own the risk when they disappear. We give you a trained team, the written procedures, the automation, the software and a named lead who is accountable for the numbers." },
    { q: "Why not Fiverr?", a: "Fiverr is built for one-off tasks. Operations are not tasks, they are processes that run every day and must not break. Nothing on a task marketplace covers continuity, quality assurance or knowledge retention." },
    { q: "Why not hire locally?", a: "A local hire for comparable coverage runs $3,500–4,500 a month before benefits, and one person cannot cover nights and weekends. You also carry recruitment, training, management and turnover. With us, coverage is a team, and the procedures stay with your business." },
    { q: "How is AI used?", a: "As a tool in the background: drafting replies an operator approves, spotting a paused store or a waiting estimate, and summarizing the week. It never speaks to your customers unsupervised, and it is never the reason to hire us." },
    { q: "Who owns the documentation?", a: "You do, from week one. Procedures, workspace, data and any code we write are in your name and delivered with the source. If we part ways, you keep all of it." },
    { q: "Can we cancel?", a: "Yes. Monthly engagements run month to month with 30 days’ notice. You leave with your documentation, your data, your accounts and your automations." },
    { q: "How fast can we start?", a: "The free strategy call this week, the plan the week after, and operators on your channels by the end of the month." },
    { q: "Do you sign NDAs?", a: "Yes, as a matter of course, before discovery begins. Several of our client partnerships remain confidential under NDA." },
    { q: "What if we already have VAs?", a: "We work with them. Often the fastest win is to keep your people and give them the procedures, the automation and the board they have been missing — we train them on it and manage the system around them." },
  ],

  finalCta: {
    title: "Let’s build your operations together.",
    body: "Bring one operation to a free 45-minute strategy call. We map how it runs today, where it loses time and money, and how it would run on HostOS. Not a fit? You keep the plan.",
  },
};
