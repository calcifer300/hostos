"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_SECTIONS, isNavItemActive, type NavItem } from "@/components/shell/nav-items";
import type { WorkspaceModule } from "@/lib/host/queries";
import { verticalFromPath } from "@/lib/verticals";
import { cn } from "@/lib/utils";

function Badge({ count, tone }: { count: number; tone: "accent" | "danger" }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums leading-none",
        tone === "danger" ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  item,
  active,
  count,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const dangerKeys = new Set(["risk", "notifications"]);
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg py-1.5 text-[13px] transition-[color,transform] duration-150 active:scale-[0.98]",
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <>
          <motion.span
            layoutId="sidebar-active"
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            className="absolute inset-0 -z-10 rounded-lg bg-muted"
          />
          {/* The accent rail slides between items with the pill. */}
          <motion.span
            layoutId="sidebar-rail"
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            className={cn("absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent", collapsed ? "left-0.5" : "left-0")}
          />
        </>
      )}
      {!active && (
        <span className="absolute inset-0 -z-10 rounded-lg bg-muted/0 transition-colors duration-150 group-hover:bg-muted/60" />
      )}
      <Icon className="h-[15px] w-[15px] shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-6 group-hover:scale-110" strokeWidth={1.75} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          <Badge count={count} tone={dangerKeys.has(item.countKey ?? "") ? "danger" : "accent"} />
        </>
      )}
      {collapsed && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {count > 0 ? ` · ${count}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({
  counts,
  modules,
  focus = null,
  collapsed = false,
  onNavigate,
}: {
  /** Real per-route counts from the layout. Absent or zero renders no badge. */
  counts?: Record<string, number>;
  modules: WorkspaceModule[];
  /** The vertical chosen on /app/start, remembered per browser. */
  focus?: WorkspaceModule | null;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  // One line of business at a time: the page's own vertical wins, then the
  // chosen one, then the first enabled — so the sidebar is always a clean
  // command center for exactly one business plus what is shared.
  const pathVertical = verticalFromPath(pathname);
  const active = (pathVertical && modules.includes(pathVertical) ? pathVertical : null) ?? (focus && modules.includes(focus) ? focus : null) ?? modules[0] ?? null;

  return (
    <nav className="flex flex-col gap-5" aria-label="Workspace">
      {NAV_SECTIONS.filter((s) => !s.module || s.module === active).map((section) => (
        <div key={section.id}>
          {section.label && !collapsed && (
            <p className="mb-1.5 flex items-center gap-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {section.label}
              {section.platform && (
                <span className="rounded-full border border-border/80 px-1.5 py-px text-[9.5px] font-medium normal-case tracking-normal text-muted-foreground/80">{section.platform}</span>
              )}
            </p>
          )}
          {section.label && collapsed && <div className="mx-auto mb-1.5 h-px w-6 bg-border" />}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isNavItemActive(item, pathname)}
                count={counts?.[item.countKey ?? ""] ?? 0}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
