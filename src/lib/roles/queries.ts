import "server-only";
import { runQueryOr } from "@/lib/supabase/server";
import { FOUNDER_EMAILS, isFounderEmail, normalizeRoleList } from "@/lib/roles/constants";

export interface UserRoleAssignment {
  email: string;
  roles: string[];
}

interface UserRoleRow {
  user_email: string;
  roles: string[] | null;
}

/**
 * Roles held by one email — empty array when unset, never throws. Called on
 * every page render (see (app)/layout.tsx), so an un-migrated table or an
 * unreachable backend degrades to "nobody has a role" rather than breaking
 * the app.
 */
export async function getUserRoles(email: string | null): Promise<string[]> {
  if (!email) return [];
  // The founder is the founder regardless of what the table says.
  if (isFounderEmail(email)) return ["Founder"];

  const { data } = await runQueryOr<{ roles: string[] | null } | null>("user_roles.for_email", null, (client) =>
    client.from("user_roles").select("roles").eq("user_email", email).maybeSingle<{ roles: string[] | null }>()
  );

  return normalizeRoleList(data?.roles);
}

/** Every assigned email, for the Settings admin list. */
export async function getAllUserRoles(): Promise<UserRoleAssignment[]> {
  const { data } = await runQueryOr<UserRoleRow[]>("user_roles.list", [], (client) =>
    client
      .from("user_roles")
      .select("user_email, roles")
      .order("user_email", { ascending: true })
      .returns<UserRoleRow[]>()
  );

  const rows = data.map((row) => ({ email: row.user_email, roles: isFounderEmail(row.user_email) ? ["Founder"] : normalizeRoleList(row.roles) }));
  // Founders appear in the list even without a row, so nobody wonders where they went.
  for (const email of FOUNDER_EMAILS) if (!rows.some((r) => r.email.toLowerCase() === email)) rows.unshift({ email, roles: ["Founder"] });
  return rows;
}
