"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation, runQuery } from "@/lib/supabase/server";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { isEncryptionConfigured } from "@/lib/crypto";
import { deleteConnection, upsertConnection } from "@/lib/integrations/queries";
import { getStore } from "@/lib/commerce/queries";
import { ShopifyClient, looksLikeAccessToken, normalizeShopDomain } from "@/lib/commerce/shopify";
import { syncShopifyStore } from "@/lib/commerce/sync";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";
import { MAX_ROWS } from "@/lib/restaurants/parse";

export interface CommerceActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet. Reload and try again." };
  if (!(await canEditCurrentFleet())) return { error: "You have read-only access to this workspace." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Connects a Shopify store with a custom-app access token. The token is
 * verified against the Admin API (shop.json) BEFORE anything is stored, so a
 * typo never produces a "connected" store that fails on its first sync.
 */
export async function connectShopifyStore(input: { domain: string; accessToken: string; name?: string }): Promise<CommerceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  if (!isEncryptionConfigured()) {
    return { ok: false, error: "Credential encryption isn't configured on this deployment (set HOSTOS_ENCRYPTION_KEY)." };
  }

  const domain = normalizeShopDomain(input.domain);
  if (!domain) return { ok: false, error: "Enter the store's myshopify.com domain, e.g. my-shop.myshopify.com." };
  const token = input.accessToken.trim();
  if (!looksLikeAccessToken(token)) return { ok: false, error: "That doesn't look like an Admin API access token (they start with shpat_)." };

  let shop;
  try {
    shop = await new ShopifyClient(domain, token).shop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /401|403/.test(message) ? "Shopify rejected the token. Check the custom app's Admin API scopes (read_products, read_orders) and that the app is installed." : `Couldn't reach Shopify: ${message.slice(0, 160)}` };
  }

  const connection = await upsertConnection({
    hostId: g.hostId,
    provider: "shopify",
    externalId: domain,
    displayName: shop.name,
    secret: token,
    status: "connected",
    connectedBy: g.email,
    settings: { currency: shop.currency, timezone: shop.iana_timezone },
  });
  if (!connection) return { ok: false, error: "Couldn't save the connection. The problem has been logged." };

  const outcome = await runQuery<{ id: string } | null>("commerce_stores.upsert", (client) =>
    client
      .from("commerce_stores")
      .upsert(
        {
          host_id: g.hostId,
          provider: "shopify",
          name: str(input.name, 120) || shop.name,
          domain,
          external_id: domain,
          connection_id: connection.id,
          currency: shop.currency || "USD",
          timezone: shop.iana_timezone || "America/Denver",
          status: "active",
        },
        { onConflict: "host_id,provider,domain" }
      )
      .select("id")
      .maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) return { ok: false, error: "Connected to Shopify, but couldn't save the store. Run migration 0023 and try again." };

  await logActivity({ hostId: g.hostId, module: "commerce", event: "commerce.connected", description: `Connected Shopify store ${shop.name}`, actorEmail: g.email, href: routes.store(outcome.data.id) });

  // First sync inline so the store page has data the moment it opens.
  await syncShopifyStore(g.hostId, outcome.data.id, g.email);

  revalidatePath(routes.commerce);
  revalidatePath(routes.connectors);
  revalidatePath(routes.app, "layout");
  return { ok: true, id: outcome.data.id };
}

export async function syncStore(storeId: string): Promise<CommerceActionResult & { products?: number; orders?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const result = await syncShopifyStore(g.hostId, storeId, g.email);
  revalidatePath(routes.store(storeId));
  revalidatePath(routes.commerce);
  if (!result.ok) return { ok: false, error: result.error ?? "Sync failed." };
  return { ok: true, products: result.products, orders: result.orders };
}

export async function updateStore(storeId: string, input: { name: string; lowStockThreshold?: number; notes?: string; timezone?: string }): Promise<CommerceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: "Give the store a name." };

  const result = await runMutation("commerce_stores.update", (client) =>
    client
      .from("commerce_stores")
      .update({
        name,
        low_stock_threshold: Math.max(0, Math.round(Number(input.lowStockThreshold ?? 5) || 5)),
        notes: str(input.notes, 4000) || null,
        timezone: str(input.timezone, 60) || "America/Denver",
      })
      .eq("host_id", g.hostId)
      .eq("id", storeId)
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(routes.store(storeId));
  revalidatePath(routes.commerce);
  return { ok: true };
}

export async function disconnectStore(storeId: string): Promise<CommerceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const store = await getStore(g.hostId, storeId);
  if (!store) return { ok: false, error: "That store no longer exists." };

  const result = await runMutation("commerce_stores.delete", (client) => client.from("commerce_stores").delete().eq("host_id", g.hostId).eq("id", storeId));
  if (!result.ok) return { ok: false, error: result.error };
  if (store.connectionId) await deleteConnection(g.hostId, store.connectionId);

  await logActivity({ hostId: g.hostId, module: "commerce", event: "commerce.disconnected", description: `Removed store ${store.name}`, actorEmail: g.email });
  revalidatePath(routes.commerce);
  revalidatePath(routes.connectors);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

