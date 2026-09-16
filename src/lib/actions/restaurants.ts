"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation, runQuery } from "@/lib/supabase/server";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { compareInventories, stripRawRows } from "@/lib/restaurants/compare";
import { normalizeOrderStatus, type ParsedOrder } from "@/lib/restaurants/parse";
import {
  getItemLinks,
  getRestaurant,
  getUploadWithRows,
  recordStatus,
} from "@/lib/restaurants/queries";
import type { ColumnMapping, RestaurantStatus, UploadSource } from "@/lib/restaurants/types";
import { MAX_ROWS } from "@/lib/restaurants/parse";
import { logActivity } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { createTask } from "@/lib/tasks/queries";
import { routes } from "@/lib/routes";

/**
 * Every write in the restaurant module. Same contract as the rest of the
 * app's actions: returns { ok, error? }, never throws to the client, and
 * checks canEditCurrentFleet() before touching anything — a hidden button
 * is a UI convenience; a server action is a public endpoint.
 */

export interface RestaurantActionResult {
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
const numOr = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const VALID_STATUS = new Set<RestaurantStatus>(["open", "closed", "paused", "deactivated", "unknown"]);

export interface RestaurantInput {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  posSystem?: string;
  doordashStoreId?: string;
  address?: string;
  timezone?: string;
  lowStockThreshold?: number;
  priceTolerance?: number;
  notes?: string;
}

function toRow(input: RestaurantInput) {
  return {
    name: str(input.name, 120),
    contact_name: str(input.contactName, 120) || null,
    email: str(input.email, 200).toLowerCase() || null,
    phone: str(input.phone, 40) || null,
    pos_system: str(input.posSystem, 60) || null,
    doordash_store_id: str(input.doordashStoreId, 80) || null,
    address: str(input.address, 300) || null,
    timezone: str(input.timezone, 60) || "America/Denver",
    low_stock_threshold: Math.max(0, Math.round(numOr(input.lowStockThreshold, 5))),
    price_tolerance: Math.max(0, numOr(input.priceTolerance, 0.01)),
    notes: str(input.notes, 4000) || null,
  };
}

export async function createRestaurant(input: RestaurantInput): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const row = toRow(input);
  if (!row.name) return { ok: false, error: "Give the restaurant a name." };

  const outcome = await runQuery<{ id: string } | null>("restaurants.insert", (client) =>
    client.from("restaurants").insert({ host_id: g.hostId, ...row }).select("id").maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) {
    return { ok: false, error: outcome.ok ? "Couldn't create the restaurant." : `Couldn't create the restaurant. ${outcome.failure.hint}` };
  }

  await logActivity({ hostId: g.hostId, module: "restaurant", event: "restaurant.created", description: `Added ${row.name}`, actorEmail: g.email, href: routes.restaurant(outcome.data.id) });
  revalidatePath(routes.restaurants);
  revalidatePath(routes.app, "layout");
  return { ok: true, id: outcome.data.id };
}

export async function updateRestaurant(id: string, input: RestaurantInput): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const row = toRow(input);
  if (!row.name) return { ok: false, error: "Give the restaurant a name." };

  const result = await runMutation("restaurants.update", (client) => client.from("restaurants").update(row).eq("host_id", g.hostId).eq("id", id));
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(routes.restaurant(id));
  revalidatePath(routes.restaurants);
  return { ok: true, id };
}

