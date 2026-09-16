import type { RestaurantOrder } from "@/lib/restaurants/types";

/**
 * Delivery analytics computed on read from restaurant_orders. Pure, so the
 * dashboard widget, the restaurant page and the Butler's briefing all get
 * the same numbers from the same function.
 */

export interface DayPoint {
  /** YYYY-MM-DD in the fleet/store timezone. */
  day: string;
  label: string;
  orders: number;
  revenue: number;
}

export interface OrderAnalytics {
  totalOrders: number;
  revenue: number;
  averageOrderValue: number | null;
  cancelledRate: number | null;
  /** Median minutes from placed to delivered, when both timestamps exist. */
  medianFulfilmentMinutes: number | null;
  /** Last 14 days, oldest first. */
  daily: DayPoint[];
  /** Compared with the previous 14 days. Null when there's nothing to compare against. */
  revenueChangePct: number | null;
  ordersChangePct: number | null;
  byStatus: Record<string, number>;
  topItems: { name: string; quantity: number }[];
  byHour: number[];
}

function dayKey(iso: string, timezone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function hourOf(iso: string, timezone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date(iso));
  return Number(h) % 24;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeOrderAnalytics(orders: RestaurantOrder[], timezone: string, now = new Date()): OrderAnalytics {
  const DAY = 86_400_000;
  const windowStart = now.getTime() - 14 * DAY;
  const previousStart = now.getTime() - 28 * DAY;

  const dated = orders.filter((o) => o.placedAt && Number.isFinite(Date.parse(o.placedAt)));
  const inWindow = dated.filter((o) => Date.parse(o.placedAt!) >= windowStart);
  const previous = dated.filter((o) => {
    const t = Date.parse(o.placedAt!);
    return t >= previousStart && t < windowStart;
  });

  const revenueOf = (list: RestaurantOrder[]) =>
    list.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + (o.total ?? o.subtotal ?? 0), 0);

  const revenue = revenueOf(inWindow);
  const live = inWindow.filter((o) => o.status !== "cancelled");
  const cancelled = inWindow.filter((o) => o.status === "cancelled").length;

  const dailyMap = new Map<string, DayPoint>();
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY).toISOString(), timezone);
    dailyMap.set(key, { day: key, label: dayLabel(key), orders: 0, revenue: 0 });
  }
  const byHour = new Array<number>(24).fill(0);
  for (const o of inWindow) {
    const key = dayKey(o.placedAt!, timezone);
    const point = dailyMap.get(key);
    if (point) {
      point.orders += 1;
      if (o.status !== "cancelled") point.revenue += o.total ?? o.subtotal ?? 0;
    }
    byHour[hourOf(o.placedAt!, timezone)] += 1;
  }

  const fulfilment = inWindow
    .filter((o) => o.placedAt && o.deliveredAt)
    .map((o) => (Date.parse(o.deliveredAt!) - Date.parse(o.placedAt!)) / 60_000)
    .filter((m) => m > 0 && m < 24 * 60);

  const byStatus: Record<string, number> = {};
  for (const o of inWindow) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

  const itemTotals = new Map<string, number>();
  for (const o of live) for (const it of o.items) itemTotals.set(it.name, (itemTotals.get(it.name) ?? 0) + (it.quantity || 1));
  const topItems = Array.from(itemTotals.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  return {
    totalOrders: inWindow.length,
    revenue,
    averageOrderValue: live.length ? revenue / live.length : null,
    cancelledRate: inWindow.length ? cancelled / inWindow.length : null,
    medianFulfilmentMinutes: median(fulfilment),
    daily: Array.from(dailyMap.values()),
    revenueChangePct: pctChange(revenue, revenueOf(previous)),
    ordersChangePct: pctChange(inWindow.length, previous.length),
    byStatus,
    topItems,
    byHour,
  };
}

export function formatMoney(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}
