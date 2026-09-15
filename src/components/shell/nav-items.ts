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
  Compass,
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
  id: "workspace" | WorkspaceModule | "system";
  label: string | null;
  /** Shown next to the label: the platform this line of business runs on. */
  platform?: string;
  /** Rendered only when the workspace runs this module — and, in the sidebar, only when it is the vertical in focus. */
  module?: WorkspaceModule;
  items: NavItem[];
}

/**
 * The sidebar, grouped by line of business. Each business the workspace runs
 * gets its own group headed by its own dashboard, and the shell shows one
 * group at a time — the vertical in focus — so every dashboard is a clean
 * command center for that business. "Workspace" is what cuts across them
 * (Home, tasks, notifications, the Butler, knowledge); "System" is plumbing.
 * The chooser (/app/start) switches focus.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: null,
    items: [
      { href: routes.start, label: "Choose vertical", icon: Compass },
      { href: routes.overview, label: "All businesses", icon: LayoutGrid },
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
      { href: routes.insights, label: "Insights", icon: BarChart3 },
      { href: routes.inbox, label: "Gmail inbox", icon: Inbox },
      { href: routes.library, label: "Turo policy", icon: BookMarked, matchPrefix: true },
      { href: routes.automations, label: "Automations", icon: Workflow },
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
    id: "web",
    label: "Web & domains",
    platform: "GoDaddy",
    module: "web",
    items: [{ href: routes.web, label: "Dashboard", icon: Gauge, countKey: "web", matchPrefix: true }],
  },
  {
    id: "cafe",
    label: "Coffee shop",
    platform: "Café",
    module: "cafe",
    items: [{ href: routes.cafe, label: "Dashboard", icon: Gauge, countKey: "cafe", matchPrefix: true }],
  },
  {
    id: "salon",
    label: "Barbershop",
    platform: "Salon",
    module: "salon",
    items: [{ href: routes.salon, label: "Dashboard", icon: Gauge, countKey: "salon", matchPrefix: true }],
  },
  {
    id: "custom",
    label: "Custom",
    platform: "Build",
    module: "custom",
    items: [{ href: routes.custom, label: "Dashboard", icon: Gauge, countKey: "custom", matchPrefix: true }],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: routes.knowledge, label: "Knowledge", icon: BookOpen },
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
