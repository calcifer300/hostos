import "server-only";
import { runMutation, runQuery } from "@/lib/supabase/server";
import { getConnectionSecret, markConnection } from "@/lib/integrations/queries";
import { ShopifyClient, type ShopifyOrder, type ShopifyProduct } from "@/lib/commerce/shopify";
import { finishSyncRun, getStore, startSyncRun } from "@/lib/commerce/queries";
import { notify } from "@/lib/notifications/queries";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";

/**
 * Pulls a Shopify store's products and orders into HostOS. Idempotent:
 * every row upserts on (store_id, external_id), so running it every hour
 * or twice in a row costs nothing but API calls.
 */

export interface SyncResult {
  ok: boolean;
  products: number;
  orders: number;
  error?: string;
}

function productRows(hostId: string, storeId: string, products: ShopifyProduct[]) {
  const now = new Date().toISOString();
  return products.map((p) => {
    const v = p.variants?.[0];
    const inventory = p.variants?.reduce<number | null>((sum, x) => (x.inventory_quantity === null || x.inventory_quantity === undefined ? sum : (sum ?? 0) + x.inventory_quantity), null) ?? null;
    return {
      host_id: hostId,
      store_id: storeId,
      external_id: String(p.id),
      title: p.title,
      sku: v?.sku || null,
      vendor: p.vendor || null,
      product_type: p.product_type || null,
      status: p.status || "unknown",
      price: v ? Number(v.price) : null,
      compare_at_price: v?.compare_at_price ? Number(v.compare_at_price) : null,
      inventory_quantity: inventory,
      image_url: p.image?.src ?? null,
      variant_count: p.variants?.length ?? null,
      raw: { updated_at: p.updated_at },
      synced_at: now,
    };
  });
}

function orderStatus(o: ShopifyOrder): string {
  if (o.cancelled_at) return "cancelled";
  if (o.closed_at) return "closed";
  return "open";
}

function orderRows(hostId: string, storeId: string, orders: ShopifyOrder[]) {
  const now = new Date().toISOString();
  return orders.map((o) => ({
    host_id: hostId,
    store_id: storeId,
    external_id: String(o.id),
    order_number: o.name ?? (o.order_number ? `#${o.order_number}` : null),
    status: orderStatus(o),
    financial_status: o.financial_status ?? null,
    fulfillment_status: o.fulfillment_status ?? null,
    customer_name: o.customer ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || null : null,
    customer_email: o.customer?.email ?? o.email ?? null,
    placed_at: o.created_at,
    fulfilled_at: o.fulfillments?.[0]?.created_at ?? null,
    cancelled_at: o.cancelled_at,
    currency: o.currency,
    subtotal: Number(o.subtotal_price),
    total: Number(o.total_price),
    shipping: o.total_shipping_price_set ? Number(o.total_shipping_price_set.shop_money.amount) : null,
    tax: Number(o.total_tax),
    discount: Number(o.total_discounts),
    item_count: o.line_items?.reduce((n, li) => n + (li.quantity || 0), 0) ?? null,
    line_items: (o.line_items ?? []).slice(0, 100).map((li) => ({ title: li.title, quantity: li.quantity, price: Number(li.price), sku: li.sku })),
    source: "api",
    raw: null,
    synced_at: now,
  }));
}

export async function syncShopifyStore(hostId: string, storeId: string, triggeredBy: string | null): Promise<SyncResult> {
  const store = await getStore(hostId, storeId);
  if (!store) return { ok: false, products: 0, orders: 0, error: "Store not found." };
  if (!store.connectionId || !store.domain) return { ok: false, products: 0, orders: 0, error: "This store has no Shopify connection yet." };

  const token = await getConnectionSecret(hostId, store.connectionId);
  if (!token) return { ok: false, products: 0, orders: 0, error: "The stored access token can't be read. Reconnect the store." };

  const runId = await startSyncRun(hostId, storeId, "full", triggeredBy);
  const client = new ShopifyClient(store.domain, token);
  let products = 0;
  let orders = 0;

  try {
    for await (const page of client.products()) {
      if (page.length === 0) continue;
      const result = await runMutation("commerce_products.upsert", (c) => c.from("commerce_products").upsert(productRows(hostId, storeId, page), { onConflict: "store_id,external_id" }));
      if (!result.ok) throw new Error(result.error);
      products += page.length;
    }

    // Incremental after the first full pull: only orders updated since the
    // last successful sync (with an hour of overlap for clock skew).
    const since = store.lastSyncedAt ? new Date(Date.parse(store.lastSyncedAt) - 3600_000).toISOString() : null;
    for await (const page of client.orders(since)) {
      if (page.length === 0) continue;
      const result = await runMutation("commerce_orders.upsert", (c) => c.from("commerce_orders").upsert(orderRows(hostId, storeId, page), { onConflict: "store_id,external_id" }));
      if (!result.ok) throw new Error(result.error);
      orders += page.length;
    }

    const now = new Date().toISOString();
    await runQuery("commerce_stores.synced", (c) => c.from("commerce_stores").update({ last_synced_at: now, status: "active" }).eq("id", storeId));
    await markConnection(hostId, store.connectionId, { status: "connected", lastError: null, lastSyncedAt: now });
    await finishSyncRun(runId, { ok: true, products, orders });
    await logActivity({ hostId, module: "commerce", event: "commerce.synced", description: `${store.name}: ${products} products and ${orders} orders synced from Shopify`, href: routes.store(storeId), actorEmail: triggeredBy });

    // Low stock, once per product per day.
    const { data: low } = await runQuery<{ title: string; inventory_quantity: number }[]>("commerce_products.low", (c) =>
      c.from("commerce_products").select("title, inventory_quantity").eq("store_id", storeId).eq("status", "active").lte("inventory_quantity", store.lowStockThreshold).order("inventory_quantity", { ascending: true }).limit(10).returns<{ title: string; inventory_quantity: number }[]>()
    ).then((o) => (o.ok ? { data: o.data ?? [] } : { data: [] }));
    if (low.length > 0) {
      await notify({
        hostId,
        kind: "store",
        severity: "warning",
        title: `${store.name}: ${low.length} product${low.length === 1 ? "" : "s"} low on stock`,
        body: low.slice(0, 4).map((p) => `${p.title} (${p.inventory_quantity})`).join(", "),
        href: routes.storeTab(storeId, "products"),
        dedupeKey: `commerce-lowstock:${storeId}:${now.slice(0, 10)}`,
      });
    }

    return { ok: true, products, orders };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishSyncRun(runId, { ok: false, products, orders, error: message.slice(0, 500) });
    await markConnection(hostId, store.connectionId, { status: /401|403|invalid api key|unauthorized/i.test(message) ? "error" : "connected", lastError: message.slice(0, 500) });
    return { ok: false, products, orders, error: message };
  }
}