export async function deleteRestaurant(id: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const existing = await getRestaurant(g.hostId, id);
  if (!existing) return { ok: false, error: "That restaurant no longer exists." };

  // Cascades (migration 0018) remove uploads, comparisons, links, orders and messages.
  const result = await runMutation("restaurants.delete", (client) => client.from("restaurants").delete().eq("host_id", g.hostId).eq("id", id));
  if (!result.ok) return { ok: false, error: result.error };

  await logActivity({ hostId: g.hostId, module: "restaurant", event: "restaurant.deleted", description: `Removed ${existing.name}`, actorEmail: g.email });
  revalidatePath(routes.restaurants);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

export async function setRestaurantStatus(id: string, status: string, detail?: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!VALID_STATUS.has(status as RestaurantStatus)) return { ok: false, error: "Unknown status." };

  const restaurant = await getRestaurant(g.hostId, id);
  if (!restaurant) return { ok: false, error: "That restaurant no longer exists." };

  const { changed, previous } = await recordStatus(g.hostId, id, status as RestaurantStatus, "manual", detail ?? null);
  if (changed) {
    await logActivity({
      hostId: g.hostId,
      module: "restaurant",
      event: `store.${status}`,
      description: `${restaurant.name} marked ${status}${previous && previous !== "unknown" ? ` (was ${previous})` : ""}`,
      actorEmail: g.email,
      href: routes.restaurant(id),
    });
  }
  revalidatePath(routes.restaurant(id));
  revalidatePath(routes.restaurants);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- uploads */

export interface SaveUploadInput {
  restaurantId: string;
  source: UploadSource;
  fileName: string;
  headers: string[];
  mapping: ColumnMapping;
  rows: Record<string, string>[];
}

export async function saveMenuUpload(input: SaveUploadInput): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  if (input.source !== "pos" && input.source !== "doordash") return { ok: false, error: "Unknown upload source." };
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { ok: false, error: "That file had no rows." };
  if (input.rows.length > MAX_ROWS) return { ok: false, error: `Uploads are limited to ${MAX_ROWS.toLocaleString()} rows.` };
  if (!input.mapping?.name) return { ok: false, error: "Map the item-name column before saving." };

  const restaurant = await getRestaurant(g.hostId, input.restaurantId);
  if (!restaurant) return { ok: false, error: "That restaurant no longer exists." };

  const outcome = await runQuery<{ id: string } | null>("menu_uploads.insert", (client) =>
    client
      .from("menu_uploads")
      .insert({
        host_id: g.hostId,
        restaurant_id: input.restaurantId,
        source: input.source,
        file_name: str(input.fileName, 200) || "upload",
        headers: input.headers.slice(0, 200),
        mapping: input.mapping,
        rows: input.rows,
        row_count: input.rows.length,
        uploaded_by: g.email,
      })
      .select("id")
      .maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) return { ok: false, error: "Couldn't save the upload. The problem has been logged." };

  await logActivity({
    hostId: g.hostId,
    module: "restaurant",
    event: "menu.uploaded",
    description: `${restaurant.name}: ${input.source === "pos" ? "POS" : "DoorDash"} export uploaded (${input.rows.length} rows)`,
    actorEmail: g.email,
    href: routes.restaurant(input.restaurantId),
  });
  revalidatePath(routes.restaurant(input.restaurantId));
  return { ok: true, id: outcome.data.id };
}

/* ------------------------------------------------------------ comparison */

