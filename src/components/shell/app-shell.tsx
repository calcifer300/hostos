"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { GmailAutoSync } from "@/components/shell/gmail-auto-sync";
import { Logo } from "@/components/shell/logo";
import { TopBar } from "@/components/shell/top-bar";
import { UserMenu } from "@/components/auth/user-menu";
import { BackendStatusBanner, type BackendStatusView } from "@/components/shell/backend-status-banner";
import { BackendStatusProvider } from "@/components/shell/backend-status-context";
import { FleetSwitcher, type FleetOption } from "@/components/shell/fleet-switcher";
import type { SessionUser } from "@/types/auth";
import type { DashboardData } from "@/lib/dashboard/queries";

/**
 * Branding hierarchy is HostOS -> client (Colorado Cruisers) -> the
 * specific Turo team this data is synced from. "Matthew's Fleet" is that
 * team's real name on Turo (Hosting teams -> "Denver", owner Matthew) — the
 * hosts.name column (see migration 0003_trips.sql), so it's a real seeded
 * value rather than hardcoded; this is only the fallback for a deployment
 * where that column is still blank.
 */
const FALLBACK_FLEET_NAME = "Matthew's Fleet";

export function AppShell({
  children,
  user,
  data,
  fleetName,
  roles,
  backendStatus,
  currentHostId,
  fleets,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
  data: DashboardData;
  fleetName: string | null;
  roles: string[];
  backendStatus: BackendStatusView;
  currentHostId: string;
  fleets: FleetOption[];
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const displayFleetName = fleetName || FALLBACK_FLEET_NAME;
  const backendOk = backendStatus.state === "ok" || backendStatus.state === "unknown";

  const navCounts: Record<string, number> = {
    "/operations": data.pickups.length + data.returns.length + data.overdueReturns.length,
    "/messages": data.messages.length,
    "/butler": data.suggestions.length,
  };

  return (
    <BackendStatusProvider status={backendStatus}>
    <div className="min-h-screen">
      <AutoRefresh />
      {user && <GmailAutoSync />}
      {/* Desktop rail */}
      <aside className="glass-surface fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border px-4 py-5 md:flex">
        <div className="px-1">
          <Logo size="sm" />
          {fleets.length > 1 ? (
            <FleetSwitcher fleets={fleets} currentHostId={currentHostId} />
          ) : (
            <p className="mt-1.5 truncate text-[11.5px] font-medium text-muted-foreground">{displayFleetName}</p>
          )}
        </div>
        <div className="mt-8 flex-1">
          <SidebarNav counts={navCounts} />
        </div>
        <div className="flex items-center justify-between px-1">
          {/* Reflects the real state of the data layer. This used to be a
              hardcoded green "active" pulse, which kept claiming the system
              was healthy while every query was failing. */}
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {backendOk && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${backendOk ? "bg-success" : "bg-warning"}`}
              />
            </span>
            {backendOk ? "HostOS is active" : "Limited connectivity"}
          </span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="glass-surface sticky top-0 z-30 flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1.5">
          <UserMenu user={user} roles={roles} />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
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
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background px-4 py-5 md:hidden"
            >
              <div className="flex items-center justify-between px-1">
                <div className="min-w-0 flex-1">
                  <Logo size="sm" />
                  {fleets.length > 1 ? (
                    <FleetSwitcher fleets={fleets} currentHostId={currentHostId} />
                  ) : (
                    <p className="mt-1.5 truncate text-[11.5px] font-medium text-muted-foreground">{displayFleetName}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-8">
                <SidebarNav counts={navCounts} onNavigate={() => setDrawerOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="md:pl-56">
        <TopBar
          vehicles={data.vehicles}
          messages={data.messages}
          unreadNotifications={data.fleetHealth.unreadCount}
          user={user}
          roles={roles}
        />
        <BackendStatusBanner status={backendStatus} />
        <main className="px-6 pb-24 pt-10 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
    </BackendStatusProvider>
  );
}
