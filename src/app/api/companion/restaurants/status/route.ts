import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getRestaurantByStoreId, recordStatus } from "@/lib/restaurants/queries";
import { notify } from "@/lib/notifications/queries";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";
import type { RestaurantStatus } from "@/lib/restaurants/types";

/**
 * The Companion reports what it sees on the DoorDash Merchant Portal: which
 * store, and whether it is open, paused, closed or deactivated. Bearer
 * pairing key, like every /api/companion route.
 *
 * A store the workspace hasn't added yet is answered with 404 rather than
 * created: the person adds restaurants deliberately, with a name and a POS,
 * and the Companion fills in the state.
 */

const STATUSES = new Set<RestaurantStatus>(["open", "closed", "paused", "deactivated", "unknown"]);

interface Payload {
  storeId?: string;
  status?: string;
  detail?: string;
  storeName?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storeId = (payload.storeId ?? "").trim();
  const status = (payload.status ?? "").trim().toLowerCase() as RestaurantStatus;
  if (!storeId) return NextResponse.json({ error: "storeId is required." }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });

  const restaurant = await getRestaurantByStoreId(host.id, storeId);
  if (!restaurant) {
    return NextResponse.json({ ok: false, known: false, hint: "Add this restaurant in HostOS and set its DoorDash store ID to start monitoring." }, { status: 404 });
  }

  const { changed, previous } = await recordStatus(host.id, restaurant.id, status, "companion", payload.detail?.slice(0, 200) ?? null);

  if (changed && (status === "paused" || status === "deactivated" || (status === "closed" && previous === "open"))) {
    await notify({
      hostId: host.id,
      kind: "restaurant",
      severity: status === "deactivated" ? "critical" : "warning",
      title: `${restaurant.name} is now ${status}`,
      body: previous && previous !== "unknown" ? `Was ${previous}. Seen on the Merchant Portal.` : "Seen on the Merchant Portal.",
      href: routes.restaurant(restaurant.id),
      dedupeKey: `store:${restaurant.id}:${status}:${new Date().toISOString().slice(0, 13)}`,
    });
  }
  if (changed) {
    await logActivity({ hostId: host.id, module: "restaurant", event: `store.${status}`, description: `${restaurant.name} observed ${status} on DoorDash`, href: routes.restaurant(restaurant.id) });
  }

  return NextResponse.json({ ok: true, known: true, changed, restaurantId: restaurant.id, name: restaurant.name });
}
