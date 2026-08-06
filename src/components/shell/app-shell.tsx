"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Logo } from "@/components/shell/logo";
import { TopBar } from "@/components/shell/top-bar";
import { UserMenu } from "@/components/auth/user-menu";
import type { SessionUser } from "@/types/auth";
import type { DashboardData } from "@/lib/dashboard/queries";

export function AppShell({
  children,
  user,
  data,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
  data: DashboardData;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const navCounts: Record<string, number> = {
    "/operations": data.pickups.length + data.returns.length + data.overdueReturns.length,
    "/messages": data.messages.length,
    "/butler": data.suggestions.length,
  };

  return (
    <div className="min-h-screen">
      <AutoRefresh />
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border px-4 py-5 md:flex">
        <div className="px-1">
          <Logo size="sm" />
        </div>
        <div className="mt-8 flex-1">
          <SidebarNav counts={navCounts} />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            HostOS is active
          </span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1.5">
          <UserMenu user={user} />
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
                <Logo size="sm" />
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
        <TopBar vehicles={data.vehicles} messages={data.messages} unreadNotifications={data.fleetHealth.unreadCount} user={user} />
        <main className="px-6 pb-24 pt-10 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
