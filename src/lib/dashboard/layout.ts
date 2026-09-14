import "server-only";
import { cache } from "react";
import { runMutation, runQueryOr } from "@/lib/supabase/server";
import { storedLayoutFor, type DashboardScope, type LayoutEntry, type StoredLayouts } from "@/lib/dashboard/widgets";

/**
 * The stored widget arrangements for one person on one workspace (migration
 * 0019). The row's `layout` column holds one JSON object keyed by dashboard
 * scope; a bare array from before dashboards were split is read as Home.
 */
export const getDashboardLayouts = cache(async function getDashboardLayouts(hostId: string, userEmail: string | null): Promise<unknown> {
  if (!userEmail) return null;
  const { data } = await runQueryOr<{ layout: unknown } | null>("dashboard_layouts.get", null, (client) =>
    client.from("dashboard_layouts").select("layout").eq("host_id", hostId).eq("user_email", userEmail).maybeSingle<{ layout: unknown }>()
  );
  return data?.layout ?? null;
});

export async function getDashboardLayout(hostId: string, userEmail: string | null, scope: DashboardScope): Promise<LayoutEntry[] | null> {
  return storedLayoutFor(await getDashboardLayouts(hostId, userEmail), scope);
}

/** Writes one dashboard's arrangement, keeping the others as they were. */
export async function saveDashboardLayout(hostId: string, userEmail: string, scope: DashboardScope, layout: LayoutEntry[]): Promise<boolean> {
  const current = await getDashboardLayouts(hostId, userEmail);
  const next: StoredLayouts = {};
  if (Array.isArray(current)) next.home = storedLayoutFor(current, "home") ?? [];
  else if (typeof current === "object" && current !== null) {
    for (const key of ["home", "fleet", "restaurants", "commerce"] as DashboardScope[]) {
      const existing = storedLayoutFor(current, key);
      if (existing) next[key] = existing;
    }
  }
  next[scope] = layout;

  const result = await runMutation("dashboard_layouts.upsert", (client) =>
    client.from("dashboard_layouts").upsert({ host_id: hostId, user_email: userEmail, layout: next }, { onConflict: "host_id,user_email" })
  );
  return result.ok;
}
