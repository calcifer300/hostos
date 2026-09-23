import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Car,
  ChefHat,
  Puzzle,
  BarChart3,
  Workflow,
  Building2,
  Users,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Headset,
  Sparkles,
  ListChecks,
  BookMarked,
  Bell,
  Clock3,
  Radar,
  Mail,
  Calendar,
  Hash,
  Phone,
  Database,
  Globe,
  Smartphone,
  TrendingUp,
  LayoutGrid,
  Coffee,
  Scissors,
  Rocket,
  MapPin,
  Briefcase,
  Wrench,
  MessageSquareText,
  GraduationCap,
  Layers,
  Award,
  Radio,
} from "lucide-react";

/**
 * Every word on the landing page, in one file, so copy can be edited without
 * touching layout.
 *
 * The site sells HostOS Collective — a business-solutions company: virtual
 * assistance and customer support, custom systems and automation, websites,
 * apps and marketing — and HostOS, the operations platform the Collective
 * built and runs everything on. Structure and service catalogue follow the
 * company's previous site; the copy is written for the company, never for a
 * person.
 */

export const HERO = {
  eyebrow: "Full-stack · Automation · Support",
  title: ["Business solutions built to", "save time and grow revenue."],
  description:
    "HostOS Collective helps businesses with websites, automation, custom systems and reliable virtual support — all run on HostOS, the operations platform we built and use ourselves every day.",
  primaryCta: { label: "Book a Free Strategy Call", href: "#contact" },
  secondaryCta: { label: "View our services", href: "#services" },
  facts: [
    { value: "10+ years", label: "professional experience" },
    { value: "Full-stack", label: "development & automation" },
    { value: "Trained team", label: "VA & support specialists" },
    { value: "Proven in", label: "Turo, DoorDash, telecom, SaaS" },
  ],
} as const;

export interface Service {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Marks the Collective's own product among the services. */
  featured?: boolean;
}

export const SERVICES: Service[] = [
  {
    icon: Headset,
    title: "Virtual Assistant & Admin Support",
    description: "Inbox, calendar, research, data entry, scheduling, and more — handled by a trained team, inside your HostOS workspace.",
  },
  {
    icon: Phone,
    title: "Customer Support (Phone, Email, Chat)",
    description: "A professional support team with 5+ years of BPO experience, covering every channel your customers use.",
  },
  {
    icon: Workflow,
    title: "AI Automation & Workflows",
    description: "Automate repetitive tasks and streamline your business operations, from sync loops to alerts to drafted replies.",
  },
  {
    icon: LayoutGrid,
    title: "Dashboards & Internal Tools",
    description: "Custom dashboards and tools that simplify how you work — built on the same platform that powers HostOS.",
  },
  {
    icon: Globe,
    title: "Websites & Web Applications",
    description: "Fast, responsive websites and web apps that represent your brand and convert visitors into customers.",
  },
  {
    icon: Smartphone,
    title: "Mobile App Development",
    description: "iOS & Android apps that deliver great user experiences, including installable web apps with no app store in the way.",
  },
  {
    icon: TrendingUp,
    title: "SEO & Digital Marketing",
    description: "Increase visibility, attract leads, and grow your business with search, content and campaign automation.",
  },
  {
    icon: Users,
    title: "CRM & Lead Management",
    description: "Organize leads, automate follow-ups, and close more deals with a pipeline that runs itself.",
  },
  {
    icon: Bot,
    title: "The HostOS platform",
    description: "Our own operations software: a dashboard per line of business, an AI Butler, and the Companion — included with every engagement.",
    featured: true,
  },
];

export interface Industry {
  icon: LucideIcon;
  label: string;
}

