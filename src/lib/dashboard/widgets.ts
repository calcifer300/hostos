import type { WorkspaceModule } from "@/lib/modules";

/**
 * The dashboards and their widget catalogue.
 *
 * Every line of business gets its own dashboard — a Turo fleet is not run
 * from the same screen as a DoorDash kitchen or a Shopify store — and the
 * workspace Home ties them together. Layout (order + visibility) is stored
 * per person, per workspace, per dashboard (migration 0019, one JSON object
 * keyed by scope); the catalogue itself lives in code so a widget that is
 * removed simply disappears from stored layouts.
 *
 * Client-safe: no imports beyond a type.
 */

export type DashboardScope = "home" | "fleet" | "restaurants" | "commerce";

export interface DashboardDefinition {
  scope: DashboardScope;
  /** The module that must be enabled for this dashboard to exist; null = always. */
  module: WorkspaceModule | null;
  eyebrow: string;
  title: string;
  description: string;
  /** The platform this line of business runs on today, for the header chip. */
  platform: string | null;
}

export const DASHBOARDS: DashboardDefinition[] = [
  { scope: "home", module: null, eyebrow: "Workspace", title: "Home", description: "Every line of business at a glance, plus the work that cuts across them.", platform: null },
  { scope: "fleet", module: "fleet", eyebrow: "Fleet operations", title: "Fleet dashboard", description: "Reservations, vehicles, guests and risk — what the fleet needs from you today.", platform: "Turo" },
  { scope: "restaurants", module: "restaurants", eyebrow: "Restaurant operations", title: "Restaurant dashboard", description: "Store status, menu sync, delivery orders and stock across every storefront.", platform: "DoorDash" },
  { scope: "commerce", module: "commerce", eyebrow: "Commerce operations", title: "Commerce dashboard", description: "Sales, orders, inventory and sync health across your online stores.", platform: "Shopify" },
];

export function dashboardFor(scope: DashboardScope): DashboardDefinition {
  return DASHBOARDS.find((d) => d.scope === scope) ?? DASHBOARDS[0];
}

export type WidgetSize = "third" | "half" | "two-thirds" | "full";

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  /** Rendered only when the workspace runs this module; null = shared. */
  module: WorkspaceModule | null;
  /** The dashboards this widget can appear on. */
  scopes: DashboardScope[];
  /** Dashboards where it is on for a fresh layout (defaults to every scope). */
  defaultOn?: DashboardScope[];
  size: WidgetSize;
}

const ALL: DashboardScope[] = ["home", "fleet", "restaurants", "commerce"];