export async function runComparison(restaurantId: string, posUploadId: string, doordashUploadId: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const [restaurant, pos, dd, links] = await Promise.all([
    getRestaurant(g.hostId, restaurantId),
    getUploadWithRows(g.hostId, posUploadId),
    getUploadWithRows(g.hostId, doordashUploadId),
    getItemLinks(g.hostId, restaurantId),
  ]);
  if (!restaurant) return { ok: false, error: "That restaurant no longer exists." };
  if (!pos || pos.restaurantId !== restaurantId || pos.source !== "pos") return { ok: false, error: "Pick a POS upload for this restaurant." };
  if (!dd || dd.restaurantId !== restaurantId || dd.source !== "doordash") return { ok: false, error: "Pick a DoorDash upload for this restaurant." };

  const { summary, rows } = compareInventories(pos.rows, pos.mapping, dd.rows, dd.mapping, {
    priceTolerance: restaurant.priceTolerance,
    lowStockThreshold: restaurant.lowStockThreshold,
    manualLinks: links,
  });

  const outcome = await runQuery<{ id: string } | null>("menu_comparisons.insert", (client) =>
    client
      .from("menu_comparisons")
      .insert({
        host_id: g.hostId,
        restaurant_id: restaurantId,
        pos_upload_id: posUploadId,
        doordash_upload_id: doordashUploadId,
        summary,
        rows: stripRawRows(rows),
        created_by: g.email,
      })
      .select("id")
      .maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) return { ok: false, error: "Couldn't save the comparison. The problem has been logged." };

  const href = routes.restaurantTab(restaurantId, "menu");
  await logActivity({
    hostId: g.hostId,
    module: "restaurant",
    event: "menu.compared",
    description: `${restaurant.name}: ${summary.needsUpdate} need updates, ${summary.missingOnDoordash} missing on DoorDash`,
    actorEmail: g.email,
    href,
  });

  // Things worth a person's attention, once per comparison.
  if (summary.needsUpdate + summary.missingOnDoordash > 0) {
    await notify({
      hostId: g.hostId,
      kind: "restaurant",
      severity: summary.needsUpdate > 10 ? "warning" : "info",
      title: `${restaurant.name}: ${summary.needsUpdate + summary.missingOnDoordash} menu changes to push to DoorDash`,
      body: `${summary.needsUpdate} price/availability updates · ${summary.missingOnDoordash} items missing · ${summary.lowStock} low stock`,
      href,
      dedupeKey: `menu:${outcome.data.id}`,
    });
    await createTask({
      hostId: g.hostId,
      title: `Update ${restaurant.name}'s DoorDash menu`,
      description: `${summary.needsUpdate} items need a price or availability change and ${summary.missingOnDoordash} are missing on DoorDash. Export the action list from the comparison and apply it in the Merchant Portal.`,
      priority: summary.needsUpdate > 10 ? "high" : "medium",
      source: "automation",
      relatedKind: "restaurant",
      relatedId: restaurantId,
      href,
      dedupeKey: `menu-update:${restaurantId}`,
      createdBy: g.email,
    });
  }

  revalidatePath(routes.restaurant(restaurantId));
  revalidatePath(routes.restaurants);
  revalidatePath(routes.app);
  return { ok: true, id: outcome.data.id };
}