export const INDUSTRIES: Industry[] = [
  { icon: UtensilsCrossed, label: "Restaurants" },
  { icon: Coffee, label: "Coffee shops" },
  { icon: Scissors, label: "Salons & barbers" },
  { icon: Car, label: "Turo hosts" },
  { icon: Truck, label: "Fleet operators" },
  { icon: Rocket, label: "Startups" },
  { icon: ShoppingBag, label: "E-commerce" },
  { icon: MapPin, label: "Local businesses" },
  { icon: Building2, label: "SMBs" },
  { icon: Briefcase, label: "Service businesses" },
  { icon: Sparkles, label: "And more" },
];

export interface Stat {
  value: number;
  suffix: string;
  label: string;
}

export const STATS: Stat[] = [
  { value: 10, suffix: "+", label: "Years professional experience" },
  { value: 50, suffix: "+", label: "Clients served" },
  { value: 120, suffix: "+", label: "Projects completed" },
  { value: 98, suffix: "%", label: "Client satisfaction" },
];

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Bento grid span. */
  span?: "wide" | "tall" | "normal";
}

export const FEATURES: Feature[] = [
  {
    icon: LayoutGrid,
    title: "A dashboard per line of business",
    description:
      "A Turo fleet is not run from the same screen as a DoorDash kitchen or a Shopify store. Each business gets its own dashboard, its own widgets and its own saved layout — and Home ties them together.",
    span: "wide",
  },
  {
    icon: Radar,
    title: "Risk caught early",
    description: "License status, protection plan and guest track record read straight from Turo before the trip starts.",
  },
  {
    icon: BookMarked,
    title: "725 policy articles, searchable",
    description: "Turo's help centre indexed and ranked, and cited inside every AI draft.",
  },
  {
    icon: Bell,
    title: "Alerts that reach people",
    description: "Desktop pings for the person at the screen, email for the co-host who isn't. Sent once per problem, never twelve times.",
  },
  {
    icon: Clock3,
    title: "Timezone-native",
    description: "A Kahului pickup reads as Hawaii time, not yours. Split-state addresses are flagged for a human to confirm.",
  },
  {
    icon: ListChecks,
    title: "Tasks, notifications, activity",
    description: "One task board, one bell and one event stream shared by every business you run — filed by people, by automations and by the Butler.",
    span: "tall",
  },
  {
    icon: Database,
    title: "One database, one login",
    description: "Multi-tenant from day one. Every business is a workspace with members, roles and permissions — switch on the modules it needs.",
  },
];

export interface AutomationStep {
  cadence: string;
  title: string;
  description: string;
}

export const AUTOMATIONS: AutomationStep[] = [
  { cadence: "Every minute", title: "Trip and vehicle sync", description: "The Companion reads your Turo board and pushes every change — reschedules, cancellations, plate swaps." },
  { cadence: "Every minute", title: "Message sync", description: "New guest messages appear in HostOS within about sixty seconds, threaded per reservation." },
  { cadence: "Every 5 minutes", title: "Alert poll", description: "Unverified licenses, zero-deductible bookings and thin margins are raised once and emailed to whoever should know." },
  { cadence: "Every 10 minutes", title: "Risk enrichment", description: "Protection plan, guest rating and trip count, read from Turo's own APIs with no extra tabs." },
  { cadence: "Every 15 minutes", title: "License sweep", description: "Check-ins inside the next 24 hours are re-checked for a confirmed driver's license." },
  { cadence: "Hourly", title: "Store sync", description: "Shopify products, inventory levels and orders pulled through the Admin API, with low-stock alerts raised once." },
  { cadence: "Every 6 hours", title: "Fleet calendar", description: "The full vehicle roster and nightly rates, so earnings estimates stay current." },
  { cadence: "Daily", title: "Digest", description: "One email with today's pickups, returns, flags and estimated earnings, per workspace." },
];

export interface Integration {
  icon: LucideIcon;
  name: string;
  status: "live" | "beta" | "soon";
  description: string;
}