export const WIDGETS: WidgetDefinition[] = [
  // Shared — the content adapts to the dashboard it sits on.
  { id: "stats", title: "Key numbers", description: "Today's headline figures for this dashboard.", module: null, scopes: ALL, size: "full" },
  { id: "businesses", title: "Lines of business", description: "One card per business you run, with its own dashboard.", module: null, scopes: ["home"], size: "full" },
  { id: "tasks", title: "Tasks", description: "What the team and the Butler are working on.", module: null, scopes: ALL, size: "third" },
  { id: "notifications", title: "Notifications", description: "The latest things that needed a person.", module: null, scopes: ALL, size: "third" },
  { id: "briefing", title: "AI briefing", description: "The Butler's summary of the day.", module: null, scopes: ["home", "fleet"], size: "third" },
  { id: "activity", title: "Recent events", description: "Everything that happened, most recent first.", module: null, scopes: ALL, size: "two-thirds" },

  // Fleet (Turo)
  { id: "board", title: "Needs you next", description: "Cross-fleet trips sorted by urgency.", module: "fleet", scopes: ["home", "fleet"], size: "half" },
  { id: "messages", title: "Guest messages", description: "Live conversations waiting on a reply.", module: "fleet", scopes: ["fleet"], size: "half" },
  { id: "fleet", title: "Fleet overview", description: "Vehicles on trip, available, in turnaround.", module: "fleet", scopes: ["fleet"], size: "third" },
  { id: "occupancy", title: "Occupancy", description: "Seven-day booked share of the fleet.", module: "fleet", scopes: ["fleet"], size: "third" },
  { id: "priority", title: "Suggestions", description: "Rule-based recommendations, ranked.", module: "fleet", scopes: ["fleet"], size: "third" },
  { id: "pickups", title: "Today's pickups", description: "Who collects a car today.", module: "fleet", scopes: ["fleet"], size: "half" },
  { id: "returns", title: "Today's returns", description: "Who brings one back.", module: "fleet", scopes: ["fleet"], size: "half" },
  { id: "timeline", title: "Operations timeline", description: "Pickups and returns by day.", module: "fleet", scopes: ["fleet"], size: "full" },
  { id: "unscheduled", title: "Unscheduled vehicles", description: "Cars with nothing on the books.", module: "fleet", scopes: ["fleet"], defaultOn: [], size: "full" },

  // Restaurants (DoorDash)
  { id: "restaurants", title: "Store status", description: "Every restaurant, live state and menu sync.", module: "restaurants", scopes: ["home"], size: "half" },
  { id: "restaurantList", title: "Restaurants", description: "Every storefront as a card, with add and open.", module: "restaurants", scopes: ["restaurants"], size: "full" },
  { id: "orders", title: "Delivery orders", description: "Orders per day across restaurants.", module: "restaurants", scopes: ["home", "restaurants"], size: "half" },
  { id: "menusync", title: "Menu sync", description: "What still differs between your POS and DoorDash.", module: "restaurants", scopes: ["restaurants"], size: "half" },
  { id: "topitems", title: "Top items", description: "Best-selling dishes over the last 14 days.", module: "restaurants", scopes: ["restaurants"], size: "third" },

  // Commerce (Shopify)
  { id: "commerce", title: "Online sales", description: "Revenue and orders across stores.", module: "commerce", scopes: ["home"], size: "half" },
  { id: "storeList", title: "Stores", description: "Every store as a card, with connect and open.", module: "commerce", scopes: ["commerce"], size: "full" },
  { id: "sales", title: "Sales · 14 days", description: "Daily revenue across every store.", module: "commerce", scopes: ["commerce"], size: "two-thirds" },
  { id: "topproducts", title: "Top products", description: "Best-sellers over the last 14 days.", module: "commerce", scopes: ["commerce"], size: "third" },
  { id: "storesync", title: "Sync health", description: "When each store last synced and whether it worked.", module: "commerce", scopes: ["commerce"], size: "third" },

  // Stock — restaurants and stores both carry inventory.
  { id: "lowstock", title: "Low stock", description: "Products and items running out.", module: null, scopes: ["home", "restaurants", "commerce"], size: "third" },
];

export interface LayoutEntry {
  id: string;
  visible: boolean;
}

/** What the dashboard_layouts row holds: one arrangement per dashboard. */
export type StoredLayouts = Partial<Record<DashboardScope, LayoutEntry[]>>;

function isEntry(value: unknown): value is LayoutEntry {
  return typeof value === "object" && value !== null && typeof (value as LayoutEntry).id === "string";
}

/**
 * Reads one dashboard's arrangement out of the stored JSON. Accepts the
 * pre-scope shape (a bare array, which was the single mixed dashboard) and
 * treats it as the Home layout so nobody's arrangement vanishes.
 */
export function storedLayoutFor(raw: unknown, scope: DashboardScope): LayoutEntry[] | null {
  if (Array.isArray(raw)) return scope === "home" ? raw.filter(isEntry) : null;
  if (typeof raw !== "object" || raw === null) return null;
  const list = (raw as Record<string, unknown>)[scope];
  return Array.isArray(list) ? list.filter(isEntry) : null;
}

/** Widgets that can appear on a dashboard, given the workspace's modules. */
export function availableWidgets(scope: DashboardScope, modules: WorkspaceModule[]): WidgetDefinition[] {
  return WIDGETS.filter((w) => w.scopes.includes(scope) && (!w.module || modules.includes(w.module)));
}

/**
 * Merges a stored layout with the catalogue: stored order wins for widgets
 * that still exist on this dashboard, new widgets append in catalogue order,
 * unknown ids drop.
 */
export function resolveLayout(stored: LayoutEntry[] | null | undefined, modules: WorkspaceModule[], scope: DashboardScope = "home"): LayoutEntry[] {
  const available = availableWidgets(scope, modules);
  const byId = new Map(available.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const out: LayoutEntry[] = [];

  for (const entry of stored ?? []) {
    if (!byId.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({ id: entry.id, visible: Boolean(entry.visible) });
  }
  for (const w of available) {
    if (seen.has(w.id)) continue;
    out.push({ id: w.id, visible: (w.defaultOn ?? w.scopes).includes(scope) });
  }
  return out;
}

export const SIZE_CLASS: Record<WidgetSize, string> = {
  third: "lg:col-span-2",
  half: "lg:col-span-3",
  "two-thirds": "lg:col-span-4",
  full: "lg:col-span-6",
};
