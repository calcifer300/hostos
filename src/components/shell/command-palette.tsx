"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Car, ChefHat, CornerDownLeft, MessageCircle, Search, ShoppingBag, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { ALL_NAV_ITEMS } from "@/components/shell/nav-items";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * What the palette can search, supplied by the layout from data it already
 * loaded for the page — no extra round-trip, no separate index.
 */
export interface PaletteSources {
  vehicles: { id: string; name: string; subtitle: string | null }[];
  conversations: { tripId: string; guestName: string; vehicle: string }[];
  restaurants: { id: string; name: string; subtitle: string | null }[];
  stores: { id: string; name: string; subtitle: string | null }[];
}

interface Result {
  id: string;
  group: "Pages" | "Vehicles" | "Conversations" | "Restaurants" | "Stores" | "Actions";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  href: string;
}

function score(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return 1;
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  const idx = h.indexOf(n);
  if (idx >= 0) return 60 - Math.min(idx, 30);
  // Subsequence match — "vwt" finds "Volkswagen Tiguan".
  let j = 0;
  for (let i = 0; i < h.length && j < n.length; i++) if (h[i] === n[j]) j++;
  return j === n.length ? 20 : 0;
}

export function CommandPalette({ sources }: { sources: PaletteSources }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    // Listen for the top bar's search button too.
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("hostos:open-palette", onOpen);
    return () => window.removeEventListener("hostos:open-palette", onOpen);
  }, []);

  const results = React.useMemo<Result[]>(() => {
    const q = query.trim();
    const all: (Result & { score: number })[] = [];

    for (const item of ALL_NAV_ITEMS) {
      const s = score(item.label, q);
      if (s > 0) all.push({ id: `page-${item.href}`, group: "Pages", title: item.label, icon: item.icon, href: item.href, score: s + 5 });
    }
    for (const v of sources.vehicles) {
      const s = Math.max(score(v.name, q), v.subtitle ? score(v.subtitle, q) - 10 : 0);
      if (q && s > 0) all.push({ id: `vehicle-${v.id}`, group: "Vehicles", title: v.name, subtitle: v.subtitle ?? undefined, icon: Car, href: routes.vehicle(v.name), score: s });
    }
    for (const c of sources.conversations) {
      const s = Math.max(score(c.guestName, q), score(c.vehicle, q) - 10);
      if (q && s > 0) all.push({ id: `conv-${c.tripId}`, group: "Conversations", title: c.guestName, subtitle: c.vehicle, icon: MessageCircle, href: routes.message(c.tripId), score: s });
    }
    for (const r of sources.restaurants) {
      const s = score(r.name, q);
      if (q && s > 0) all.push({ id: `rest-${r.id}`, group: "Restaurants", title: r.name, subtitle: r.subtitle ?? undefined, icon: ChefHat, href: routes.restaurant(r.id), score: s });
    }
    for (const st of sources.stores) {
      const s = score(st.name, q);
      if (q && s > 0) all.push({ id: `store-${st.id}`, group: "Stores", title: st.name, subtitle: st.subtitle ?? undefined, icon: ShoppingBag, href: routes.store(st.id), score: s });
    }
    const actions: Result[] = [
      { id: "act-butler", group: "Actions", title: "Ask the Butler", subtitle: "Draft, summarise, generate tasks", icon: Sparkles, href: routes.butler },
      { id: "act-task", group: "Actions", title: "New task", subtitle: "Add something to the team's list", icon: ArrowRight, href: `${routes.tasks}?new=1` },
    ];
    for (const a of actions) {
      const s = score(a.title, q);
      if (s > 0) all.push({ ...a, score: s - 15 });
    }

    return all.sort((a, b) => b.score - a.score).slice(0, 14);
  }, [query, sources]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      go(results[index].href);
    }
  }

  const grouped = React.useMemo(() => {
    const order: Result["group"][] = ["Pages", "Vehicles", "Conversations", "Restaurants", "Stores", "Actions"];
    return order.map((g) => ({ group: g, items: results.filter((r) => r.group === g) })).filter((g) => g.items.length > 0);
  }, [results]);

  let flat = -1;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <DialogContent size="lg" hideClose className="top-[18%] translate-y-0 p-0">
        <DialogTitle className="sr-only">Search HostOS</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, vehicles, guests, restaurants…"
            className="h-9 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/85"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85">{g.group}</p>
                {g.items.map((r) => {
                  flat += 1;
                  const current = flat;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onMouseEnter={() => setIndex(current)}
                      onClick={() => go(r.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        index === current ? "bg-muted text-foreground" : "text-foreground/85"
                      )}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px]">{r.title}</span>
                        {r.subtitle && <span className="block truncate text-[11.5px] text-muted-foreground">{r.subtitle}</span>}
                      </span>
                      <AnimatePresence>
                        {index === current && (
                          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-muted-foreground">
                            <CornerDownLeft className="h-3.5 w-3.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd> toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the palette from anywhere (the top bar's search field is a button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event("hostos:open-palette"));
}
