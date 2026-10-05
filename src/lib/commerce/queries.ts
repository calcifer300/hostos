import "server-only";
import { cache } from "react";
import { runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Read side of the commerce module (migration 0023). host_id-scoped, total,
 * never throws — an un-migrated or unreachable install renders empty.
 */

export type StoreProvider = "shopify" | "woocommerce" | "square" | "other";
export type StoreStatus = "active" | "paused" | "unknown";

export interface CommerceStore {
  id: string;
  hostId: string;
  provider: StoreProvider;
  name: string;
  domain: string | null;
  externalId: string | null;
  connectionId: string | null;
  currency: string;
  timezone: string;
  status: StoreStatus;
  lowStockThreshold: number;
  notes: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceProduct {
  id: string;
  storeId: string;
  externalId: string;
  title: string;
  sku: string | null;
  vendor: string | null;
  productType: string | null;
  status: string;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
  imageUrl: string | null;
  variantCount: number | null;
  syncedAt: string;
}

export interface CommerceOrder {
  id: string;
  storeId: string;
  externalId: string;
  orderNumber: string | null;
  status: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  customerName: string | null;
  customerEmail: string | null;
  placedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  currency: string | null;
  subtotal: number | null;
  total: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  itemCount: number | null;
  lineItems: { title: string; quantity: number; price?: number; sku?: string | null }[];
  source: string;
}

export interface SyncRun {
  id: string;
  kind: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  productsSynced: number;
  ordersSynced: number;
  error: string | null;
  triggeredBy: string | null;
}

/* ------------------------------------------------------------------ stores */

interface StoreRow {
  id: string;
  host_id: string;
  provider: string;
  name: string;
  domain: string | null;
  external_id: string | null;
  connection_id: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
  low_stock_threshold: number | null;
  notes: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

const STORE_COLUMNS = "id, host_id, provider, name, domain, external_id, connection_id, currency, timezone, status, low_stock_threshold, notes, last_synced_at, created_at, updated_at";
const PROVIDERS = new Set<string>(["shopify", "woocommerce", "square", "other"]);
const STORE_STATUSES = new Set<string>(["active", "paused", "unknown"]);

function rowToStore(row: StoreRow): CommerceStore {
  return {
    id: row.id,
    hostId: row.host_id,
    provider: (PROVIDERS.has(row.provider) ? row.provider : "other") as StoreProvider,
    name: row.name,
    domain: row.domain,
    externalId: row.external_id,
    connectionId: row.connection_id,
    currency: row.currency ?? "USD",
    timezone: row.timezone ?? "America/Denver",
    status: (row.status && STORE_STATUSES.has(row.status) ? row.status : "unknown") as StoreStatus,
    lowStockThreshold: row.low_stock_threshold ?? 5,
    notes: row.notes,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getStores = cache(async function getStores(hostId: string): Promise<CommerceStore[]> {
  const { data } = await runQueryOr<StoreRow[]>("commerce_stores.list", [], (client) =>
    client.from("commerce_stores").select(STORE_COLUMNS).eq("host_id", hostId).order("name", { ascending: true }).returns<StoreRow[]>()
  );
  return data.map(rowToStore);
});

export const getStore = cache(async function getStore(hostId: string, id: string): Promise<CommerceStore | null> {
  const { data } = await runQueryOr<StoreRow | null>("commerce_stores.get", null, (client) =>
    client.from("commerce_stores").select(STORE_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<StoreRow>()
  );
  return data ? rowToStore(data) : null;
});

/* ---------------------------------------------------------------- products */

interface ProductRow {
  id: string;
  store_id: string;
  external_id: string;
  title: string;
  sku: string | null;
  vendor: string | null;
  product_type: string | null;
  status: string;
  price: number | null;
  compare_at_price: number | null;
  inventory_quantity: number | null;
  image_url: string | null;
  variant_count: number | null;
  synced_at: string;
}

const PRODUCT_COLUMNS = "id, store_id, external_id, title, sku, vendor, product_type, status, price, compare_at_price, inventory_quantity, image_url, variant_count, synced_at";

export const getProducts = cache(async function getProducts(hostId: string, storeId: string, limit = 2000): Promise<CommerceProduct[]> {
  const { data } = await runQueryOr<ProductRow[]>("commerce_products.list", [], (client) =>
    client.from("commerce_products").select(PRODUCT_COLUMNS).eq("host_id", hostId).eq("store_id", storeId).order("title", { ascending: true }).limit(limit).returns<ProductRow[]>()
  );
  return data.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    externalId: r.external_id,
    title: r.title,
    sku: r.sku,
    vendor: r.vendor,
    productType: r.product_type,
    status: r.status,
    price: r.price === null ? null : Number(r.price),
    compareAtPrice: r.compare_at_price === null ? null : Number(r.compare_at_price),
    inventoryQuantity: r.inventory_quantity,
    imageUrl: r.image_url,
    variantCount: r.variant_count,
    syncedAt: r.synced_at,
  }));
});

/** Product counts per store, for the list page, without loading products. */
export const getProductCounts = cache(async function getProductCounts(hostId: string): Promise<Map<string, number>> {
  const { data } = await runQueryOr<{ store_id: string }[]>("commerce_products.counts", [], (client) =>
    client.from("commerce_products").select("store_id").eq("host_id", hostId).limit(10000).returns<{ store_id: string }[]>()
  );
  const out = new Map<string, number>();
  for (const r of data) out.set(r.store_id, (out.get(r.store_id) ?? 0) + 1);
  return out;
});

/* ------------------------------------------------------------------ orders */

interface OrderRow {
  id: string;
  store_id: string;
  external_id: string;
  order_number: string | null;
  status: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  placed_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  currency: string | null;
  subtotal: number | null;
  total: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  item_count: number | null;
  line_items: CommerceOrder["lineItems"] | null;
  source: string;
}

const ORDER_COLUMNS =
  "id, store_id, external_id, order_number, status, financial_status, fulfillment_status, customer_name, customer_email, placed_at, fulfilled_at, cancelled_at, currency, subtotal, total, shipping, tax, discount, item_count, line_items, source";

const num = (v: number | null) => (v === null ? null : Number(v));

export const getCommerceOrders = cache(async function getCommerceOrders(hostId: string, storeId: string | null, limit = 1000): Promise<CommerceOrder[]> {
  const { data } = await runQueryOr<OrderRow[]>("commerce_orders.list", [], (client) => {
    let q = client.from("commerce_orders").select(ORDER_COLUMNS).eq("host_id", hostId);
    if (storeId) q = q.eq("store_id", storeId);
    return q.order("placed_at", { ascending: false, nullsFirst: false }).limit(limit).returns<OrderRow[]>();
  });
  return data.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    externalId: r.external_id,
    orderNumber: r.order_number,
    status: r.status,
    financialStatus: r.financial_status,
    fulfillmentStatus: r.fulfillment_status,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    placedAt: r.placed_at,
    fulfilledAt: r.fulfilled_at,
    cancelledAt: r.cancelled_at,
    currency: r.currency,
    subtotal: num(r.subtotal),
    total: num(r.total),
    shipping: num(r.shipping),
    tax: num(r.tax),
    discount: num(r.discount),
    itemCount: r.item_count,
    lineItems: r.line_items ?? [],
    source: r.source,
  }));
});

