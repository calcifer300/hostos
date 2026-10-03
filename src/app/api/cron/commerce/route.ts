import { NextRequest, NextResponse } from "next/server";
import { runQueryOr } from "@/lib/supabase/server";
import { syncShopifyStore } from "@/lib/commerce/sync";

/**
 * Hourly Shopify sync for every connected store (vercel.json). Bearer
 * CRON_SECRET, like the other crons; refuses to run without it.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set; refusing to run." }, { status: 503 });
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: stores } = await runQueryOr<{ id: string; host_id: string }[]>("commerce_stores.connected", [], (client) =>
    client.from("commerce_stores").select("id, host_id").not("connection_id", "is", null).limit(500).returns<{ id: string; host_id: string }[]>()
  );

  const results = [];
  for (const store of stores) {
    const r = await syncShopifyStore(store.host_id, store.id, "cron");
    results.push({ storeId: store.id, ok: r.ok, products: r.products, orders: r.orders, error: r.error ?? null });
  }
  return NextResponse.json({ ok: true, stores: results.length, results });
}
