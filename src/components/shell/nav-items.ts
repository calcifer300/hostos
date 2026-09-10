import type { LucideIcon } from "lucide-react";
import { LayoutGrid, ListChecks, MessageCircle, Inbox, Car, ShieldAlert, Sparkles, BarChart3, Plug, Settings, LayoutList, BookMarked } from "lucide-react";

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
  // Every fleet you are on, in one list, sorted by what needs you first.
  // Operations is one fleet and one day; this is the co-host's worklist
  // across all of them — the thing Karl's trackers existed to do.
  { href: "/board", label: "Board", icon: LayoutList },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/fleet", label: "Fleet", icon: Car },
  // The two rules the fleet actually runs on — verify a licence before pickup,
  // and catch a trip worth cancelling. Ported from the CC extension s popup so
  // the queues sit beside the data they are computed from.
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/butler", label: "Butler", icon: Sparkles },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  // Turo's own published policy. Distinct from Knowledge, which is the
  // fleet's own house rules — a reply usually needs both.
  { href: "/library", label: "Policy", icon: BookMarked },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];
