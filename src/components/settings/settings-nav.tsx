"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Building2, FileText, Globe, Smartphone, Users } from "lucide-react";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: routes.settings, label: "Workspace", icon: Building2 },
  { href: routes.team, label: "Team & roles", icon: Users },
  { href: `${routes.settings}/alerts`, label: "Alerts", icon: Bell },
  { href: `${routes.settings}/templates`, label: "Reply templates", icon: FileText },
  { href: `${routes.settings}/install`, label: "Install app", icon: Smartphone },
];

export function SettingsNav({ founder = false }: { founder?: boolean }) {
  const pathname = usePathname();
  const items = founder ? [...ITEMS, { href: `${routes.settings}/company`, label: "Our Team page", icon: Globe }] : ITEMS;
  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto rounded-full border border-border bg-muted/50 p-1" aria-label="Settings sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="settings-active"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 -z-10 rounded-full bg-card shadow-[var(--shadow-card)]"
              />
            )}
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
