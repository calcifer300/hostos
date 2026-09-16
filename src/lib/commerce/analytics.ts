import type { CommerceOrder, CommerceProduct } from "@/lib/commerce/queries";
import type { ParsedFile } from "@/lib/restaurants/parse";
import type { ImportedOrder, ImportedProduct } from "@/lib/actions/commerce";

/**
 * Pure analytics and export parsers for the commerce module. Safe on the
 * client (the import previews run in the browser).
 */

export interface StoreAnalytics {
  orders14d: number;
  revenue14d: number;
  averageOrderValue: number | null;
  unfulfilled: number;
  refundedOrCancelled: number;
  ordersChangePct: number | null;
  revenueChangePct: number | null;
  daily: { day: string; label: string; orders: number; revenue: number }[];
  topProducts: { title: string; quantity: number; revenue: number }[];
  lowStock: CommerceProduct[];
  outOfStock: number;
  activeProducts: number;
  inventoryValue: number;
}

function dayKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeStoreAnalytics(orders: CommerceOrder[], products: CommerceProduct[], timezone: string, lowStockThreshold: number, now = new Date()): StoreAnalytics {
  const DAY = 86_400_000;
  const start = now.getTime() - 14 * DAY;
  const prevStart = now.getTime() - 28 * DAY;
  const dated = orders.filter((o) => o.placedAt && Number.isFinite(Date.parse(o.placedAt)));
  const live = (list: CommerceOrder[]) => list.filter((o) => o.status !== "cancelled" && o.financialStatus !== "refunded" && o.financialStatus !== "voided");
  const inWindow = dated.filter((o) => Date.parse(o.placedAt!) >= start);
  const previous = dated.filter((o) => {
    const t = Date.parse(o.placedAt!);
    return t >= prevStart && t < start;
  });
  const revenueOf = (list: CommerceOrder[]) => live(list).reduce((s, o) => s + (o.total ?? o.subtotal ?? 0), 0);
  const revenue14d = revenueOf(inWindow);

  const daily = new Map<string, { day: string; label: string; orders: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY).toISOString(), timezone);
    const [y, m, d] = key.split("-").map(Number);
    daily.set(key, { day: key, label: new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), orders: 0, revenue: 0 });
  }
  for (const o of inWindow) {
    const p = daily.get(dayKey(o.placedAt!, timezone));
    if (!p) continue;
    p.orders += 1;
    if (o.status !== "cancelled") p.revenue += o.total ?? o.subtotal ?? 0;
  }

  const productTotals = new Map<string, { quantity: number; revenue: number }>();
  for (const o of live(inWindow)) {
    for (const li of o.lineItems) {
      const cur = productTotals.get(li.title) ?? { quantity: 0, revenue: 0 };
      cur.quantity += li.quantity || 0;
      cur.revenue += (li.price ?? 0) * (li.quantity || 0);
      productTotals.set(li.title, cur);
    }
  }
  const topProducts = Array.from(productTotals.entries())
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const active = products.filter((p) => p.status === "active" || p.status === "unknown");
  const lowStock = active.filter((p) => p.inventoryQuantity !== null && p.inventoryQuantity <= lowStockThreshold).sort((a, b) => (a.inventoryQuantity ?? 0) - (b.inventoryQuantity ?? 0));

  return {
    orders14d: inWindow.length,
    revenue14d,
    averageOrderValue: live(inWindow).length ? revenue14d / live(inWindow).length : null,
    unfulfilled: orders.filter((o) => o.status === "open" && (!o.fulfillmentStatus || o.fulfillmentStatus === "unfulfilled" || o.fulfillmentStatus === "partial")).length,
    refundedOrCancelled: inWindow.filter((o) => o.status === "cancelled" || o.financialStatus === "refunded").length,
    ordersChangePct: pct(inWindow.length, previous.length),
    revenueChangePct: pct(revenue14d, revenueOf(previous)),
    daily: Array.from(daily.values()),
    topProducts,
    lowStock,
    outOfStock: active.filter((p) => p.inventoryQuantity !== null && p.inventoryQuantity <= 0).length,
    activeProducts: active.length,
    inventoryValue: active.reduce((s, p) => s + (p.price ?? 0) * Math.max(0, p.inventoryQuantity ?? 0), 0),
  };
}

/* ------------------------------------------------------------- CSV parsers */

function col(headers: string[], hints: string[]): string | undefined {
  let best: string | undefined;
  let score = 0;
  for (const h of headers) {
    const l = h.toLowerCase().trim();
    for (const hint of hints) {
      const s = l === hint ? 3 : l.includes(hint) ? 2 : 0;
      if (s > score) {
        score = s;
        best = h;
      }
    }
  }
  return best;
}