export const INTEGRATIONS: Integration[] = [
  { icon: Car, name: "Turo", status: "live", description: "Trips, vehicles, messages, license status, protection plans, calendar pricing." },
  { icon: ChefHat, name: "DoorDash Merchant Portal", status: "beta", description: "Store status watched by the Companion; menu and order exports imported." },
  { icon: ShoppingBag, name: "Shopify", status: "beta", description: "Products, inventory and orders through the Admin API, synced hourly and on demand." },
  { icon: Puzzle, name: "Chrome (Companion)", status: "live", description: "The extension that does the reading — one install, one pairing key." },
  { icon: Mail, name: "Gmail", status: "live", description: "Optional. Turo notification emails parsed into a timeline." },
  { icon: Mail, name: "Email alerts & digests", status: "live", description: "Per-workspace recipients, sent once per problem." },
  { icon: Calendar, name: "Google Calendar", status: "soon", description: "Pickups and returns on your calendar." },
  { icon: Hash, name: "Slack", status: "soon", description: "Alerts and drafts where your team already talks." },
];

/* ---------------------------------------------------------------- team */

export interface TeamPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const TEAM_POINTS: TeamPoint[] = [
  {
    icon: GraduationCap,
    title: "Regularly trained",
    description: "Every team member goes through continuous, hands-on training sessions led by our founder to stay sharp, aligned and ready to perform at the highest level.",
  },
  {
    icon: Layers,
    title: "Process-driven",
    description: "Shared systems, standards and documented workflows — so every client gets the same consistent, professional experience.",
  },
  {
    icon: Award,
    title: "5+ years BPO experience",
    description: "Each VA on the team brings at least five years of BPO industry experience. They know how to handle real customer interactions with confidence.",
  },
  {
    icon: Radio,
    title: "Multi-channel ready",
    description: "Phone, email and live chat — the team is trained to deliver professional support across every channel your business needs.",
  },
];

export const TEAM_PROMISES = [
  "Consistent performance across the entire team",
  "No one is left behind — every member is equipped to perform",
  "Trained to match your brand voice and standards",
  "Scalable support that grows with your business",
  "Clear communication and professional accountability",
  "Top-tier service delivery, regardless of the task",
];

export const CHANNELS = [
  { icon: Phone, title: "Phone support", description: "Professional inbound & outbound calls" },
  { icon: Mail, title: "Email support", description: "Timely, clear, and well-written responses" },
  { icon: MessageSquareText, title: "Live chat", description: "Fast, friendly real-time assistance" },
];

export const WHY_US = [
  "Reliable & professional team",
  "Clear communication",
  "Tailored solutions for your needs",
  "Flexible & scalable support",
  "Focus on saving you time and money",
  "Real business value, not fluff",
  "Technical and operational expertise",
];

/* ---------------------------------------------------------------- work */

export interface Project {
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
  tags: string[];
}

export const PROJECTS: Project[] = [
  {
    icon: UtensilsCrossed,
    category: "Web app + automation",
    title: "Restaurant ordering platform",
    description: "End-to-end ordering system with real-time tracking, automated notifications, and a seller dashboard for a growing food business.",
    tags: ["React", "Automation", "CRM"],
  },
  {
    icon: Car,
    category: "Dashboard + VA support",
    title: "Turo fleet management dashboard",
    description: "Custom dashboard for managing a 20-car Turo fleet — booking sync, maintenance tracking, and daily VA check-ins.",
    tags: ["Dashboard", "VA", "Operations"],
  },
  {
    icon: TrendingUp,
    category: "SEO + email automation",
    title: "E-commerce lead funnel",
    description: "Full lead-capture funnel with landing pages, automated email sequences, and CRM integration that increased conversions by 40%.",
    tags: ["SEO", "Email", "Marketing"],
  },
];

export interface ProcessStep {
  step: string;
  title: string;
  description: string;
}

export const PROCESS: ProcessStep[] = [
  { step: "01", title: "Discovery call", description: "We learn about your business, goals, and pain points." },
  { step: "02", title: "Custom plan", description: "We design a tailored solution that fits your needs and budget." },
  { step: "03", title: "Build & launch", description: "We build, test, and deploy — keeping you in the loop." },
  { step: "04", title: "Ongoing support", description: "We stay with you for maintenance, updates, and growth." },
];