/* ------------------------------------------------------------ CSV import */

export interface ImportedProduct {
  externalId: string;
  title: string;
  sku: string | null;
  vendor: string | null;
  productType: string | null;
  status: string;
  price: number | null;
  inventoryQuantity: number | null;
}

export interface ImportedOrder {
  externalId: string;
  orderNumber: string | null;
  status: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  customerName: string | null;
  customerEmail: string | null;
  placedAt: string | null;
  total: number | null;
  subtotal: number | null;
  currency: string | null;
  lineItems: { title: string; quantity: number; price?: number; sku?: string | null }[];
}

/** Creates a store that is fed by CSV exports rather than the API. */
export async function createManualStore(input: { name: string; provider?: string; domain?: string }): Promise<CommerceActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 120);
  if (!name) return { ok: false, error: "Give the store a name." };
  const provider = ["shopify", "woocommerce", "square", "other"].includes(input.provider ?? "") ? input.provider! : "other";

  const outcome = await runQuery<{ id: string } | null>("commerce_stores.insert", (client) =>
    client.from("commerce_stores").insert({ host_id: g.hostId, provider, name, domain: str(input.domain, 200) || null, status: "unknown" }).select("id").maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) return { ok: false, error: "Couldn't create the store. Run migration 0023 and try again." };

  revalidatePath(routes.commerce);
  revalidatePath(routes.app, "layout");
  return { ok: true, id: outcome.data.id };
}

export async function importProducts(storeId: string, products: ImportedProduct[]): Promise<CommerceActionResult & { imported?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!Array.isArray(products) || products.length === 0) return { ok: false, error: "No products to import." };
  if (products.length > MAX_ROWS) return { ok: false, error: `Imports are limited to ${MAX_ROWS.toLocaleString()} rows.` };
  const store = await getStore(g.hostId, storeId);
  if (!store) return { ok: false, error: "That store no longer exists." };

  const now = new Date().toISOString();
  const rows = Array.from(new Map(products.map((p) => [p.externalId, p])).values()).map((p) => ({
    host_id: g.hostId,
    store_id: storeId,
    external_id: str(p.externalId, 120),
    title: str(p.title, 300) || "Untitled",
    sku: str(p.sku, 80) || null,
    vendor: str(p.vendor, 120) || null,
    product_type: str(p.productType, 120) || null,
    status: str(p.status, 30) || "unknown",
    price: p.price,
    inventory_quantity: p.inventoryQuantity,
    synced_at: now,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const result = await runMutation("commerce_products.import", (client) => client.from("commerce_products").upsert(rows.slice(i, i + 500), { onConflict: "store_id,external_id" }));
    if (!result.ok) return { ok: false, error: result.error };
  }
  await runQuery("commerce_stores.imported", (c) => c.from("commerce_stores").update({ last_synced_at: now }).eq("id", storeId));
  await logActivity({ hostId: g.hostId, module: "commerce", event: "commerce.imported", description: `${store.name}: ${rows.length} products imported`, actorEmail: g.email, href: routes.storeTab(storeId, "products") });
  revalidatePath(routes.store(storeId));
  return { ok: true, imported: rows.length };
}

export async function importCommerceOrders(storeId: string, orders: ImportedOrder[]): Promise<CommerceActionResult & { imported?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!Array.isArray(orders) || orders.length === 0) return { ok: false, error: "No orders to import." };
  if (orders.length > MAX_ROWS) return { ok: false, error: `Imports are limited to ${MAX_ROWS.toLocaleString()} rows.` };
  const store = await getStore(g.hostId, storeId);
  if (!store) return { ok: false, error: "That store no longer exists." };

  const now = new Date().toISOString();
  const rows = Array.from(new Map(orders.map((o) => [o.externalId, o])).values()).map((o) => ({
    host_id: g.hostId,
    store_id: storeId,
    external_id: str(o.externalId, 120),
    order_number: str(o.orderNumber, 40) || null,
    status: str(o.status, 30) || "unknown",
    financial_status: str(o.financialStatus, 40) || null,
    fulfillment_status: str(o.fulfillmentStatus, 40) || null,
    customer_name: str(o.customerName, 120) || null,
    customer_email: str(o.customerEmail, 200) || null,
    placed_at: o.placedAt,
    currency: str(o.currency, 8) || store.currency,
    subtotal: o.subtotal,
    total: o.total,
    item_count: o.lineItems.reduce((n, li) => n + (li.quantity || 0), 0) || null,
    line_items: o.lineItems.slice(0, 100),
    source: "import",
    synced_at: now,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const result = await runMutation("commerce_orders.import", (client) => client.from("commerce_orders").upsert(rows.slice(i, i + 500), { onConflict: "store_id,external_id" }));
    if (!result.ok) return { ok: false, error: result.error };
  }
  await logActivity({ hostId: g.hostId, module: "commerce", event: "commerce.orders_imported", description: `${store.name}: ${rows.length} orders imported`, actorEmail: g.email, href: routes.storeTab(storeId, "orders") });
  revalidatePath(routes.store(storeId));
  return { ok: true, imported: rows.length };
}
