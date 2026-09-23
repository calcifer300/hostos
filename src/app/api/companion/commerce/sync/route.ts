import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getStores } from "@/lib/commerce/queries";
import { syncShopifyStore } from "@/lib/commerce/sync";
import { normalizeShopDomain } from "@/lib/commerce/shopify";

/**
 * "Sync now" from the Companion's badge on a Shopify admin page. Finds the
 * workspace's store by domain and runs the same sync the cron runs.
 */
export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  let payload: { domain?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const domain = normalizeShopDomain(payload.domain ?? "");
  if (!domain) return NextResponse.json({ error: "domain is required." }, { status: 400 });

  const store = (await getStores(host.id)).find((s) => s.domain === domain);
  if (!store) return NextResponse.json({ ok: false, known: false, hint: "Connect this store in HostOS → Commerce first." }, { status: 404 });
  if (!store.connectionId) return NextResponse.json({ ok: false, known: true, hint: "This store is fed by CSV exports; connect it with an access token to sync." }, { status: 409 });

  const result = await syncShopifyStore(host.id, store.id, "companion");
  return NextResponse.json({ ok: result.ok, known: true, storeId: store.id, name: store.name, products: result.products, orders: result.orders, error: result.error ?? null });
}