/* ---------------------------------------------------------- testimonials */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "HostOS Collective completely transformed how we handle online orders. Our operations are smoother, and we've seen a 30% boost in repeat customers since launching the new system.",
    name: "Zack Holmes",
    role: "Restaurant Owner",
  },
  {
    quote:
      "From building our website to setting up automated email campaigns, HostOS Collective delivered everything on time and on budget. Truly a one-stop shop for growing businesses.",
    name: "Miguel Chavez",
    role: "E-commerce Startup",
  },
  {
    quote:
      "Having a dedicated VA team that manages my fleet bookings and guest communication has been a game changer. Professional, reliable, and always responsive.",
    name: "Matt Tolley",
    role: "Turo Host",
  },
];

/* --------------------------------------------------------------- pricing */

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  href?: string;
}

export const PRICING: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "during early access",
    description: "One HostOS workspace with any modules switched on, plus the Companion.",
    features: ["1 workspace, any modules", "HostOS Companion", "Dashboards, board, messaging, tasks", "Daily digest", "Community support"],
    cta: "Launch HostOS",
  },
  {
    name: "Pro",
    price: "$49",
    period: "per workspace / month",
    description: "For operators running more than one thing, with the Butler on every surface.",
    features: ["Unlimited workspaces", "AI Butler drafting, tasks and briefings", "Email alerts to your team", "Policy library grounding", "Priority support"],
    highlighted: true,
    cta: "Start with Pro",
  },
  {
    name: "Collective",
    price: "Custom",
    period: "services, VAs and custom builds",
    description: "Virtual assistants, custom systems, websites, apps and marketing — scoped to your business, with HostOS included.",
    features: ["Everything in Pro", "Dedicated VA & support team", "Custom automation and internal tools", "Websites, apps, SEO", "Onboarding with HostOS Collective"],
    cta: "Book a Free Strategy Call",
    href: "#contact",
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: "What does HostOS Collective do?",
    a: "We are a business-solutions company. We provide trained virtual assistants and customer support, build custom systems, automation, dashboards, websites and mobile apps, and run SEO and digital marketing. Everything we deliver runs on HostOS — the operations platform we built and use ourselves every day.",
  },
  {
    q: "What is HostOS?",
    a: "HostOS is our operations platform for any business. Each line of business you run gets its own dashboard — fleet operations (Turo), restaurant operations (DoorDash), commerce operations (Shopify) — while teams, tasks, notifications, automation and the AI Butler are shared. New platforms arrive as modules you switch on, never as a separate product.",
  },
  {
    q: "How do your virtual assistants work?",
    a: "Every VA on our team brings 5+ years of BPO experience and works inside your HostOS workspace, so you see the same board, tasks and messages they do. They handle phone, email and chat, admin work and day-to-day operations — trained to match your brand voice and standards.",
  },
  {
    q: "Can you build something custom for my business?",
    a: "Yes. Dashboards, internal tools, automations, CRMs, websites and mobile apps are all in scope. We start with a discovery call, propose a plan that fits your needs and budget, then build, launch and stay on for support.",
  },
  {
    q: "How does HostOS get my Turo data?",
    a: "Through the HostOS Companion, a Chrome extension you install once and pair with a key from your workspace. It reads the Turo pages you already have open and syncs trips, vehicles, messages and license status to your workspace. There is no password sharing and no scraping from our servers — the browser does the reading.",
  },
  {
    q: "Is the AI making decisions for me?",
    a: "No. The Butler drafts, summarises, classifies and suggests. Every draft is grounded in your own house rules and the platform's published policy, with sources shown. Sending, cancelling and changing anything remains a person's click.",
  },
  {
    q: "Where is my data stored?",
    a: "In a Postgres database (Supabase) scoped per workspace, reachable only through server-side code with row-level security enabled. Customer names, messages and plates are never public.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. HostOS installs as an app on iPhone, iPad, Android and desktop straight from the browser — no App Store or Play Store. The install guide walks through the two-tap steps.",
  },
  {
    q: "What does it cost?",
    a: "HostOS is free during early access; the platform plans above are indicative and nobody is billed without agreeing to a plan first. Services — VAs, custom builds, websites, marketing — are quoted after a free consultation.",
  },
];

