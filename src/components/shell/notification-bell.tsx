"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Blocks, Check, ChefHat, Coffee, Globe, MessageCircle, Scissors, ShieldAlert, Sparkles, Car, Info, CheckSquare, ShoppingBag, Store } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { markRead } from "@/lib/actions/notifications";
import type { Notification, NotificationKind } from "@/lib/notifications/queries";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";

const KIND_ICON: Record<NotificationKind, React.ElementType> = {
  trip: Car,
  message: MessageCircle,
  alert: ShieldAlert,
  restaurant: ChefHat,
  order: ShoppingBag,
  store: Store,
  web: Globe,
  cafe: Coffee,
  salon: Scissors,
  custom: Blocks,
  task: CheckSquare,
  system: Info,
  butler: Sparkles,
};

const SEVERITY_DOT = {
  info: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
} as const;

export function NotificationBell({ initial, unread }: { initial: Notification[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [items, setItems] = React.useState(initial);
  const [count, setCount] = React.useState(unread);

  // Server refreshes hand new props down; adopt them during render.
  const [seen, setSeen] = React.useState({ initial, unread });
  if (seen.initial !== initial || seen.unread !== unread) {
    setSeen({ initial, unread });
    setItems(initial);
    setCount(unread);
  }

  function clearAll() {
    startTransition(async () => {
      const res = await markRead("all");
      if (res.ok) {
        setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        setCount(0);
        router.refresh();
      }
    });
  }

  function openOne(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      startTransition(async () => {
        await markRead([n.id]);
        router.refresh();
      });
    }
    if (n.href) router.push(n.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white"
              >
                {count > 9 ? "9+" : count}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px]">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[13.5px] font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={count === 0 || pending} className="h-7 gap-1 px-2 text-[12px]">
            <Check className="h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
        <div className="max-h-[380px] overflow-y-auto border-t border-border">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing yet. Alerts, messages and store events land here.</p>
          ) : (
            items.slice(0, 12).map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Info;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openOne(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    !n.readAt && "bg-accent/[0.04]"
                  )}
                >
                  <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-card", SEVERITY_DOT[n.severity])} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px]", !n.readAt ? "font-medium text-foreground" : "text-foreground/85")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">{formatRelativeTime(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border px-4 py-2.5">
          <Link href={routes.notifications} onClick={() => setOpen(false)} className="text-[12.5px] font-medium text-accent hover:underline">
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
