import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Inbox,
  Car,
  ShieldAlert,
  Sparkles,
  BarChart3,
  Plug,
  Settings,
  LayoutList,
  BookMarked,
  BookOpen,
  Bell,
  CheckSquare,
  Barcode,
  Gauge,
  Workflow,
} from "lucide-react";
import { routes } from "@/lib/routes";
import type { WorkspaceModule } from "@/lib/host/queries";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key into the per-route badge counts the layout computes. */
  countKey?: string;
  /** Matches child routes too (e.g. /app/messages/123). */
  matchPrefix?: boolean;
}

export interface NavSection {
  id: "workspace" | "fleet" | "restaurants" | "commerce" | "intelligence" | "system";
  label: string | null;
  /** Shown next to the label: the platform this line of business runs on. */
  platform?: string;
  /** Rendered only when the workspace runs this module. */
  module?: WorkspaceModule;
  items: NavItem[];
}

/**
 * The sidebar, grouped by line of business. Each business the workspace runs
 * — a Turo fleet, DoorDash restaurants, Shopify stores — gets its own group
 * headed by its own dashboard, because none of them is run from the same
 * screen. "Workspace" is what cuts across them (Home, tasks, notifications,
 * the Butler); "Intelligence" is analytics and the knowledge the Butler
 * grounds in; "System" is plumbing. Groups appear according to
 * hosts.modules (migration 0017).
 *
 * Reservations, Automations and Knowledge stay live as deep links rather
 * than top-level entries.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: null,
    items: [
      { href: routes.overview, label: "Home", icon: LayoutGrid },
      { href: routes.tasks, label: "Tasks", icon: CheckSquare, countKey: "tasks" },
      { href: routes.notifications, label: "Notifications", icon: Bell, countKey: "notifications" },
      { href: routes.butler, label: "AI Butler", icon: Sparkles, countKey: "butler" },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    platform: "Turo",
    module: "fleet",
    items: [
      { href: routes.fleet, label: "Dashboard", icon: Gauge },
      { href: routes.board, label: "Board", icon: LayoutList, countKey: "board" },
      { href: routes.operations, label: "Operations", icon: ListChecks, countKey: "operations" },
      { href: routes.messages, label: "Messages", icon: MessageCircle, countKey: "messages", matchPrefix: true },
      { href: routes.vehicles, label: "Vehicles", icon: Car, matchPrefix: true },
      { href: routes.risk, label: "Risk", icon: ShieldAlert, countKey: "risk" },
      { href: routes.inbox, label: "Gmail inbox", icon: Inbox },
      { href: routes.library, label: "Turo policy", icon: BookMarked, matchPrefix: true },
    ],
  },
  {
    id: "restaurants",
    label: "Restaurants",
    platform: "DoorDash",
    module: "restaurants",
    items: [
      { href: routes.restaurants, label: "Dashboard", icon: Gauge, countKey: "restaurants", matchPrefix: true },
      { href: routes.upcGenerator, label: "UPC generator", icon: Barcode },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    platform: "Shopify",
    module: "commerce",
    items: [{ href: routes.commerce, label: "Dashboard", icon: Gauge, countKey: "commerce", matchPrefix: true }],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { href: routes.insights, label: "Insights", icon: BarChart3 },
      { href: routes.knowledge, label: "Knowledge", icon: BookOpen },
      { href: routes.automations, label: "Automations", icon: Workflow },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: routes.connectors, label: "Connectors", icon: Plug },
      { href: routes.settings, label: "Settings", icon: Settings, matchPrefix: true },
    ],
  },
];

/** Flat list, for the command palette and anything that wants every page. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  // /app/restaurants/tools/upc must not light up "Dashboard" and "UPC" both,
  // and /app/fleet/vehicles/X belongs to Vehicles, not the Fleet dashboard.
  if (item.matchPrefix && pathname.startsWith(`${item.href}/`)) {
    return !ALL_NAV_ITEMS.some((other) => other !== item && other.href.length > item.href.length && pathname.startsWith(other.href));
  }
  return false;
}