export const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#platform", label: "Platform" },
  { href: "/#work", label: "Work" },
  { href: "/team", label: "Our team" },
  { href: "/about", label: "About" },
  { href: "/#contact", label: "Contact" },
] as const;

export const CONTACT_INTERESTS = [
  "Custom website / web app",
  "Mobile app development",
  "AI automation",
  "SEO & digital marketing",
  "Dashboard / internal tool",
  "CRM & email automation",
  "Virtual assistant / admin support",
  "Customer support (phone/email/chat)",
  "HostOS platform",
  "Free strategy call",
  "Other",
] as const;

/* ------------------------------------------------------------- about */

export interface Expertise {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const EXPERTISE: Expertise[] = [
  { icon: Layers, title: "Operations", description: "Managed teams, SOPs, and daily ops at scale" },
  { icon: Headset, title: "Customer service", description: "Multi-channel support across industries" },
  { icon: Wrench, title: "Technology", description: "Full-stack dev, APIs, AI, and automation" },
  { icon: Users, title: "Leadership", description: "Team leads, supervisors, site OICs" },
  { icon: BarChart3, title: "Business strategy", description: "Hands-on experience with real businesses" },
  { icon: Sparkles, title: "Problem solving", description: "Technical and operational, from every angle" },
];

export interface Experience {
  role: string;
  company: string;
  duration: string;
  description: string;
}

export const EXPERIENCE: Experience[] = [
  {
    role: "Operations supervisor → site OIC",
    company: "Turo support",
    duration: "2+ years",
    description: "Managed agents supporting Turo hosts and guests across chat, email, and phone; later oversaw daily operations as site OIC, acting as operations manager.",
  },
  {
    role: "VA / co-host",
    company: "Turo",
    duration: "Direct hands-on",
    description: "Worked directly as a Turo VA and co-host, gaining first-hand understanding of the host experience and day-to-day operations.",
  },
  {
    role: "Account manager",
    company: "DoorDash",
    duration: "6 months",
    description: "Helped restaurant owners across the US identify business needs and implement practical solutions to grow their delivery operations.",
  },
  {
    role: "Web advisor",
    company: "GoDaddy & iPage",
    duration: "2+ years",
    description: "Helped more than 100 clients build and manage websites, domains, hosting, and online presence — from design to DNS.",
  },
  {
    role: "Tech support",
    company: "T-Mobile, Verizon & AT&T",
    duration: "3+ years combined",
    description: "Technical support for three of the largest telecom providers in the US, troubleshooting devices, networks, and account-level issues.",
  },
  {
    role: "Tech support",
    company: "Microsoft · Bell Canada",
    duration: "1+ year",
    description: "Supported Microsoft product users and Bell Canada consumers with troubleshooting, account issues, and technical guidance.",
  },
  {
    role: "Co-founder & tech lead",
    company: "GerWeiss Motors",
    duration: "Family business",
    description: "Helped pioneer e-vehicles in the Philippines, supporting local tricycle drivers in Boracay. Built the company database and inventory system from scratch.",
  },
];

export const TECHNICAL_SKILLS = [
  "Web & mobile development",
  "API integrations & automation",
  "AI implementation",
  "Front-end & back-end systems",
  "Database design & management",
  "Process automation & workflows",
];

export const BRANDS_WORKED_WITH = ["GoDaddy", "iPage", "T-Mobile", "Verizon", "AT&T", "DoorDash", "Microsoft", "Bell Canada", "GerWeiss Motors"];
