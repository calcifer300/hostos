"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Car, MessageCircle, Search } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import type { SessionUser } from "@/types/auth";
import type { AttentionMessage, FleetVehicle } from "@/lib/dashboard/queries";

interface SearchResult {
  id: string;
  kind: "vehicle" | "message";
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Real search over what's already loaded for this request (vehicles,
 * unread guest messages) — no separate index or API round-trip. Press
 * Cmd/Ctrl+K anywhere to focus it, matching the reference layout's hint.
 */
export function TopBar({
  vehicles,
  messages,
  unreadNotifications,
  user,
}: {
  vehicles: FleetVehicle[];
  messages: AttentionMessage[];
  unreadNotifications: number;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const results = React.useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const vehicleResults: SearchResult[] = vehicles
      .filter((v) => v.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((v) => ({
        id: `vehicle-${v.id}`,
        kind: "vehicle",
        title: v.name,
        subtitle: v.nextEventLabel ?? `${v.tripCount} ${v.tripCount === 1 ? "reservation" : "reservations"}`,
        href: `/fleet/${encodeURIComponent(v.name)}`,
      }));

    const messageResults: SearchResult[] = messages
      .filter((m) => m.guestName.toLowerCase().includes(q) || m.vehicle.toLowerCase().includes(q))
      .slice(0, 5)
      .map((m) => ({
        id: `message-${m.id}`,
        kind: "message",
        title: m.guestName,
        subtitle: m.vehicle,
        href: `/messages/${encodeURIComponent(m.id)}`,
      }));

    return [...vehicleResults, ...messageResults].slice(0, 8);
  }, [query, vehicles, messages]);

  function go(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-border bg-background/80 px-8 py-3.5 backdrop-blur md:flex">
      <div ref={containerRef} className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search vehicles, guests..."
          className="h-9 w-full rounded-full border border-border bg-muted/60 pl-9 pr-12 text-[13px] outline-none transition-colors focus:border-accent/50 focus:bg-card"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
          &#8984;K
        </kbd>

        <AnimatePresence>
          {open && query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
            >
              {results.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => go(r.href)}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      {r.kind === "vehicle" ? (
                        <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.title}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{r.subtitle}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>
        <UserMenu user={user} />
      </div>
    </div>
  );
}
