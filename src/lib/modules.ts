/**
 * The verticals (lines of business) a workspace can run.
 *
 * HostOS is an operations platform for any business; a vertical is a bundle
 * of tables, pages, integrations and dashboard widgets that a workspace can
 * switch on. Each one gets its own dashboard — a Turo fleet is not run from
 * the same screen as a barbershop. The shared layer — auth, members and
 * roles, notifications, tasks, the AI Butler, knowledge — is not a module;
 * every workspace has it.
 *
 * Client-safe: no imports, no secrets. Icons are named, not imported, so
 * this file can be read by server code too.
 */

export type WorkspaceModule = "fleet" | "restaurants" | "commerce" | "services" | "web" | "cafe" | "salon" | "custom";

export type ModuleIcon = "Car" | "ChefHat" | "ShoppingBag" | "Wrench" | "Globe" | "Coffee" | "Scissors" | "Blocks";

export interface ModuleDefinition {
  id: WorkspaceModule;
  /** What the chooser calls it — the platform or business type a person recognises. */
  title: string;
  /** The line of business, for headings. */
  label: string;
  /** Short label for chips and the switcher. */
  short: string;
  description: string;
  /** What running this vertical in HostOS gets you, for the chooser card. */
  outcomes: string[];
  /** Lucide icon name, resolved by the component that renders it. */
  icon: ModuleIcon;
  /** Accent colour for the chooser card and the dashboard chip. */
  hue: string;
  /** Platforms this module talks to today. */
  integrations: string[];
  /** Whether this module is fully supported, in beta, or newly built. */
  maturity: "live" | "beta" | "new";
  /** What the module calls its primary noun, for copy. */
  entity: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "fleet",
    title: "Turo",
    label: "Fleet operations",
    short: "Fleet",
    description: "Vehicle rental operations on Turo: reservations, trips, vehicles, guest messaging, risk and license checks, the cross-fleet board.",
    outcomes: ["Unverified licenses caught before pickup", "Protection-plan exposure and thin-margin trips flagged", "Earnings estimated the moment a trip ends"],
    icon: "Car",
    hue: "#0a84ff",
    integrations: ["turo", "gmail"],
    maturity: "live",
    entity: "vehicle",
  },
  {
    id: "restaurants",
    title: "DoorDash",
    label: "Restaurant operations",
    short: "Restaurants",
    description: "Delivery restaurant operations on DoorDash: store monitoring, POS-vs-marketplace menu sync, orders, customer messages, inventory.",
    outcomes: ["Paused storefronts caught mid-service", "Menu prices and 86'd items kept in sync with your POS", "Order volume and best-sellers per store"],
    icon: "ChefHat",
    hue: "#ff3008",
    integrations: ["doordash"],
    maturity: "beta",
    entity: "restaurant",
  },
  {
    id: "commerce",
    title: "Shopify",
    label: "Commerce operations",
    short: "Commerce",
    description: "Online store operations on Shopify: products and inventory, orders and fulfilment, low-stock alerts, sales analytics.",
    outcomes: ["Sell-outs predicted and reorders filed", "Unfulfilled orders surfaced daily", "Sales, top products and sync health at a glance"],
    icon: "ShoppingBag",
    hue: "#95bf47",
    integrations: ["shopify"],
    maturity: "beta",
    entity: "store",
  },
  {
    id: "services",
    title: "Service Businesses",
    label: "Field operations",
    short: "Services",
    description: "Appointment, dispatch and field businesses — auto glass, mobile mechanics, towing, junk removal, HVAC, plumbing, cleaning, lawn care, locksmiths, movers and more: CRM, scheduling, dispatch, work orders, estimates and the SOPs that run them, from a template for your industry.",
    outcomes: ["Every lead, estimate and job in one place instead of Messenger, spreadsheets and paper", "A dispatch board and calendar your VA can run for you", "Overdue jobs, unanswered estimates and missing photos caught by the Butler"],
    icon: "Wrench",
    hue: "#f59e0b",
    integrations: [],
    maturity: "new",
    entity: "job",
  },
  {
    id: "web",
    title: "Websites & Domains",
    label: "Web & domains",
    short: "Web",
    description: "Websites and domains for you and your clients: registrations, renewals, SSL certificates and uptime — Cloudflare, Porkbun, Namecheap, GoDaddy or any registrar.",
    outcomes: ["Domain and SSL expiries caught 30 days out", "Sites checked daily for uptime and response time", "Client properties and hosting in one list"],
    icon: "Globe",
    hue: "#1bdbdb",
    integrations: ["godaddy"],
    maturity: "new",
    entity: "property",
  },
  {
    id: "cafe",
    title: "Coffee Shops",
    label: "Café operations",
    short: "Café",
    description: "Coffee shop operations: daily sales against last week, milk-beans-cups stock with reorder alerts, shifts and opening/closing checklists.",
    outcomes: ["Stock reordered before the morning rush runs dry", "Today's sales against the same day last week", "Shifts and checklists the team actually completes"],
    icon: "Coffee",
    hue: "#c58a4f",
    integrations: ["square"],
    maturity: "new",
    entity: "location",
  },
  {
    id: "salon",
    title: "Barbershops",
    label: "Barbershop operations",
    short: "Barbershop",
    description: "Barbershop and salon operations: today's chairs and appointments, no-shows, clients due for a rebooking reminder, revenue per barber.",
    outcomes: ["Clients due for a rebooking reminder, every week", "No-shows tracked and followed up", "Revenue per chair and per barber"],
    icon: "Scissors",
    hue: "#e14b6a",
    integrations: ["square"],
    maturity: "new",
    entity: "location",
  },
  {
    id: "custom",
    title: "Build a custom",
    label: "Custom operations",
    short: "Custom",
    description: "Any business: define the numbers you want to see every morning, keep the checklists that keep it running, and ask HostOS Collective to build the rest.",
    outcomes: ["Your own KPIs, logged daily and charted", "Checklists for the work that must not slip", "A build request straight to the Collective's engineers"],
    icon: "Blocks",
    hue: "#a78bfa",
    integrations: [],
    maturity: "new",
    entity: "metric",
  },
];

