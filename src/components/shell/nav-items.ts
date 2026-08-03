import type { LucideIcon } from "lucide-react";
import { Sparkle, Inbox, CalendarClock, BookOpen, Zap, Bell, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Sparkle },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/reservations", label: "Reservations", icon: CalendarClock },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];
