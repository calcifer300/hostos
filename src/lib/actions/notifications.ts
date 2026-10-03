"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { markNotificationsRead } from "@/lib/notifications/queries";
import { routes } from "@/lib/routes";

export interface NotificationActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Marks notifications read for the signed-in person on the current fleet.
 * Read-state is personal (a viewer may clear their own bell), so this needs
 * fleet access but not write access.
 */
export async function markRead(ids: string[] | "all"): Promise<NotificationActionResult> {
  if (await hasNoFleetAccess()) return { ok: false, error: "Your workspace isn't ready yet." };

  const session = await auth();
  const hostId = await getCurrentHostId();
  const ok = await markNotificationsRead(hostId, ids, session?.user?.email ?? null);
  if (!ok) return { ok: false, error: "Couldn't update notifications." };

  revalidatePath(routes.notifications);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}