export async function linkItems(restaurantId: string, posKey: string, doordashKey: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const p = str(posKey, 200);
  const d = str(doordashKey, 200);
  if (!p || !d) return { ok: false, error: "Pick an item on each side." };

  const result = await runMutation("menu_item_links.upsert", (client) =>
    client
      .from("menu_item_links")
      .upsert({ host_id: g.hostId, restaurant_id: restaurantId, pos_key: p, doordash_key: d, created_by: g.email }, { onConflict: "restaurant_id,pos_key,doordash_key" })
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(routes.restaurant(restaurantId));
  return { ok: true };
}

export async function unlinkItems(restaurantId: string, linkId: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const result = await runMutation("menu_item_links.delete", (client) =>
    client.from("menu_item_links").delete().eq("host_id", g.hostId).eq("restaurant_id", restaurantId).eq("id", linkId)
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(routes.restaurant(restaurantId));
  return { ok: true };
}

/* ----------------------------------------------------------------- orders */

export async function importOrders(restaurantId: string, orders: ParsedOrder[], channel = "doordash"): Promise<RestaurantActionResult & { imported?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!Array.isArray(orders) || orders.length === 0) return { ok: false, error: "No orders to import." };
  if (orders.length > MAX_ROWS) return { ok: false, error: `Imports are limited to ${MAX_ROWS.toLocaleString()} orders.` };

  const restaurant = await getRestaurant(g.hostId, restaurantId);
  if (!restaurant) return { ok: false, error: "That restaurant no longer exists." };

  // One row per external id; a re-export of the same period upserts.
  const rows = Array.from(
    new Map(
      orders.map((o) => [
        o.externalId,
        {
          host_id: g.hostId,
          restaurant_id: restaurantId,
          external_id: str(o.externalId, 100) || `row-${Math.random().toString(36).slice(2, 8)}`,
          channel: str(channel, 30) || "doordash",
          status: normalizeOrderStatus(o.status),
          customer_name: o.customerName ? str(o.customerName, 120) : null,
          placed_at: o.placedAt,
          delivered_at: o.deliveredAt,
          subtotal: o.subtotal,
          total: o.total,
          tip: o.tip,
          commission: o.commission,
          item_count: o.itemCount,
          items: o.items.slice(0, 100),
          source: "import",
          raw: o.raw,
        },
      ])
    ).values()
  );

  // Batches keep each request under PostgREST's comfortable payload size.
  for (let i = 0; i < rows.length; i += 500) {
    const result = await runMutation("restaurant_orders.upsert", (client) =>
      client.from("restaurant_orders").upsert(rows.slice(i, i + 500), { onConflict: "restaurant_id,external_id" })
    );
    if (!result.ok) return { ok: false, error: result.error };
  }

  await logActivity({
    hostId: g.hostId,
    module: "restaurant",
    event: "orders.imported",
    description: `${restaurant.name}: ${rows.length} orders imported`,
    actorEmail: g.email,
    href: routes.restaurantTab(restaurantId, "orders"),
  });
  revalidatePath(routes.restaurant(restaurantId));
  revalidatePath(routes.restaurants);
  revalidatePath(routes.app);
  return { ok: true, imported: rows.length };
}

/* --------------------------------------------------------------- messages */

export async function logRestaurantMessage(input: {
  restaurantId: string;
  body: string;
  customerName?: string;
  orderExternalId?: string;
  fromStore: boolean;
  channel?: string;
}): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const body = str(input.body, 4000);
  if (!body) return { ok: false, error: "Write the message first." };

  const outcome = await runQuery<{ id: string } | null>("restaurant_messages.insert", (client) =>
    client
      .from("restaurant_messages")
      .insert({
        host_id: g.hostId,
        restaurant_id: input.restaurantId,
        channel: str(input.channel, 30) || "doordash",
        customer_name: str(input.customerName, 120) || null,
        order_external_id: str(input.orderExternalId, 100) || null,
        body,
        from_store: Boolean(input.fromStore),
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle<{ id: string }>()
  );
  if (!outcome.ok || !outcome.data) return { ok: false, error: "Couldn't save the message." };

  revalidatePath(routes.restaurant(input.restaurantId));
  return { ok: true, id: outcome.data.id };
}

/* -------------------------------------------------------------- inventory */

export async function upsertInventoryItem(input: {
  restaurantId: string;
  id?: string;
  sku?: string;
  name: string;
  category?: string;
  price?: number | null;
  quantity?: number | null;
  available?: boolean;
  lowStockThreshold?: number | null;
}): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 200);
  if (!name) return { ok: false, error: "Give the item a name." };

  const row = {
    host_id: g.hostId,
    restaurant_id: input.restaurantId,
    sku: str(input.sku, 60) || null,
    name,
    category: str(input.category, 80) || null,
    price: input.price === null || input.price === undefined ? null : numOr(input.price, 0),
    quantity: input.quantity === null || input.quantity === undefined ? null : Math.round(numOr(input.quantity, 0)),
    available: input.available ?? true,
    low_stock_threshold: input.lowStockThreshold === null || input.lowStockThreshold === undefined ? null : Math.round(numOr(input.lowStockThreshold, 5)),
    updated_by: g.email,
  };

  const result = input.id
    ? await runMutation("inventory_items.update", (client) => client.from("inventory_items").update(row).eq("host_id", g.hostId).eq("id", input.id!))
    : await runMutation("inventory_items.insert", (client) => client.from("inventory_items").insert(row));
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(routes.restaurant(input.restaurantId));
  return { ok: true };
}

export async function deleteInventoryItem(restaurantId: string, id: string): Promise<RestaurantActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const result = await runMutation("inventory_items.delete", (client) =>
    client.from("inventory_items").delete().eq("host_id", g.hostId).eq("restaurant_id", restaurantId).eq("id", id)
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(routes.restaurant(restaurantId));
  return { ok: true };
}
