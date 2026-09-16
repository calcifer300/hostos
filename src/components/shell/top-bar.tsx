"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Search, Sparkles, StickyNote } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { openCommandPalette } from "@/components/shell/command-palette";
import { ALL_NAV_ITEMS } from "@/components/shell/nav-items";
import { toggleQuickNotes } from "@/components/notes/quick-notes";
import { moduleById, type WorkspaceModule } from "@/lib/modules";
import { verticalFromPath } from "@/lib/verticals";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/types/auth";
import type { Notification } from "@/lib/notifications/queries";
import { routes } from "@/lib/routes";

function useBreadcrumb(pathname: string): string {
  const exact = ALL_NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const prefix = ALL_NAV_ITEMS.filter((i) => pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return prefix ? prefix.label : "HostOS";
}

export function TopBar({
  user,
  roles,
  notifications,
  unread,
  workspaceName,
  focus = null,
  notesEnabled = false,
}: {
  user: SessionUser | null;
  roles: string[];
  notifications: Notification[];
  unread: number;
  workspaceName: string;
  /** The vertical in focus, so the trail reads "Workspace / DoorDash / Dashboard". */
  focus?: WorkspaceModule | null;
  notesEnabled?: boolean;
}) {
  const pathname = usePathname();
  const crumb = useBreadcrumb(pathname);
  // The page's own vertical wins over the remembered one; shared pages show none.
  const vertical = moduleById(verticalFromPath(pathname) ?? focus ?? "");

  return (
    <div className="glass-surface sticky top-0 z-20 hidden items-center justify-between gap-4 border-b px-8 py-3 md:flex">
      <div className="flex min-w-0 items-center gap-3">
        <p className="flex min-w-0 items-center truncate text-[12.5px] text-muted-foreground">
          <span className="text-foreground/80">{workspaceName}</span>
          {vertical && (
            <>
              <span className="mx-1.5 text-muted-foreground/60">/</span>
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: vertical.hue }}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: vertical.hue }} />
                {vertical.title}
              </span>
            </>
          )}
          <span className="mx-1.5 text-muted-foreground/60">/</span>
          <span className="font-medium text-foreground">{crumb}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex h-9 w-72 items-center gap-2.5 rounded-full border border-border bg-muted/50 pl-3.5 pr-2 text-[13px] text-muted-foreground transition-colors hover:border-accent/40 hover:bg-card"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <span className="flex items-center gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        {notesEnabled && (
          <Button variant="ghost" size="icon" pill aria-label="Quick notes" title="Quick notes" onClick={toggleQuickNotes}>
            <StickyNote className="h-4 w-4" />
          </Button>
        )}
        <Button asChild variant="ghost" size="icon" pill aria-label="Ask the Butler">
          <Link href={routes.butler}>
            <Sparkles className="h-4 w-4 text-accent" />
          </Link>
        </Button>

        <NotificationBell initial={notifications} unread={unread} />
        <UserMenu user={user} roles={roles} showDetails />
      </div>
    </div>
  );
}
