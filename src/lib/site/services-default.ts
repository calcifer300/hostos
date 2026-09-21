import type { ServiceRow } from "@/lib/site/film";

/** The site's built-in services, mirrored from site/src/lib/content/pricing.ts so the editor can start from them. Regenerate when that file changes. */
export const SITE_SERVICES: ServiceRow[] = [
  {
    "id": "operations",
    "name": "Business Operations",
    "blurb": "Trained operators on your channels — phone, email, chat, delivery tablets — running the procedures we write for your business.",
    "stack": [
      "HostOS board",
      "Google Workspace",
      "Turo & DoorDash dashboards",
      "Zendesk / Front",
      "Slack & WhatsApp",
      "Written SOPs"
    ],
    "included": [
      "Operators trained by the Founder, 5+ yrs VA & BPO each",
      "Procedures written for your business, one page each",
      "Coverage as a team, never a single person",
      "Weekly numbers, monthly review",
      "Quality checks on every conversation"
    ],
    "deliverables": [
      "Your HostOS workspace and board",
      "SOP library",
      "Weekly report",
      "Named lead operator"
    ],
    "ideal": "Fleets, restaurants, field-service and shop owners with an inbox that never sleeps",
    "timeline": "Live within 30 days",
    "model": "monthly",
    "tiers": [
      {
        "name": "Starter",
        "price": "$1,490",
        "period": "/mo",
        "note": "One dedicated operator · 40 hrs/wk · your hours"
      },
      {
        "name": "Growth",
        "price": "$2,890",
        "period": "/mo",
        "note": "Two operators · 80 hrs/wk · cover for time off"
      },
      {
        "name": "Around the clock",
        "price": "$5,900",
        "period": "/mo",
        "note": "24/7 team coverage · lead operator · weekly review"
      }
    ],
    "support": "Included. Add hours at $12/hr.",
    "why": "A US hire for the same coverage runs $3,500–4,500 a month before benefits; freelancers cost less but bring no cover, no procedures and no board. This sits in between and includes all three."
  },
  {
    "id": "web",
    "name": "Web Development",
    "blurb": "Fast, findable sites that book, quote and answer — built on the stack HostOS itself runs on, and owned by you.",
    "stack": [
      "SvelteKit",
      "Next.js",
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Node.js",
      "PostgreSQL / Supabase",
      "REST APIs",
      "Vercel",
      "Cloudflare"
    ],
    "included": [
      "Design and build in-house",
      "Mobile-first, Lighthouse-tested",
      "Booking, quote or contact flows",
      "Technical SEO, schema, sitemap",
      "Your domain, your accounts, your code"
    ],
    "deliverables": [
      "Live site on your domain",
      "Source repository",
      "Editing guide",
      "30 days of fixes"
    ],
    "ideal": "Shops, clinics, trades, agencies and fleets that need to be found and booked",
    "timeline": "2–6 weeks",
    "model": "one-time",
    "tiers": [
      {
        "name": "Starter",
        "price": "$1,900",
        "period": "one-time",
        "note": "Up to 5 pages · booking or contact form · SEO basics"
      },
      {
        "name": "Professional",
        "price": "$4,500",
        "period": "one-time",
        "note": "Up to 12 pages · integrations · CMS · analytics"
      },
      {
        "name": "Enterprise",
        "price": "Custom quote",
        "period": "",
        "note": "Multi-location, portals, e-commerce"
      }
    ],
    "support": "Optional care plan from $190/mo — hosting, updates, small changes.",
    "why": "US agencies charge $5,000–15,000 for the Professional tier; template builders charge less and leave you with a template. This is custom work at a Philippine cost base."
  },
  {
    "id": "apps",
    "name": "App Development",
    "blurb": "Web and cross-platform apps — installable, offline-ready, signed-in — for the tools your business can’t buy off the shelf.",
    "stack": [
      "Progressive Web Apps",
      "React / SvelteKit",
      "TypeScript",
      "Supabase auth & database",
      "Push notifications",
      "Responsive UI",
      "API integrations"
    ],
    "included": [
      "Discovery and scope",
      "UI design",
      "Authentication and roles",
      "Integrations with the tools you run on",
      "Testing on real devices"
    ],
    "deliverables": [
      "Installable app on iPhone, Android, Mac and Windows",
      "Admin dashboard",
      "Source and documentation"
    ],
    "ideal": "Operators who outgrew spreadsheets and need one tool built around their workflow",
    "timeline": "6–12 weeks",
    "model": "custom",
    "tiers": [
      {
        "name": "From",
        "price": "$6,500",
        "period": "one-time",
        "note": "Starting point for a focused app; the rest is a quote"
      }
    ],
    "support": "Optional from $390/mo — monitoring, updates, small features.",
    "why": "Custom software is priced on scope. We name a floor so you can plan, then quote the rest after the free strategy call."
  },
  {
    "id": "ai",
    "name": "AI Automation",
    "blurb": "AI where it helps, humans where it matters: assistants that draft, sort, chase and summarize — supervised by your operators.",
    "stack": [
      "OpenAI & Claude APIs",
      "Workflow automation",
      "Knowledge bases",
      "CRM and email automation",
      "Prompt engineering",
      "HostOS Butler"
    ],
    "included": [
      "Audit of the repetitive work",
      "Assistants built for your procedures",
      "Human-in-the-loop approvals",
      "Monitoring and monthly tuning"
    ],
    "deliverables": [
      "Working automations in your tools",
      "Playbook of what runs when",
      "Monthly report of hours saved"
    ],
    "ideal": "Businesses answering the same questions and chasing the same follow-ups every day",
    "timeline": "2–4 weeks to first automation",
    "model": "custom",
    "tiers": [
      {
        "name": "Setup from",
        "price": "$1,800",
        "period": "one-time",
        "note": "Then $350/mo to run, monitor and tune"
      }
    ],
    "support": "Running and tuning from $350/mo.",
    "why": "Priced on the hours it gives back. A typical first setup replaces 30–60 hours of admin a month; we quote the rest by scope."
  },
  {
    "id": "crm",
    "name": "CRM & Automations",
    "blurb": "Every customer, job and conversation in one place, with the follow-ups that run without anyone remembering.",
    "stack": [
      "HubSpot",
      "GoHighLevel",
      "Airtable",
      "Notion",
      "Zapier",
      "Make",
      "Custom APIs"
    ],
    "included": [
      "Pipeline design",
      "Data migration",
      "Automated reminders and follow-ups",
      "Portals for clients and staff",
      "Team training"
    ],
    "deliverables": [
      "Configured CRM",
      "Automation map",
      "Training session and guide"
    ],
    "ideal": "Service businesses with repeat customers and five apps that don’t talk to each other",
    "timeline": "2–4 weeks",
    "model": "one-time",
    "tiers": [
      {
        "name": "Setup",
        "price": "$1,200",
        "period": "one-time",
        "note": "One CRM · up to 5 automations · migration"
      },
      {
        "name": "Setup + connect",
        "price": "$2,600",
        "period": "one-time",
        "note": "Multiple tools connected · portals · reporting"
      }
    ],
    "support": "Optional from $290/mo — changes, new automations, monitoring.",
    "why": "Comparable setups run $2,500–6,000 from US consultancies. Tool subscriptions are billed to you directly."
  },
  {
    "id": "seo",
    "name": "SEO & Marketing",
    "blurb": "Be the business that comes up when someone in your city searches — and the one whose reviews are answered.",
    "stack": [
      "Technical SEO",
      "Local SEO",
      "Google Business Profile",
      "Keyword research",
      "On-page SEO",
      "Content strategy",
      "Performance",
      "Analytics"
    ],
    "included": [
      "Technical audit and fixes",
      "Google Business Profile management",
      "Monthly content",
      "Review responses",
      "Monthly report you can read in five minutes"
    ],
    "deliverables": [
      "Audit",
      "Keyword map",
      "Monthly content and report"
    ],
    "ideal": "Local businesses that live on search and reviews",
    "timeline": "First results in 60–90 days",
    "model": "monthly",
    "tiers": [
      {
        "name": "Local",
        "price": "$790",
        "period": "/mo",
        "note": "Profile · reviews · technical fixes · 2 pieces of content"
      },
      {
        "name": "Growth",
        "price": "$1,490",
        "period": "/mo",
        "note": "Everything in Local · 4 pieces · link outreach · quarterly strategy"
      }
    ],
    "support": "Included.",
    "why": "US local-SEO retainers run $1,000–2,500 a month. Ad spend, if any, is billed to you directly."
  },
  {
    "id": "design",
    "name": "Branding & Design",
    "blurb": "An identity and interfaces that read as professional at a glance — the way this page does.",
    "stack": [
      "Figma",
      "Design systems",
      "Brand identity",
      "UI/UX",
      "Wireframes",
      "Prototypes",
      "Landing pages"
    ],
    "included": [
      "Discovery",
      "Two directions, one refined",
      "Logo, color, type, usage guide",
      "Screens for web and mobile",
      "Clickable prototype"
    ],
    "deliverables": [
      "Brand kit",
      "Figma file",
      "Design system",
      "Prototype"
    ],
    "ideal": "New businesses and rebrands, and products that need screens before code",
    "timeline": "2–5 weeks",
    "model": "one-time",
    "tiers": [
      {
        "name": "Brand identity",
        "price": "$1,900",
        "period": "one-time",
        "note": "Logo · colors · type · guide"
      },
      {
        "name": "Product UI/UX",
        "price": "$2,400",
        "period": "from",
        "note": "Wireframes → screens → prototype · scoped per product"
      }
    ],
    "support": "Design retainer from $490/mo.",
    "why": "Identity work at US studios starts at $5,000; marketplaces at $300 without strategy. This is studio process at a Philippine cost base."
  },
  {
    "id": "custom",
    "name": "Custom Software",
    "blurb": "SaaS, internal platforms, fleet software, marketplaces, mobile apps, dashboards, integrations — built to your business, owned by you.",
    "stack": [
      "SvelteKit / Next.js",
      "TypeScript",
      "Supabase / PostgreSQL",
      "Node.js",
      "OpenAI",
      "Vercel",
      "Cloudflare"
    ],
    "included": [
      "Discovery and scope",
      "Architecture",
      "Build in milestones",
      "Testing",
      "Handover with source"
    ],
    "deliverables": [
      "Scope document",
      "Milestone builds",
      "Source, documentation, training"
    ],
    "ideal": "Owners who need software that doesn’t exist yet",
    "timeline": "Quoted per project",
    "model": "custom",
    "tiers": [
      {
        "name": "Custom quote",
        "price": "Custom quote",
        "period": "",
        "note": "Custom pricing based on project scope, technical requirements, integrations, complexity, timeline and business goals."
      }
    ],
    "support": "Quoted with the build.",
    "why": "No fixed price is honest for custom software. Bring the operation to the free strategy call and leave with an estimate."
  }
];
