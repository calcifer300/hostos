"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";
import { canManageSettings, getAccessibleModules, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { getHostModules } from "@/lib/host/queries";
import { isWorkspaceModule, moduleById } from "@/lib/modules";
import { VERTICAL_COOKIE, VERTICAL_ROUTES } from "@/lib/verticals";
import { logActivity } from "@/lib/activity/queries";

/**
 * "Run HostOS for …": remembers the vertical, switches it on for the
 * workspace if it isn't yet (settings permission required for that part),
 * and opens its dashboard. The chooser is the first thing after sign-in, so
 * this has to work for a member who can't change settings — for them an
 * already-enabled vertical simply opens.
 */
export async function chooseVertical(moduleId: string): Promise<{ ok: false; error: string }> {
  if (!isWorkspaceModule(moduleId)) return { ok: false, error: "Unknown vertical." };
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet. Reload and try again." };

  const hostId = await getCurrentHostId();
  const enabled = await getHostModules(hostId);
  if (enabled.includes(moduleId) && !(await getAccessibleModules()).includes(moduleId)) {
    return { ok: false, error: `${moduleById(moduleId)?.title} isn't assigned to you in this workspace — ask an owner or admin.` };
  }
  if (!enabled.includes(moduleId)) {
    if (!(await canManageSettings())) return { ok: false, error: `${moduleById(moduleId)?.title} isn't switched on for this workspace yet — ask an owner, admin or manager to enable it.` };
    const next = [...enabled, moduleId];
    const result = await runMutation("hosts.modules", (client) => client.from("hosts").update({ modules: next }).eq("id", hostId));
    if (!result.ok) return { ok: false, error: /column|created/i.test(result.error) ? "Run migration 0017 to enable verticals." : result.error };
    const session = await auth();
    await logActivity({ hostId, module: "system", event: "workspace.modules", description: `${moduleById(moduleId)?.title} switched on`, actorEmail: session?.user?.email ?? null });
  }

  const store = await cookies();
  store.set(VERTICAL_COOKIE, moduleId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/app", "layout");
  redirect(VERTICAL_ROUTES[moduleId]);
}
