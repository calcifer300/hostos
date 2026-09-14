/**
 * The vertical modules a workspace can run.
 *
 * HostOS is an operations platform for any business; a vertical is a bundle
 * of tables, pages, integrations and dashboard widgets that a workspace can
 * switch on. The shared layer — auth, members and roles, notifications,
 * tasks, the AI Butler, knowledge, analytics — is not a module; every
 * workspace has it.
 *
 * Client-safe: no imports, no secrets. Icons are named, not imported, so
 * this file can be read by server code too.
 */

export type WorkspaceModule = "fleet" | "restaurants" | "commerce";

export interface ModuleDefinition {
  id: WorkspaceModule;
  label: string;
  /** Short label for chips and the switcher. */
  short: string;
  description: string;
  /** Lucide icon name, resolved by components/modules/module-icon.tsx. */
  icon: "Car" | "ChefHat" | "ShoppingBag";
  /** Platforms this module talks to today. */
  integrations: string[];
  /** Whether this module is fully supported, in beta, or planned. */
  maturity: "live" | "beta";
  /** What the module calls its primary noun, for copy. */
  entity: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "fleet",
    label: "Fleet operations",
    short: "Fleet",
    description: "Vehicle rental operations — Turo today: reservations, trips, vehicles, guest messaging, risk and license checks, the cross-fleet board.",
    icon: "Car",
    integrations: ["turo", "gmail"],
    maturity: "live",
    entity: "vehicle",
  },
  {
    id: "restaurants",
    label: "Restaurant operations",
    short: "Restaurants",
    description: "Delivery restaurant operations — DoorDash today: store monitoring, POS-vs-marketplace menu sync, orders, customer messages, inventory.",
    icon: "ChefHat",
    integrations: ["doordash"],
    maturity: "beta",
    entity: "restaurant",
  },
  {
    id: "commerce",
    label: "Commerce operations",
    short: "Commerce",
    description: "Online store operations — Shopify today: products and inventory, orders and fulfilment, low-stock alerts, sales analytics.",
    icon: "ShoppingBag",
    integrations: ["shopify"],
    maturity: "beta",
    entity: "store",
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

export type IntegrationProvider = "turo" | "doordash" | "shopify" | "gmail" | "google_calendar" | "slack" | "sms";

export interface IntegrationDefinition {
  id: IntegrationProvider;
  name: string;
  description: string;
  /** How the connection is made. */
  method: "companion" | "oauth" | "api_token" | "export";
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
    description: "Pickups, returns and deliveries on your calendar.",
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
    description: "Text alerts for the things that can't wait.",
    method: "api_token",
    modules: [],
    status: "soon",
  },
];

export function integrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}
