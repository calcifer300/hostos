import "server-only";
import { cache } from "react";
import { runQuery, runQueryOr } from "@/lib/supabase/server";
import type {
  ColumnMapping,
  Comparison,
  ComparisonRow,
  ComparisonSummary,
  InventoryItem,
  ItemLink,
  MenuUpload,
  MenuUploadSummary,
  OrderStatus,
  Restaurant,
  RestaurantMessage,
  RestaurantOrder,
  RestaurantStatus,
  StatusEvent,
  UploadSource,
} from "@/lib/restaurants/types";

/**
 * Read side of the restaurant module (migration 0018). Every function is
 * host_id-scoped and total: an un-migrated or unreachable install renders
 * empty lists, never a broken page — the same contract every other
 * queries module in src/lib keeps.
 */

const STATUSES = new Set<string>(["open", "closed", "paused", "deactivated", "unknown"]);
const ORDER_STATUSES = new Set<string>(["placed", "confirmed", "preparing", "ready", "picked_up", "delivered", "cancelled", "unknown"]);

function asStatus(raw: string | null | undefined): RestaurantStatus {
  return (raw && STATUSES.has(raw) ? raw : "unknown") as RestaurantStatus;
}

/* ------------------------------------------------------------ restaurants */

interface RestaurantRow {
  id: string;
  host_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  pos_system: string | null;
  doordash_store_id: string | null;
  address: string | null;
  timezone: string | null;
  status: string | null;
  status_observed_at: string | null;
  low_stock_threshold: number | null;
  price_tolerance: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const RESTAURANT_COLUMNS =
  "id, host_id, name, contact_name, email, phone, pos_system, doordash_store_id, address, timezone, status, status_observed_at, low_stock_threshold, price_tolerance, notes, created_at, updated_at";

function rowToRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    hostId: row.host_id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    posSystem: row.pos_system,
    doordashStoreId: row.doordash_store_id,
    address: row.address,
    timezone: row.timezone ?? "America/Denver",
    status: asStatus(row.status),
    statusObservedAt: row.status_observed_at,
    lowStockThreshold: row.low_stock_threshold ?? 5,
    priceTolerance: Number(row.price_tolerance ?? 0.01),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getRestaurants = cache(async function getRestaurants(hostId: string): Promise<Restaurant[]> {
  const { data } = await runQueryOr<RestaurantRow[]>("restaurants.list", [], (client) =>
    client.from("restaurants").select(RESTAURANT_COLUMNS).eq("host_id", hostId).order("name", { ascending: true }).returns<RestaurantRow[]>()
  );
  return data.map(rowToRestaurant);
});

export const getRestaurant = cache(async function getRestaurant(hostId: string, id: string): Promise<Restaurant | null> {
  const { data } = await runQueryOr<RestaurantRow | null>("restaurants.get", null, (client) =>
    client.from("restaurants").select(RESTAURANT_COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<RestaurantRow>()
  );
  return data ? rowToRestaurant(data) : null;
});

/** Finds a restaurant by the store id the Companion read from the merchant portal. */
export async function getRestaurantByStoreId(hostId: string, storeId: string): Promise<Restaurant | null> {
  const { data } = await runQueryOr<RestaurantRow | null>("restaurants.by_store", null, (client) =>
    client.from("restaurants").select(RESTAURANT_COLUMNS).eq("host_id", hostId).eq("doordash_store_id", storeId).maybeSingle<RestaurantRow>()
  );
  return data ? rowToRestaurant(data) : null;
}

/* ---------------------------------------------------------------- uploads */

interface UploadRow {
  id: string;
  restaurant_id: string;
  source: string;
  file_name: string;
  headers: string[] | null;
  mapping: ColumnMapping | null;
  rows?: Record<string, string>[] | null;
  row_count: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

const UPLOAD_SUMMARY_COLUMNS = "id, restaurant_id, source, file_name, headers, mapping, row_count, uploaded_by, uploaded_at";

function rowToUploadSummary(row: UploadRow): MenuUploadSummary {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    source: (row.source === "doordash" ? "doordash" : "pos") as UploadSource,
    fileName: row.file_name,
    headers: row.headers ?? [],
    mapping: row.mapping ?? {},
    rowCount: row.row_count ?? 0,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

/** Upload history without the rows — the rows can be megabytes. */
export const getUploadSummaries = cache(async function getUploadSummaries(hostId: string, restaurantId: string): Promise<MenuUploadSummary[]> {
  const { data } = await runQueryOr<UploadRow[]>("menu_uploads.list", [], (client) =>
    client
      .from("menu_uploads")
      .select(UPLOAD_SUMMARY_COLUMNS)
      .eq("host_id", hostId)
      .eq("restaurant_id", restaurantId)
      .order("uploaded_at", { ascending: false })
      .limit(40)
      .returns<UploadRow[]>()
  );
  return data.map(rowToUploadSummary);
});

/** One upload with its rows — only fetched when a comparison actually runs. */
export async function getUploadWithRows(hostId: string, id: string): Promise<MenuUpload | null> {
  const { data } = await runQueryOr<UploadRow | null>("menu_uploads.get", null, (client) =>
    client.from("menu_uploads").select(`${UPLOAD_SUMMARY_COLUMNS}, rows`).eq("host_id", hostId).eq("id", id).maybeSingle<UploadRow>()
  );
  if (!data) return null;
  return { ...rowToUploadSummary(data), rows: data.rows ?? [] };
}

/* ------------------------------------------------------------ comparisons */

interface ComparisonRowDb {
  id: string;
  restaurant_id: string;
  pos_upload_id: string | null;
  doordash_upload_id: string | null;
  summary: ComparisonSummary | null;
  rows?: ComparisonRow[] | null;
  created_by: string | null;
  created_at: string;
}

const EMPTY_SUMMARY: ComparisonSummary = { total: 0, needsUpdate: 0, inSync: 0, missingOnDoordash: 0, unmatchedOnDoordash: 0, lowStock: 0 };

function rowToComparison(row: ComparisonRowDb): Comparison {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    posUploadId: row.pos_upload_id,
    doordashUploadId: row.doordash_upload_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    summary: { ...EMPTY_SUMMARY, ...(row.summary ?? {}) },
    rows: row.rows ?? [],
  };
}

export const getComparisonSummaries = cache(async function getComparisonSummaries(
  hostId: string,
  restaurantId: string
): Promise<Omit<Comparison, "rows">[]> {
  const { data } = await runQueryOr<ComparisonRowDb[]>("menu_comparisons.list", [], (client) =>
    client
      .from("menu_comparisons")
      .select("id, restaurant_id, pos_upload_id, doordash_upload_id, summary, created_by, created_at")
      .eq("host_id", hostId)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<ComparisonRowDb[]>()
  );
  return data.map((row) => {
    const c = rowToComparison(row);
    const { rows: _rows, ...rest } = c;
    void _rows;
    return rest;
  });
});

export const getComparison = cache(async function getComparison(hostId: string, id: string): Promise<Comparison | null> {
  const { data } = await runQueryOr<ComparisonRowDb | null>("menu_comparisons.get", null, (client) =>
    client
      .from("menu_comparisons")
      .select("id, restaurant_id, pos_upload_id, doordash_upload_id, summary, rows, created_by, created_at")
      .eq("host_id", hostId)
      .eq("id", id)
      .maybeSingle<ComparisonRowDb>()
  );
  return data ? rowToComparison(data) : null;
});

/** The newest comparison per restaurant, for the list page's badges. */
export const getLatestComparisonSummaries = cache(async function getLatestComparisonSummaries(
  hostId: string
): Promise<Map<string, { summary: ComparisonSummary; createdAt: string; id: string }>> {
  const { data } = await runQueryOr<ComparisonRowDb[]>("menu_comparisons.latest", [], (client) =>
    client
      .from("menu_comparisons")
      .select("id, restaurant_id, pos_upload_id, doordash_upload_id, summary, created_by, created_at")
      .eq("host_id", hostId)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<ComparisonRowDb[]>()
  );
  const out = new Map<string, { summary: ComparisonSummary; createdAt: string; id: string }>();
  for (const row of data) {
    if (!out.has(row.restaurant_id)) {
      out.set(row.restaurant_id, { id: row.id, summary: { ...EMPTY_SUMMARY, ...(row.summary ?? {}) }, createdAt: row.created_at });
    }
  }
  return out;
});

/* ------------------------------------------------------------------ links */

export const getItemLinks = cache(async function getItemLinks(hostId: string, restaurantId: string): Promise<ItemLink[]> {
  const { data } = await runQueryOr<{ id: string; restaurant_id: string; pos_key: string; doordash_key: string; created_at: string }[]>(
    "menu_item_links.list",
    [],
    (client) => client.from("menu_item_links").select("id, restaurant_id, pos_key, doordash_key, created_at").eq("host_id", hostId).eq("restaurant_id", restaurantId)
  );
  return data.map((r) => ({ id: r.id, restaurantId: r.restaurant_id, posKey: r.pos_key, doordashKey: r.doordash_key, createdAt: r.created_at }));
});

/* ----------------------------------------------------------------- orders */

interface OrderRow {
  id: string;
  restaurant_id: string;
  external_id: string;
  channel: string;
  status: string;
  customer_name: string | null;
  placed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  subtotal: number | null;
  total: number | null;
  tip: number | null;
  commission: number | null;
  item_count: number | null;
  items: { name: string; quantity: number; price?: number }[] | null;
  source: string;
}

const ORDER_COLUMNS =
  "id, restaurant_id, external_id, channel, status, customer_name, placed_at, ready_at, delivered_at, subtotal, total, tip, commission, item_count, items, source";

function rowToOrder(row: OrderRow): RestaurantOrder {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    externalId: row.external_id,
    channel: row.channel,
    status: (ORDER_STATUSES.has(row.status) ? row.status : "unknown") as OrderStatus,
    customerName: row.customer_name,
    placedAt: row.placed_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    subtotal: row.subtotal === null ? null : Number(row.subtotal),
    total: row.total === null ? null : Number(row.total),
    tip: row.tip === null ? null : Number(row.tip),
    commission: row.commission === null ? null : Number(row.commission),
    itemCount: row.item_count,
    items: row.items ?? [],
    source: row.source,
  };
}

export const getOrders = cache(async function getOrders(hostId: string, restaurantId: string | null, limit = 500): Promise<RestaurantOrder[]> {
  const { data } = await runQueryOr<OrderRow[]>("restaurant_orders.list", [], (client) => {
    let q = client.from("restaurant_orders").select(ORDER_COLUMNS).eq("host_id", hostId);
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    return q.order("placed_at", { ascending: false, nullsFirst: false }).limit(limit).returns<OrderRow[]>();
  });
  return data.map(rowToOrder);
});

/* --------------------------------------------------------------- messages */

interface MessageRow {
  id: string;
  restaurant_id: string;
  channel: string;
  customer_name: string | null;
  order_external_id: string | null;
  body: string;
  from_store: boolean;
  sent_at: string;
}

export const getRestaurantMessages = cache(async function getRestaurantMessages(
  hostId: string,
  restaurantId: string | null,
  limit = 200
): Promise<RestaurantMessage[]> {
  const { data } = await runQueryOr<MessageRow[]>("restaurant_messages.list", [], (client) => {
    let q = client.from("restaurant_messages").select("id, restaurant_id, channel, customer_name, order_external_id, body, from_store, sent_at").eq("host_id", hostId);
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    return q.order("sent_at", { ascending: false }).limit(limit).returns<MessageRow[]>();
  });
  return data.map((r) => ({
    id: r.id,
    restaurantId: r.restaurant_id,
    channel: r.channel,
    customerName: r.customer_name,
    orderExternalId: r.order_external_id,
    body: r.body,
    fromStore: r.from_store,
    sentAt: r.sent_at,
  }));
});

/* ---------------------------------------------------------- status events */

interface StatusRow {
  id: string;
  restaurant_id: string;
  status: string;
  source: string;
  detail: string | null;
  observed_at: string;
}

export const getStatusEvents = cache(async function getStatusEvents(hostId: string, restaurantId: string, limit = 60): Promise<StatusEvent[]> {
  const { data } = await runQueryOr<StatusRow[]>("restaurant_status_events.list", [], (client) =>
    client
      .from("restaurant_status_events")
      .select("id, restaurant_id, status, source, detail, observed_at")
      .eq("host_id", hostId)
      .eq("restaurant_id", restaurantId)
      .order("observed_at", { ascending: false })
      .limit(limit)
      .returns<StatusRow[]>()
  );
  return data.map((r) => ({ id: r.id, restaurantId: r.restaurant_id, status: asStatus(r.status), source: r.source, detail: r.detail, observedAt: r.observed_at }));
});

/**
 * Records an observed store state and, when it changed, stamps the
 * restaurant. Returns the previous status so the caller can decide whether
 * the change deserves a notification (open → paused during service does;
 * unknown → open on first sight does not).
 */
export async function recordStatus(
  hostId: string,
  restaurantId: string,
  status: RestaurantStatus,
  source: "companion" | "manual" | "import",
  detail?: string | null
): Promise<{ changed: boolean; previous: RestaurantStatus | null }> {
  const current = await getRestaurant(hostId, restaurantId);
  if (!current) return { changed: false, previous: null };

  const changed = current.status !== status;
  const observedAt = new Date().toISOString();

  await runQuery("restaurants.set_status", (client) =>
    client.from("restaurants").update({ status, status_observed_at: observedAt }).eq("host_id", hostId).eq("id", restaurantId)
  );

  if (changed) {
    await runQuery("restaurant_status_events.insert", (client) =>
      client.from("restaurant_status_events").insert({
        host_id: hostId,
        restaurant_id: restaurantId,
        status,
        source,
        detail: detail ?? null,
        observed_at: observedAt,
      })
    );
  }

  return { changed, previous: current.status };
}

/* -------------------------------------------------------------- inventory */

interface InventoryRow {
  id: string;
  restaurant_id: string;
  sku: string | null;
  name: string;
  category: string | null;
  price: number | null;
  quantity: number | null;
  available: boolean;
  low_stock_threshold: number | null;
  updated_at: string;
}

export const getInventory = cache(async function getInventory(hostId: string, restaurantId: string): Promise<InventoryItem[]> {
  const { data } = await runQueryOr<InventoryRow[]>("inventory_items.list", [], (client) =>
    client
      .from("inventory_items")
      .select("id, restaurant_id, sku, name, category, price, quantity, available, low_stock_threshold, updated_at")
      .eq("host_id", hostId)
      .eq("restaurant_id", restaurantId)
      .order("name", { ascending: true })
      .limit(1000)
      .returns<InventoryRow[]>()
  );
  return data.map((r) => ({
    id: r.id,
    restaurantId: r.restaurant_id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    price: r.price === null ? null : Number(r.price),
    quantity: r.quantity,
    available: r.available,
    lowStockThreshold: r.low_stock_threshold,
    updatedAt: r.updated_at,
  }));
});
