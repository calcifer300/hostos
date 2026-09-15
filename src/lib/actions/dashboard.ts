"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { saveDashboardLayout } from "@/lib/dashboard/layout";
import { DASHBOARDS, WIDGETS, type DashboardScope, type LayoutEntry } from "@/lib/dashboard/widgets";
import { routes } from "@/lib/routes";

const SCOPE_PATH: Record<DashboardScope, string> = {
  home: routes.overview,
  fleet: routes.fleet,
  restaurants: routes.restaurants,
  commerce: routes.commerce,
  services: routes.services,
  web: routes.web,
  cafe: routes.cafe,
  salon: routes.salon,
  custom: routes.custom,
};

/** Saves the caller's own arrangement of one dashboard. Personal, so no write permission is needed — only access. */
export async function saveLayout(scope: DashboardScope, layout: LayoutEntry[]): Promise<{ ok: boolean; error?: string }> {
  if (!DASHBOARDS.some((d) => d.scope === scope)) return { ok: false, error: "Unknown dashboard." };
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet." };
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: "Sign in to save your dashboard." };

  const known = new Set(WIDGETS.filter((w) => w.scopes.includes(scope)).map((w) => w.id));
  const clean = layout.filter((e) => known.has(e.id)).map((e) => ({ id: e.id, visible: Boolean(e.visible) }));
  const ok = await saveDashboardLayout(await getCurrentHostId(), email, scope, clean);
  if (!ok) return { ok: false, error: "Couldn't save the layout. Run migration 0019 if this keeps happening." };
  revalidatePath(SCOPE_PATH[scope]);
  return { ok: true };
}