export const ALL_MODULES: WorkspaceModule[] = MODULES.map((m) => m.id);

export function moduleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}

export function isWorkspaceModule(value: string): value is WorkspaceModule {
  return (ALL_MODULES as string[]).includes(value);
}

/* --------------------------------------------------------- integrations */

export type IntegrationProvider = "turo" | "doordash" | "shopify" | "godaddy" | "square" | "gmail" | "google_calendar" | "slack" | "sms";

export interface IntegrationDefinition {
  id: IntegrationProvider;
  name: string;
  description: string;
  /** How the connection is made. */
  method: "companion" | "oauth" | "api_token" | "export" | "manual";
  /** Which module(s) it feeds; empty means the shared layer. */
  modules: WorkspaceModule[];
  status: "live" | "beta" | "soon";
  docsUrl?: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "turo",
    name: "Turo",
    description: "Trips, vehicles, guest messages, license status, protection plans and calendar pricing, read by the HostOS Companion from turo.com.",
    method: "companion",
    modules: ["fleet"],
    status: "live",
  },
  {
    id: "doordash",
    name: "DoorDash Merchant Portal",
    description: "Store status observed by the Companion; menu and order exports imported from the portal.",
    method: "companion",
    modules: ["restaurants"],
    status: "beta",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Products, inventory and orders through the Admin API with a custom-app access token, or from Shopify's CSV exports.",
    method: "api_token",
    modules: ["commerce"],
    status: "beta",
    docsUrl: "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  },
  {
    // The id predates the registrar-neutral vertical and is what integration_connections rows carry; it names every registrar now.
    id: "godaddy",
    name: "Domain registrars",
    description: "Cloudflare, Porkbun, Namecheap, GoDaddy — domains and hosting tracked by name; HostOS checks each site's uptime and SSL itself. Registrar API sync is next.",
    method: "manual",
    modules: ["web"],
    status: "beta",
  },
  {
    id: "square",
    name: "Square POS & Appointments",
    description: "Sales and appointments for cafés and barbershops — CSV exports today, API sync next.",
    method: "export",
    modules: ["cafe", "salon"],
    status: "soon",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Optional. Turo notification emails parsed into a timeline and the AI briefing.",
    method: "oauth",
    modules: ["fleet"],
    status: "live",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Pickups, returns, shifts and appointments on your calendar.",
    method: "oauth",
    modules: [],
    status: "soon",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Alerts and drafts where your team already talks.",
    method: "oauth",
    modules: [],
    status: "soon",
  },
  {
    id: "sms",
    name: "SMS",
    description: "Text alerts and reminders for the things that can't wait.",
    method: "api_token",
    modules: [],
    status: "soon",
  },
];

export function integrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}
