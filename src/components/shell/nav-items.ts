import type { LucideIcon } from "lucide-react";
import { LayoutGrid, ListChecks, MessageCircle, Inbox, Car, Sparkles, BarChart3, Plug, Settings } from "lucide-react";

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
 *
 * Messages was added after that spec shipped — it's the raw, full-thread
 * view of every Companion-synced conversation (guest + host/co-host
 * replies), distinct from Inbox (Gmail-only) and from the Overview card
 * (latest message per conversation only, not the full back-and-forth).
 */
export const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/operations", label: "Operations", icon: ListChecks },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/fleet", label: "Fleet", icon: Car },
  { href: "/butler", label: "Butler", icon: Sparkles },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];