/* --------------------------------------------------------------- sync runs */

export const getSyncRuns = cache(async function getSyncRuns(hostId: string, storeId: string, limit = 20): Promise<SyncRun[]> {
  const { data } = await runQueryOr<{ id: string; kind: string; started_at: string; finished_at: string | null; ok: boolean | null; products_synced: number; orders_synced: number; error: string | null; triggered_by: string | null }[]>(
    "commerce_sync_runs.list",
    [],
    (client) =>
      client
        .from("commerce_sync_runs")
        .select("id, kind, started_at, finished_at, ok, products_synced, orders_synced, error, triggered_by")
        .eq("host_id", hostId)
        .eq("store_id", storeId)
        .order("started_at", { ascending: false })
        .limit(limit)
  );
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    ok: r.ok,
    productsSynced: r.products_synced,
    ordersSynced: r.orders_synced,
    error: r.error,
    triggeredBy: r.triggered_by,
  }));
});

export async function startSyncRun(hostId: string, storeId: string, kind: string, triggeredBy: string | null): Promise<string | null> {
  const outcome = await runQuery<{ id: string } | null>("commerce_sync_runs.start", (client) =>
    client.from("commerce_sync_runs").insert({ host_id: hostId, store_id: storeId, kind, triggered_by: triggeredBy }).select("id").maybeSingle<{ id: string }>()
  );
  return outcome.ok ? outcome.data?.id ?? null : null;
}

export async function finishSyncRun(id: string | null, result: { ok: boolean; products: number; orders: number; error?: string | null }): Promise<void> {
  if (!id) return;
  await runQuery("commerce_sync_runs.finish", (client) =>
    client
      .from("commerce_sync_runs")
      .update({ finished_at: new Date().toISOString(), ok: result.ok, products_synced: result.products, orders_synced: result.orders, error: result.error ?? null })
      .eq("id", id)
  );
}
