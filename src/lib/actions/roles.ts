"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation } from "@/lib/supabase/server";
import { ROLE_OPTIONS, DEV_TOOLS_ROLES, isFounderEmail, normalizeRoleList } from "@/lib/roles/constants";
import { getUserRoles } from "@/lib/roles/queries";

interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Settings hides the Team & Roles picker from anyone without dev-tools
 * access, but a hidden button is a UI convenience, not a security boundary
 * — a server action is still a callable endpoint regardless of what's
 * rendered. Both mutations below re-check the caller's own session here
 * before touching the table.
 */
async function requireDevToolsAccess(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const myRoles = await getUserRoles(email);
  if (myRoles.some((r) => DEV_TOOLS_ROLES.has(r))) return null;
  return "You don't have access to manage roles.";
}

/** Assigns (or replaces) the role set for one email — Settings' "manual assignment" per PROJECT_STATE. */
export async function setUserRoles(email: string, roles: string[]): Promise<ActionResult> {
  const authError = await requireDevToolsAccess();
  if (authError) return { ok: false, error: authError };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (isFounderEmail(trimmedEmail)) return { ok: false, error: "The Founder's role is fixed and can't be changed here." };
  // Title Case first, so "Virtual assistant" and "Tech lead" from older UIs still map onto the list.
  const validRoles = normalizeRoleList(roles).filter((r): r is (typeof ROLE_OPTIONS)[number] => (ROLE_OPTIONS as readonly string[]).includes(r));

  const result = await runMutation("user_roles.upsert", (client) =>
    client
      .from("user_roles")
      .upsert(
        { user_email: trimmedEmail, roles: validRoles, updated_at: new Date().toISOString() },
        { onConflict: "user_email" }
      )
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeUserRoles(email: string): Promise<ActionResult> {
  const authError = await requireDevToolsAccess();
  if (authError) return { ok: false, error: authError };

  if (isFounderEmail(email)) return { ok: false, error: "The Founder can't be removed." };
  const result = await runMutation("user_roles.delete", (client) =>
    client.from("user_roles").delete().eq("user_email", email.trim().toLowerCase())
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true };
}
