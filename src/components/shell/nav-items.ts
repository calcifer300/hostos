import type { LucideIcon } from "lucide-react";
import { LayoutGrid, ListChecks, Inbox, Car, Sparkles, BarChart3, Plug, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Project Aurora's sidebar (Priority 4). Reservations/Knowledge/Automations/
 * Notifications are deliberately absent here — Operations absorbs
 * Reservations, Butler absorbs Automations, and Activity/Knowledge stay
 * live as deep links (from Overview and Settings respectively) rather than
 * top-level items, matching the spec's exact 8-item list.
 */
export const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/operations", label: "Operations", icon: ListChecks },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/fleet", label: "Fleet", icon: Car },
  { href: "/butler", label: "Butler", icon: Sparkles },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];