const money = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Shopify's Products export (Handle, Title, Variant SKU, Variant Price, Variant Inventory Qty, Status…) and similar. */
export function parseProductExport(parsed: ParsedFile): ImportedProduct[] {
  const h = parsed.headers;
  const c = {
    handle: col(h, ["handle", "product id", "id"]),
    title: col(h, ["title", "product title", "name", "product name"]),
    sku: col(h, ["variant sku", "sku"]),
    vendor: col(h, ["vendor", "brand"]),
    type: col(h, ["type", "product type", "product category", "category"]),
    status: col(h, ["status", "published"]),
    price: col(h, ["variant price", "price"]),
    qty: col(h, ["variant inventory qty", "inventory quantity", "inventory", "quantity", "stock"]),
  };
  const out = new Map<string, ImportedProduct>();
  parsed.rows.forEach((row, i) => {
    const handle = (c.handle ? row[c.handle] : "")?.trim();
    const title = (c.title ? row[c.title] : "")?.trim();
    // Shopify repeats the handle per variant with a blank title; fold variants into one product.
    const key = handle || title || `row-${i}`;
    const existing = out.get(key);
    const qty = c.qty ? money(row[c.qty]) : null;
    if (existing) {
      if (qty !== null) existing.inventoryQuantity = (existing.inventoryQuantity ?? 0) + qty;
      return;
    }
    if (!title && !handle) return;
    const statusRaw = (c.status ? row[c.status] : "")?.trim().toLowerCase();
    out.set(key, {
      externalId: key,
      title: title || handle,
      sku: (c.sku ? row[c.sku] : "")?.trim() || null,
      vendor: (c.vendor ? row[c.vendor] : "")?.trim() || null,
      productType: (c.type ? row[c.type] : "")?.trim() || null,
      status: statusRaw === "true" || statusRaw === "active" ? "active" : statusRaw === "draft" ? "draft" : statusRaw === "archived" ? "archived" : statusRaw === "false" ? "draft" : "unknown",
      price: c.price ? money(row[c.price]) : null,
      inventoryQuantity: qty,
    });
  });
  return Array.from(out.values());
}

/** Shopify's Orders export (Name, Email, Financial Status, Fulfillment Status, Created at, Total, Lineitem name, Lineitem quantity…). */
export function parseOrderExport(parsed: ParsedFile): ImportedOrder[] {
  const h = parsed.headers;
  const c = {
    name: col(h, ["name", "order", "order name", "order number", "order id"]),
    id: col(h, ["id", "order id"]),
    email: col(h, ["email", "customer email"]),
    financial: col(h, ["financial status", "payment status"]),
    fulfillment: col(h, ["fulfillment status"]),
    created: col(h, ["created at", "date", "order date", "placed at"]),
    total: col(h, ["total", "order total"]),
    subtotal: col(h, ["subtotal"]),
    currency: col(h, ["currency"]),
    customer: col(h, ["billing name", "customer name", "shipping name", "customer"]),
    liName: col(h, ["lineitem name", "line item name", "item name", "product"]),
    liQty: col(h, ["lineitem quantity", "line item quantity", "quantity"]),
    liPrice: col(h, ["lineitem price", "line item price"]),
    liSku: col(h, ["lineitem sku", "line item sku"]),
    cancelled: col(h, ["cancelled at", "canceled at"]),
  };
  const out = new Map<string, ImportedOrder>();
  parsed.rows.forEach((row, i) => {
    const name = (c.name ? row[c.name] : "")?.trim();
    const id = (c.id ? row[c.id] : "")?.trim();
    const key = id || name || `row-${i}`;
    const li = c.liName && row[c.liName]?.trim() ? { title: row[c.liName].trim(), quantity: Number(c.liQty ? row[c.liQty] : 1) || 1, price: c.liPrice ? money(row[c.liPrice]) ?? undefined : undefined, sku: c.liSku ? row[c.liSku]?.trim() || null : null } : null;
    const existing = out.get(key);
    if (existing) {
      if (li) existing.lineItems.push(li);
      return;
    }
    const createdRaw = c.created ? row[c.created] : "";
    const placedMs = createdRaw ? Date.parse(createdRaw) : NaN;
    const cancelled = c.cancelled ? row[c.cancelled]?.trim() : "";
    const financial = (c.financial ? row[c.financial] : "")?.trim().toLowerCase() || null;
    out.set(key, {
      externalId: key,
      orderNumber: name || null,
      status: cancelled ? "cancelled" : financial === "refunded" ? "closed" : "open",
      financialStatus: financial,
      fulfillmentStatus: (c.fulfillment ? row[c.fulfillment] : "")?.trim().toLowerCase() || null,
      customerName: (c.customer ? row[c.customer] : "")?.trim() || null,
      customerEmail: (c.email ? row[c.email] : "")?.trim().toLowerCase() || null,
      placedAt: Number.isFinite(placedMs) ? new Date(placedMs).toISOString() : null,
      total: c.total ? money(row[c.total]) : null,
      subtotal: c.subtotal ? money(row[c.subtotal]) : null,
      currency: (c.currency ? row[c.currency] : "")?.trim() || null,
      lineItems: li ? [li] : [],
    });
  });
  return Array.from(out.values());
}
