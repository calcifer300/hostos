"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Bell, Blocks, Car, Check, ChefHat, CheckSquare, Coffee, Globe, Info, MessageCircle, Scissors, ShieldAlert, ShoppingBag, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markRead } from "@/lib/actions/notifications";
import type { Notification, NotificationKind } from "@/lib/notifications/queries";
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

const KIND_LABEL: Record<NotificationKind, string> = {
  trip: "Trips",
  message: "Messages",
  alert: "Alerts",
  restaurant: "Restaurants",
  order: "Orders",
  store: "Stores",
  web: "Web & domains",
  cafe: "Café",
  salon: "Barbershop",
  custom: "Custom",
  task: "Tasks",
  system: "System",
  butler: "Butler",
};

const SEVERITY_RING = { info: "ring-accent/40", success: "ring-success/50", warning: "ring-warning/50", critical: "ring-danger/60" } as const;

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [kind, setKind] = React.useState<"all" | NotificationKind>("all");

  const kinds = Array.from(new Set(notifications.map((n) => n.kind)));
  const visible = kind === "all" ? notifications : notifications.filter((n) => n.kind === kind);
  const unread = notifications.filter((n) => !n.readAt).length;

  function clear() {
    startTransition(async () => {
      const result = await markRead("all");
      if (!result.ok) return void toast.error(result.error ?? "Couldn't update.");
      router.refresh();
    });
  }

  function open(n: Notification) {
    if (!n.readAt) startTransition(async () => { await markRead([n.id]); router.refresh(); });
    if (n.href) router.push(n.href);
  }

  const groups = groupByDay(visible);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Everything that needed a person, from every module — {unread > 0 ? `${unread} unread` : "all caught up"}.
          </p>
        </div>
        <Button variant="secondary" onClick={clear} disabled={unread === 0} loading={pending}>
          <Check /> Mark all read
        </Button>
      </div>

      {kinds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["all", ...kinds] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn("rounded-full px-3 py-1 text-[12px] font-medium transition-colors", kind === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {k === "all" ? "All" : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <Bell className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] font-medium">Nothing yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Alerts, overdue returns, store changes, menu updates and Butler activity land here as they happen.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{g.label}</p>
              <Card>
                <ul className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {g.items.map((n) => {
                      const Icon = KIND_ICON[n.kind] ?? Info;
                      return (
                        <motion.li key={n.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                          <button type="button" onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50", !n.readAt && "bg-accent/[0.04]")}>
                            <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2", SEVERITY_RING[n.severity])}>
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block text-[13.5px]", !n.readAt ? "font-medium" : "text-foreground/85")}>{n.title}</span>
                              {n.body && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{n.body}</span>}
                              <span className="mt-1 block text-[11px] text-muted-foreground/70">
                                {KIND_LABEL[n.kind]} · {formatRelativeTime(n.createdAt)}
                              </span>
                            </span>
                            {!n.readAt && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                            {n.href && (
                              <Link href={n.href} onClick={(e) => e.stopPropagation()} className="sr-only">
                                Open
                              </Link>
                            )}
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(items: Notification[]): { label: string; items: Notification[] }[] {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const map = new Map<string, Notification[]>();
  for (const n of items) {
    const d = new Date(n.createdAt).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(n.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    map.set(label, [...(map.get(label) ?? []), n]);
  }
  return Array.from(map.entries()).map(([label, list]) => ({ label, items: list }));
}
