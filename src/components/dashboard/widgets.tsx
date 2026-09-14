"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Calendar,
  Car,
  ChefHat,
  CheckSquare,
  Clock3,
  ListChecks,
  LogIn,
  LogOut,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { FleetOverviewCard } from "@/components/dashboard/fleet-overview-card";
import { OccupancyRateCard } from "@/components/dashboard/occupancy-rate-card";
import { TaskPriorityCard } from "@/components/dashboard/task-priority-card";
import { GuestMessagesCard } from "@/components/dashboard/guest-messages-card";
import { AiBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { VehicleOperationsTimeline } from "@/components/dashboard/vehicle-operations-timeline";
import { FleetStatusGrid } from "@/components/dashboard/fleet-status-grid";
import { StatusPill } from "@/components/restaurants/status-pill";
import { RestaurantList } from "@/components/restaurants/restaurant-list";
import { StoreList } from "@/components/commerce/store-list";
import { BarChart, RankBar, Sparkline } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/restaurants/analytics";
import { activityScope, inScope, notificationScope, taskScope } from "@/lib/dashboard/scope";
import type { DashboardScope } from "@/lib/dashboard/widgets";
import type { DashboardData } from "@/lib/dashboard/queries";
import type { GuestConversation } from "@/lib/messages/queries";
import type { InboundTuroEmail } from "@/types/butler";
import type { Task } from "@/lib/tasks/queries";
import type { Notification } from "@/lib/notifications/queries";
import type { ActivityEvent } from "@/lib/activity/queries";
import type { BoardTrip } from "@/lib/board/queries";
import type { Restaurant, ComparisonSummary } from "@/lib/restaurants/types";
import type { CommerceStore } from "@/lib/commerce/queries";
import { MODULES } from "@/lib/modules";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";

/** Everything any widget could need, assembled once by lib/dashboard/assemble.ts. */
export interface WidgetData {
  scope: DashboardScope;
  modules: string[];
  canEdit: boolean;
  data: DashboardData;
  guestMessages: GuestConversation[];
  initialEmail: InboundTuroEmail | null;
  tasks: Task[];
  notifications: Notification[];
  activity: ActivityEvent[];
  boardTrips: BoardTrip[];
  restaurants: { restaurant: Restaurant; latest: { summary: ComparisonSummary; createdAt: string } | null; ordersToday: number; revenueToday: number }[];
  restaurantOrdersDaily: { label: string; orders: number; revenue: number }[];
  restaurantTopItems: { name: string; quantity: number }[];
  restaurantLowStock: { restaurant: string; name: string; quantity: number }[];
  stores: {
    store: CommerceStore;
    products: number;
    revenue14d: number;
    orders14d: number;
    revenueChangePct: number | null;
    unfulfilled: number;
    lowStock: { title: string; quantity: number }[];
    lowStockCount: number;
    daily: { label: string; orders: number; revenue: number }[];
    topProducts: { title: string; quantity: number; revenue: number }[];
    lastRun: { ok: boolean | null; at: string; error: string | null } | null;
  }[];
}

const viewAll = (href: string, label = "View all →") => (
  <Link href={href} className="text-[12px] font-medium text-accent transition-opacity hover:opacity-80">
    {label}
  </Link>
);

/* -------------------------------------------------------------- stats */

function StatsWidget({ d }: { d: WidgetData }) {
  const fleet = d.modules.includes("fleet");
  const restaurants = d.modules.includes("restaurants");
  const commerce = d.modules.includes("commerce");
  const openTasks = d.tasks.filter((t) => (t.status === "open" || t.status === "in_progress") && inScope(d.scope, taskScope(t))).length;
  const butlerTasks = d.tasks.filter((t) => t.source === "butler" && t.status === "open" && inScope(d.scope, taskScope(t))).length;
  const ordersToday = d.restaurants.reduce((s, r) => s + r.ordersToday, 0);
  const revenueToday = d.restaurants.reduce((s, r) => s + r.revenueToday, 0);
  const menuChanges = d.restaurants.reduce((s, r) => s + (r.latest ? r.latest.summary.needsUpdate + r.latest.summary.missingOnDoordash : 0), 0);
  const revenue14 = d.stores.reduce((s, st) => s + st.revenue14d, 0);
  const orders14 = d.stores.reduce((s, st) => s + st.orders14d, 0);
  const lowStock = d.stores.reduce((s, st) => s + st.lowStockCount, 0) + d.restaurantLowStock.length;
  const unfulfilled = d.stores.reduce((s, st) => s + st.unfulfilled, 0);
  const onTrip = d.data.vehicles.filter((v) => v.status === "on_trip").length;
  const available = d.data.vehicles.filter((v) => v.status === "available").length;
  const urgentMessages = d.data.messages.filter((m) => m.urgency === "high").length;

  const tasksTile = (
    <StatCard key="tasks" icon={CheckSquare} label="Open tasks" value={openTasks} breakdown={openTasks > 0 ? `${butlerTasks} filed by the Butler` : "Nothing waiting"} href={routes.tasks} tone={openTasks > 0 ? "warning" : "success"} />
  );

  const tiles: React.ReactNode[] = [];

  if (d.scope === "fleet") {
    tiles.push(
      <StatCard key="trips" icon={Calendar} label="Today's trips" value={d.data.pickups.length + d.data.returns.length} breakdown={`${d.data.pickups.length} pickups · ${d.data.returns.length} returns`} href={routes.operations} tone="accent" />,
      <StatCard key="vehicles" icon={Car} label="On trip" value={`${onTrip}/${d.data.vehicles.length}`} breakdown={`${available} available now`} href={routes.vehicles} tone="success" />,
      <StatCard key="messages" icon={MessageCircle} label="Guest messages" value={d.data.messages.length} breakdown={urgentMessages > 0 ? `${urgentMessages} urgent` : "None waiting"} href={routes.messages} tone={urgentMessages > 0 ? "danger" : "accent"} />,
      <StatCard key="overdue" icon={ShieldAlert} label="Needs attention" value={d.data.overdueReturns.length + d.data.suggestions.length} breakdown={`${d.data.overdueReturns.length} overdue · ${d.data.suggestions.length} suggested`} href={d.data.overdueReturns.length > 0 ? routes.operations : routes.risk} tone={d.data.overdueReturns.length > 0 ? "danger" : "warning"} />,
      tasksTile
    );
  } else if (d.scope === "restaurants") {
    const open = d.restaurants.filter((r) => r.restaurant.status === "open").length;
    const paused = d.restaurants.filter((r) => r.restaurant.status === "paused" || r.restaurant.status === "closed").length;
    tiles.push(
      <StatCard key="orders" icon={UtensilsCrossed} label="Orders today" value={ordersToday} breakdown={`${formatMoney(revenueToday)} in sales`} href={routes.restaurants} tone="accent" />,
      <StatCard key="stores" icon={Store} label="Stores open" value={`${open}/${d.restaurants.length}`} breakdown={paused > 0 ? `${paused} paused or closed` : "All storefronts taking orders"} href={routes.restaurants} tone={paused > 0 ? "danger" : "success"} />,
      <StatCard key="menu" icon={ListChecks} label="Menu changes pending" value={menuChanges} breakdown={menuChanges > 0 ? "POS and DoorDash disagree" : "Menus in sync"} href={routes.restaurants} tone={menuChanges > 0 ? "warning" : "success"} />,
      <StatCard key="stock" icon={Package} label="Low stock" value={d.restaurantLowStock.length} breakdown={d.restaurantLowStock.length > 0 ? "Items under threshold" : "Nothing running out"} href={routes.restaurants} tone={d.restaurantLowStock.length > 0 ? "warning" : "success"} />,
      tasksTile
    );
  } else if (d.scope === "commerce") {
    const change = d.stores.length > 0 ? d.stores.reduce((s, st) => s + (st.revenueChangePct ?? 0), 0) / d.stores.length : null;
    tiles.push(
      <StatCard key="sales" icon={TrendingUp} label="Sales · 14d" value={formatMoney(revenue14)} breakdown={change !== null && d.stores.length > 0 ? `${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs prior 14 days` : "Connect a store to start"} href={routes.commerce} tone="success" />,
      <StatCard key="orders" icon={ShoppingBag} label="Orders · 14d" value={orders14} breakdown={`${unfulfilled} unfulfilled`} href={routes.commerce} tone={unfulfilled > 0 ? "warning" : "accent"} />,
      <StatCard key="stock" icon={Package} label="Low stock" value={d.stores.reduce((s, st) => s + st.lowStockCount, 0)} breakdown={`${d.stores.reduce((s, st) => s + st.products, 0)} products tracked`} href={routes.commerce} tone={d.stores.reduce((s, st) => s + st.lowStockCount, 0) > 0 ? "warning" : "success"} />,
      <StatCard key="stores" icon={Store} label="Stores" value={d.stores.length} breakdown={`${d.stores.filter((s) => s.store.status === "active").length} active`} href={routes.commerce} tone="accent" />,
      tasksTile
    );
  } else {
    // Home: one headline per line of business, then the shared numbers.
    if (fleet) tiles.push(<StatCard key="trips" icon={Calendar} label="Today's trips" value={d.data.pickups.length + d.data.returns.length} breakdown={`${d.data.pickups.length} pickups · ${d.data.returns.length} returns`} href={routes.fleet} tone="accent" />);
    if (restaurants) tiles.push(<StatCard key="orders" icon={ChefHat} label="Orders today" value={ordersToday} breakdown={`${d.restaurants.length} restaurant${d.restaurants.length === 1 ? "" : "s"} · ${d.restaurants.filter((r) => r.restaurant.status === "open").length} open`} href={routes.restaurants} tone="accent" />);
    if (commerce) tiles.push(<StatCard key="sales" icon={ShoppingBag} label="Sales · 14d" value={formatMoney(revenue14)} breakdown={`${orders14} orders across ${d.stores.length} store${d.stores.length === 1 ? "" : "s"}`} href={routes.commerce} tone="success" />);
    tiles.push(tasksTile);
    const attention = d.data.suggestions.length + d.data.overdueReturns.length + d.restaurants.filter((r) => r.restaurant.status === "paused").length + lowStock;
    tiles.push(<StatCard key="attention" icon={AlertTriangle} label="Needs attention" value={attention} breakdown={`${d.data.overdueReturns.length} overdue · ${d.data.suggestions.length} suggested · ${lowStock} low stock`} href={routes.notifications} tone={attention > 0 ? "warning" : "success"} />);
  }

  const shown = tiles.slice(0, 5);
  return <div className={cn("grid grid-cols-2 gap-4", shown.length >= 5 ? "lg:grid-cols-5" : shown.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>{shown}</div>;
}

/* --------------------------------------------------- lines of business */

const BUSINESS_ICON = { Car, ChefHat, ShoppingBag } as const;

function BusinessesWidget({ d }: { d: WidgetData }) {
  const enabled = MODULES.filter((m) => d.modules.includes(m.id));
  if (enabled.length === 0) return null;

  const cards = enabled.map((m) => {
    const Icon = BUSINESS_ICON[m.icon];
    if (m.id === "fleet") {
      const onTrip = d.data.vehicles.filter((v) => v.status === "on_trip").length;
      return {
        module: m,
        icon: Icon,
        href: routes.fleet,
        platform: "Turo",
        stats: [
          { label: "Vehicles", value: String(d.data.vehicles.length) },
          { label: "On trip", value: String(onTrip) },
          { label: "Today", value: `${d.data.pickups.length + d.data.returns.length} trips` },
        ],
        alert: d.data.overdueReturns.length > 0 ? `${d.data.overdueReturns.length} overdue return${d.data.overdueReturns.length === 1 ? "" : "s"}` : d.data.messages.filter((x) => x.urgency === "high").length > 0 ? "Urgent guest message waiting" : null,
      };
    }
    if (m.id === "restaurants") {
      const paused = d.restaurants.filter((r) => r.restaurant.status === "paused" || r.restaurant.status === "closed").length;
      const pending = d.restaurants.reduce((s, r) => s + (r.latest ? r.latest.summary.needsUpdate + r.latest.summary.missingOnDoordash : 0), 0);
      return {
        module: m,
        icon: Icon,
        href: routes.restaurants,
        platform: "DoorDash",
        stats: [
          { label: "Stores", value: String(d.restaurants.length) },
          { label: "Orders today", value: String(d.restaurants.reduce((s, r) => s + r.ordersToday, 0)) },
          { label: "Sales today", value: formatMoney(d.restaurants.reduce((s, r) => s + r.revenueToday, 0)) },
        ],
        alert: paused > 0 ? `${paused} store${paused === 1 ? "" : "s"} not taking orders` : pending > 0 ? `${pending} menu change${pending === 1 ? "" : "s"} pending` : null,
      };
    }
    const low = d.stores.reduce((s, st) => s + st.lowStockCount, 0);
    return {
      module: m,
      icon: Icon,
      href: routes.commerce,
      platform: "Shopify",
      stats: [
        { label: "Stores", value: String(d.stores.length) },
        { label: "Orders · 14d", value: String(d.stores.reduce((s, st) => s + st.orders14d, 0)) },
        { label: "Sales · 14d", value: formatMoney(d.stores.reduce((s, st) => s + st.revenue14d, 0)) },
      ],
      alert: low > 0 ? `${low} product${low === 1 ? "" : "s"} low on stock` : null,
    };
  });

  return (
    <div className={cn("grid grid-cols-1 gap-4", cards.length >= 3 ? "md:grid-cols-3" : cards.length === 2 ? "md:grid-cols-2" : "")}>
      {cards.map((c) => (
        <motion.div key={c.module.id} whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
          <Link
            href={c.href}
            className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
          >
            <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-accent/10 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
                  <c.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight">{c.module.label}</p>
                  <p className="text-[12px] text-muted-foreground">{c.platform} · own dashboard</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {c.stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-background/40 px-3 py-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-1 truncate text-[17px] font-semibold leading-none tracking-tight">{s.value}</p>
                </div>
              ))}
            </div>
            <p className={cn("mt-4 flex items-center gap-1.5 text-[12px]", c.alert ? "text-warning" : "text-success")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", c.alert ? "bg-warning" : "bg-success")} />
              {c.alert ?? "Running normally"}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- tasks */

const PRIORITY_DOT: Record<string, string> = { critical: "bg-danger", high: "bg-warning", medium: "bg-accent", low: "bg-muted-foreground" };

function TasksWidget({ d }: { d: WidgetData }) {
  const now = useNow();
  const active = d.tasks.filter((t) => (t.status === "open" || t.status === "in_progress") && inScope(d.scope, taskScope(t))).slice(0, 6);
  return (
    <DashboardCard icon={CheckSquare} title="Tasks" action={viewAll(routes.tasks)} className="h-full">
      {active.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing open. The Butler files work here as it appears.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((t) => (
            <li key={t.id} className="flex items-start gap-2.5">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.source === "butler" ? "Butler" : t.source} · {formatRelativeTime(t.createdAt)}
                  {t.dueAt && Date.parse(t.dueAt) < now && <span className="ml-1 text-danger">· overdue</span>}
                </p>
              </div>
              {t.href && (
                <Link href={t.href} className="text-muted-foreground hover:text-accent" aria-label="Open">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ------------------------------------------------------- notifications */

function NotificationsWidget({ d }: { d: WidgetData }) {
  const list = d.notifications.filter((n) => inScope(d.scope, notificationScope(n))).slice(0, 6);
  return (
    <DashboardCard icon={Bell} title="Notifications" action={viewAll(routes.notifications)} className="h-full">
      {list.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Quiet so far.</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.severity === "critical" ? "bg-danger" : n.severity === "warning" ? "bg-warning" : n.severity === "success" ? "bg-success" : "bg-accent", n.readAt && "opacity-40")} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-[13px]", !n.readAt && "font-medium")}>{n.href ? <Link href={n.href} className="hover:text-accent">{n.title}</Link> : n.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* -------------------------------------------------------------- board */

function BoardWidget({ d }: { d: WidgetData }) {
  const trips = d.boardTrips.slice(0, 6);
  return (
    <DashboardCard icon={Clock3} title="Needs you next" action={viewAll(routes.board, "Open board →")} className="h-full">
      {trips.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No trips on the board.</p>
      ) : (
        <ul className="space-y-1">
          {trips.map((t) => (
            <li key={`${t.hostId}-${t.id}`}>
              <Link href={routes.message(t.id)} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{t.guestName ?? "Guest"} <span className="font-normal text-muted-foreground">· {t.vehicle}</span></p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.fleetName}</p>
                </div>
                <span className={cn("shrink-0 font-mono text-[12px] font-semibold tabular-nums", t.timer.tone === "critical" ? "text-danger" : t.timer.tone === "warning" ? "text-warning" : "text-accent")}>
                  {t.timer.text || t.timer.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* --------------------------------------------------------- restaurants */

function RestaurantsWidget({ d }: { d: WidgetData }) {
  return (
    <DashboardCard icon={ChefHat} title="Store status" action={viewAll(routes.restaurants, "Restaurant dashboard →")} className="h-full">
      {d.restaurants.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No restaurants yet. Add one from the Restaurant dashboard.</p>
      ) : (
        <ul className="space-y-1">
          {d.restaurants.slice(0, 6).map(({ restaurant, latest, ordersToday }) => {
            const pending = latest ? latest.summary.needsUpdate + latest.summary.missingOnDoordash : 0;
            return (
              <li key={restaurant.id}>
                <Link href={routes.restaurant(restaurant.id)} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{restaurant.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ordersToday} orders today{pending > 0 ? ` · ${pending} menu changes pending` : ""}
                    </p>
                  </div>
                  <StatusPill status={restaurant.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

function OrdersWidget({ d }: { d: WidgetData }) {
  const total = d.restaurantOrdersDaily.reduce((s, x) => s + x.orders, 0);
  const revenue = d.restaurantOrdersDaily.reduce((s, x) => s + x.revenue, 0);
  return (
    <DashboardCard icon={ChefHat} title="Delivery orders · 14 days" action={<span className="text-[12px] text-muted-foreground">{total} orders · {formatMoney(revenue)}</span>} className="h-full">
      {total === 0 ? (
        <p className="text-[13px] text-muted-foreground">Import an order export on a restaurant to see volume here.</p>
      ) : (
        <BarChart data={d.restaurantOrdersDaily.map((x) => ({ label: x.label, value: x.orders }))} height={120} format={(v) => `${v} orders`} />
      )}
    </DashboardCard>
  );
}

function MenuSyncWidget({ d }: { d: WidgetData }) {
  const rows = d.restaurants
    .map((r) => ({ restaurant: r.restaurant, summary: r.latest?.summary ?? null, at: r.latest?.createdAt ?? null }))
    .sort((a, b) => (b.summary ? b.summary.needsUpdate + b.summary.missingOnDoordash : -1) - (a.summary ? a.summary.needsUpdate + a.summary.missingOnDoordash : -1))
    .slice(0, 6);
  return (
    <DashboardCard icon={ListChecks} title="Menu sync" className="h-full">
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Add a restaurant and upload its POS and DoorDash exports to compare menus.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ restaurant, summary, at }) => {
            const pending = summary ? summary.needsUpdate + summary.missingOnDoordash : null;
            return (
              <li key={restaurant.id}>
                <Link href={routes.restaurantTab(restaurant.id, "menu")} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{restaurant.name}</p>
                    <p className="text-[11px] text-muted-foreground">{at ? `Compared ${formatRelativeTime(at)}` : "No comparison yet"}</p>
                  </div>
                  {pending === null ? <Badge variant="neutral">Upload exports</Badge> : pending > 0 ? <Badge variant="warning">{pending} to push</Badge> : <Badge variant="success">In sync</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

function TopItemsWidget({ d }: { d: WidgetData }) {
  const max = Math.max(1, ...d.restaurantTopItems.map((i) => i.quantity));
  return (
    <DashboardCard icon={UtensilsCrossed} title="Top items · 14 days" className="h-full">
      {d.restaurantTopItems.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Order history shows your best sellers here.</p>
      ) : (
        <div className="space-y-2.5">
          {d.restaurantTopItems.map((i, idx) => (
            <RankBar key={i.name} label={i.name} value={i.quantity} max={max} index={idx} format={(v) => `${v} sold`} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

/* ------------------------------------------------------------ commerce */

function CommerceWidget({ d }: { d: WidgetData }) {
  return (
    <DashboardCard icon={ShoppingBag} title="Online sales · 14 days" action={viewAll(routes.commerce, "Commerce dashboard →")} className="h-full">
      {d.stores.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Connect a Shopify store to see sales here.</p>
      ) : (
        <ul className="space-y-2">
          {d.stores.slice(0, 5).map(({ store, revenue14d, orders14d, daily }) => (
            <li key={store.id}>
              <Link href={routes.store(store.id)} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{store.name}</p>
                  <p className="text-[11px] text-muted-foreground">{orders14d} orders · {formatMoney(revenue14d, store.currency)}</p>
                </div>
                <Sparkline values={daily.map((x) => x.revenue)} width={90} height={28} tone="success" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

function SalesWidget({ d }: { d: WidgetData }) {
  // Sum every store's daily series by position — they share the same 14-day window.
  const days = d.stores[0]?.daily ?? [];
  const series = days.map((day, i) => ({
    label: day.label,
    value: d.stores.reduce((s, st) => s + (st.daily[i]?.revenue ?? 0), 0),
    secondary: d.stores.reduce((s, st) => s + (st.daily[i]?.orders ?? 0), 0),
  }));
  const revenue = series.reduce((s, x) => s + x.value, 0);
  const orders = series.reduce((s, x) => s + x.secondary, 0);
  const currency = d.stores[0]?.store.currency ?? "USD";
  return (
    <DashboardCard icon={TrendingUp} title="Sales · 14 days" action={<span className="text-[12px] text-muted-foreground">{orders} orders · {formatMoney(revenue, currency)}</span>} className="h-full">
      {revenue === 0 && orders === 0 ? (
        <p className="text-[13px] text-muted-foreground">Sync or import orders to see daily revenue here.</p>
      ) : (
        <BarChart data={series.map((x) => ({ label: x.label, value: x.value }))} height={140} format={(v) => formatMoney(v, currency)} />
      )}
    </DashboardCard>
  );
}

function TopProductsWidget({ d }: { d: WidgetData }) {
  const merged = new Map<string, { title: string; quantity: number; revenue: number }>();
  for (const st of d.stores) for (const p of st.topProducts) {
    const cur = merged.get(p.title) ?? { title: p.title, quantity: 0, revenue: 0 };
    merged.set(p.title, { title: p.title, quantity: cur.quantity + p.quantity, revenue: cur.revenue + p.revenue });
  }
  const top = [...merged.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  const max = Math.max(1, ...top.map((p) => p.quantity));
  return (
    <DashboardCard icon={Package} title="Top products · 14 days" className="h-full">
      {top.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Order history shows your best sellers here.</p>
      ) : (
        <div className="space-y-2.5">
          {top.map((p, idx) => (
            <RankBar key={p.title} label={p.title} value={p.quantity} max={max} index={idx} format={(v) => `${v} sold`} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function StoreSyncWidget({ d }: { d: WidgetData }) {
  return (
    <DashboardCard icon={RefreshCw} title="Sync health" className="h-full">
      {d.stores.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Connected stores report their last sync here.</p>
      ) : (
        <ul className="space-y-2">
          {d.stores.slice(0, 6).map(({ store, lastRun }) => {
            const ok = lastRun ? lastRun.ok !== false : store.lastSyncedAt !== null;
            const at = lastRun?.at ?? store.lastSyncedAt;
            return (
              <li key={store.id}>
                <Link href={routes.storeTab(store.id, "sync")} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{store.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{lastRun?.error ? lastRun.error : at ? `Synced ${formatRelativeTime(at)}` : store.connectionId ? "Never synced" : "Manual store · imports only"}</p>
                  </div>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", !at ? "bg-muted-foreground/40" : ok ? "bg-success" : "bg-danger")} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

/* --------------------------------------------------------------- stock */

function LowStockWidget({ d }: { d: WidgetData }) {
  const items = [
    ...(d.scope === "restaurants" ? [] : d.stores.flatMap((s) => s.lowStock.map((p) => ({ where: s.store.name, name: p.title, quantity: p.quantity, href: routes.storeTab(s.store.id, "products") })))),
    ...(d.scope === "commerce" ? [] : d.restaurantLowStock.map((r) => ({ where: r.restaurant, name: r.name, quantity: r.quantity, href: routes.restaurants }))),
  ].slice(0, 8);
  return (
    <DashboardCard icon={AlertTriangle} title="Low stock" className="h-full">
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing is running low.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i, idx) => (
            <li key={`${i.where}-${i.name}-${idx}`} className="flex items-center justify-between gap-3 text-[13px]">
              <Link href={i.href} className="min-w-0 truncate hover:text-accent">
                {i.name} <span className="text-muted-foreground">· {i.where}</span>
              </Link>
              <Badge variant={i.quantity <= 0 ? "danger" : "warning"}>{i.quantity} left</Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ------------------------------------------------------------ activity */

const MODULE_ICON: Record<string, React.ElementType> = { fleet: Car, restaurant: ChefHat, commerce: ShoppingBag, butler: Bot, system: Bell, team: Users };

function ActivityWidget({ d }: { d: WidgetData }) {
  const merged = [
    ...d.activity.filter((a) => inScope(d.scope, activityScope(a))).map((a) => ({ id: a.id, icon: MODULE_ICON[a.module] ?? Bell, text: a.description, at: a.occurredAt, href: a.href, ago: null as string | null })),
    ...(d.scope === "home" || d.scope === "fleet" ? d.data.activity.map((a) => ({ id: a.id, icon: MessageCircle, text: a.description, at: null as string | null, href: null as string | null, ago: a.timeAgo })) : []),
  ].slice(0, 10);
  return (
    <DashboardCard icon={Bell} title="Recent events" className="h-full">
      {merged.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing has happened yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {merged.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <e.icon className="h-3 w-3 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">{e.href ? <Link href={e.href} className="hover:text-accent">{e.text}</Link> : e.text}</p>
                <p className="text-[11px] text-muted-foreground">{e.ago ? e.ago : e.at ? formatRelativeTime(e.at) : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ----------------------------------------------------------- registry */

export function renderWidget(id: string, d: WidgetData): React.ReactNode {
  switch (id) {
    case "stats":
      return <StatsWidget d={d} />;
    case "businesses":
      return <BusinessesWidget d={d} />;
    case "tasks":
      return <TasksWidget d={d} />;
    case "notifications":
      return <NotificationsWidget d={d} />;
    case "briefing":
      return <AiBriefingCard initialEmail={d.initialEmail} />;
    case "activity":
      return <ActivityWidget d={d} />;
    case "board":
      return <BoardWidget d={d} />;
    case "messages":
      return <GuestMessagesCard initialMessages={d.guestMessages} />;
    case "fleet":
      return <FleetOverviewCard vehicles={d.data.vehicles} />;
    case "occupancy":
      return <OccupancyRateCard trend={d.data.occupancyTrend} />;
    case "priority":
      return <TaskPriorityCard suggestions={d.data.suggestions} />;
    case "pickups":
      return <ScheduleCard icon={LogOut} title="Today's pickups" entries={d.data.pickups} notReadyLabel="Needs prep" emptyMessage="No pickups dated today." />;
    case "returns":
      return <ScheduleCard icon={LogIn} title="Today's returns" entries={d.data.returns} notReadyLabel="Inspect first" emptyMessage="No returns dated today." />;
    case "timeline":
      return <VehicleOperationsTimeline days={d.data.operationsTimeline} />;
    case "unscheduled":
      return <FleetStatusGrid vehicles={d.data.unscheduledVehicles} title="Unscheduled vehicles" emptyMessage="Every vehicle has a pickup or return on the books." />;
    case "restaurants":
      return <RestaurantsWidget d={d} />;
    case "restaurantList":
      return <RestaurantList entries={d.restaurants} canEdit={d.canEdit} heading={false} />;
    case "orders":
      return <OrdersWidget d={d} />;
    case "menusync":
      return <MenuSyncWidget d={d} />;
    case "topitems":
      return <TopItemsWidget d={d} />;
    case "commerce":
      return <CommerceWidget d={d} />;
    case "storeList":
      return <StoreList entries={d.stores.map((s) => ({ store: s.store, products: s.products, orders14d: s.orders14d, revenue14d: s.revenue14d, lowStock: s.lowStockCount }))} canEdit={d.canEdit} heading={false} />;
    case "sales":
      return <SalesWidget d={d} />;
    case "topproducts":
      return <TopProductsWidget d={d} />;
    case "storesync":
      return <StoreSyncWidget d={d} />;
    case "lowstock":
      return <LowStockWidget d={d} />;
    default:
      return null;
  }
}

export const WidgetMotion = motion.div;
