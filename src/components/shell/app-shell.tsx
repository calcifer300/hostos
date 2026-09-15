"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo, LogoMark } from "@/components/brand/logo-mark";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { GmailAutoSync } from "@/components/shell/gmail-auto-sync";
import { TopBar } from "@/components/shell/top-bar";
import { UserMenu } from "@/components/auth/user-menu";
import { BackendStatusBanner, type BackendStatusView } from "@/components/shell/backend-status-banner";
import { BackendStatusProvider } from "@/components/shell/backend-status-context";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/shell/workspace-switcher";
import { CommandPalette, type PaletteSources } from "@/components/shell/command-palette";
import type { SessionUser } from "@/types/auth";
import type { Notification } from "@/lib/notifications/queries";
import type { WorkspaceModule } from "@/lib/host/queries";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "hostos:sidebar-collapsed";
const EASE = [0.16, 1, 0.3, 1] as const;

export interface AppShellProps {
  children: React.ReactNode;
  user: SessionUser | null;
  roles: string[];
  backendStatus: BackendStatusView;
  currentHostId: string;
  workspaces: WorkspaceOption[];
  workspaceName: string;
  modules: WorkspaceModule[];
  /** The vertical chosen on /app/start, remembered per browser. */
  focus: WorkspaceModule | null;
  navCounts: Record<string, number>;
  notifications: Notification[];
  unreadNotifications: number;
  palette: PaletteSources;
}

/**
 * The product chrome: a collapsible glass sidebar, a top bar with the
 * command palette and the bell, and the page. Everything data-shaped arrives
 * as props from app/app/layout.tsx so this file never touches a database and
 * can render a skeleton of itself instantly.
 */
export function AppShell({
  children,
  user,
  roles,
  backendStatus,
  currentHostId,
  workspaces,
  workspaceName,
  modules,
  focus,
  navCounts,
  notifications,
  unreadNotifications,
  palette,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const backendOk = backendStatus.state === "ok" || backendStatus.state === "unknown";

  React.useEffect(() => {
    try {
      // Personal preference, per browser — not worth a database round-trip.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage blocked */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        /* storage blocked */
      }
      return !v;
    });
  }

  const rail = (mobile: boolean) => (
    <>
      <div className={cn("px-1", collapsed && !mobile && "px-0")}>
        {collapsed && !mobile ? (
          <div className="flex justify-center py-1">
            <LogoMark size={26} />
          </div>
        ) : (
          <Logo size="sm" />
        )}
        <div className="mt-4">
          <WorkspaceSwitcher workspaces={workspaces} currentHostId={currentHostId} collapsed={collapsed && !mobile} />
        </div>
      </div>
      <div className="mt-6 flex-1 overflow-y-auto pb-4">
        <SidebarNav
          counts={navCounts}
          modules={modules} focus={focus}
          collapsed={collapsed && !mobile}
          onNavigate={mobile ? () => setDrawerOpen(false) : undefined}
        />
      </div>
      <div className={cn("flex items-center gap-1 px-1", collapsed && !mobile ? "flex-col" : "justify-between")}>
        {(!collapsed || mobile) && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {backendOk && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />}
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", backendOk ? "bg-success" : "bg-warning")} />
            </span>
            {backendOk ? "All systems live" : "Limited connectivity"}
          </span>
        )}
        <div className="flex items-center">
          <ThemeToggle />
          {!mobile && (
            <Button variant="ghost" size="icon" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <BackendStatusProvider status={backendStatus}>
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen">
          <AutoRefresh />
          {user && <GmailAutoSync />}
          <CommandPalette sources={palette} />

          {/* Desktop rail */}
          <motion.aside
            initial={false}
            animate={{ width: collapsed ? 72 : 240 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="glass-surface fixed inset-y-0 left-0 z-30 hidden flex-col border-r px-3 py-4 md:flex"
          >
            {rail(false)}
          </motion.aside>

          {/* Mobile top bar */}
          <div className="glass-surface sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden">
            <Logo size="sm" />
            <div className="flex items-center gap-1.5">
              <UserMenu user={user} roles={roles} />
              <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {drawerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
                  onClick={() => setDrawerOpen(false)}
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background px-3 py-4 md:hidden"
                >
                  <div className="mb-2 flex justify-end">
                    <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {rail(true)}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Content */}
          <motion.div
            initial={false}
            animate={{ paddingLeft: collapsed ? 72 : 240 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="max-md:!pl-0"
          >
            <TopBar
              user={user}
              roles={roles}
              notifications={notifications}
              unread={unreadNotifications}
              workspaceName={workspaceName}
            />
            <BackendStatusBanner status={backendStatus} />
            <main className="px-5 pb-24 pt-8 md:px-8">{children}</main>
          </motion.div>
        </div>
      </TooltipProvider>
    </BackendStatusProvider>
  );
}
