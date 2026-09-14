import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getHostModules } from "@/lib/host/queries";
import { getRestaurants } from "@/lib/restaurants/queries";
import { getStores } from "@/lib/commerce/queries";
import { getPublicAppUrl } from "@/lib/site";
import { routes } from "@/lib/routes";

/**
 * What the Companion needs to know about the workspace it is paired to: the
 * modules it runs and the platform identities it should recognise, so a
 * content script on the DoorDash portal or Shopify admin can tell "this is
 * one of ours" from "this is someone else's tab".
 */
export async function GET(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  const [modules, restaurants, stores] = await Promise.all([getHostModules(host.id), getRestaurants(host.id), getStores(host.id)]);
  const base = getPublicAppUrl();

  return NextResponse.json({
    ok: true,
    workspace: { id: host.id, name: host.name, timezone: host.timezone, modules },
    restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, storeId: r.doordashStoreId, status: r.status, href: `${base}${routes.restaurant(r.id)}` })),
    stores: stores.map((s) => ({ id: s.id, name: s.name, domain: s.domain, connected: Boolean(s.connectionId), href: `${base}${routes.store(s.id)}` })),
    links: { app: `${base}${routes.app}`, restaurants: `${base}${routes.restaurants}`, commerce: `${base}${routes.commerce}` },
  });
}
