"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/auth/user-menu";
import type { SessionUser } from "@/types/auth";

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-accent" />
      <span className="text-[13px] font-semibold tracking-wide">HostOS</span>
    </div>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-screen">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border px-4 py-5 md:flex">
        <div className="px-1">
          <Wordmark />
        </div>
        <div className="mt-8 flex-1">
          <SidebarNav />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11.5px] text-muted-foreground">iHost is active</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Wordmark />
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
                <Wordmark />
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
                <SidebarNav onNavigate={() => setDrawerOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className="px-6 pb-24 pt-10 md:pl-64 md:pr-8 md:pt-12">
        <div className="mb-6 hidden justify-end md:flex">
          <UserMenu user={user} />
        </div>
        {children}
      </main>
    </div>
  );
}
