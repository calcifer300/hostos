/**
 * Workspace roles and what each may do.
 *
 * Two kinds of role exist in HostOS and they answer different questions:
 *
 *   - a WORKSPACE role (host_members.role) — "what may this person do in
 *     this fleet / restaurant group / store group";
 *   - a PLATFORM role (user_roles.roles) — "who is this person to HostOS
 *     Collective" (Founder, CTO, Developer…). Platform roles unlock the
 *     developer tools in Settings and nothing else; they never grant access
 *     to a workspace the person is not a member of.
 *
 * Client-safe: no imports. Server code enforces; the UI only hides.
 */

export type WorkspaceRole = "owner" | "admin" | "manager" | "member" | "viewer";

export const WORKSPACE_ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "member", "viewer"];

export const ROLE_LABELS: Record<WorkspaceRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including deleting the workspace and transferring ownership." },
  admin: { label: "Admin", description: "Manages members, integrations and settings. Cannot delete the workspace." },
  manager: { label: "Manager", description: "Edits how the workspace runs — knowledge, templates, alerts, modules — and all operational data." },
  member: { label: "Member", description: "Works the day-to-day: trips, restaurants, stores, tasks, messages." },
  viewer: { label: "Viewer", description: "Read-only access to everything the workspace shows." },
};

export type Permission =
  | "workspace.read"
  | "workspace.write" // operational data: trips, board, restaurants, stores, tasks, messages
  | "workspace.settings" // knowledge, templates, alerts, modules, dashboard defaults
  | "workspace.integrations" // pairing keys, Shopify tokens, Gmail
  | "workspace.members" // invite, change roles (below own), remove
  | "workspace.delete";

const MATRIX: Record<WorkspaceRole, Set<Permission>> = {
  owner: new Set(["workspace.read", "workspace.write", "workspace.settings", "workspace.integrations", "workspace.members", "workspace.delete"]),
  admin: new Set(["workspace.read", "workspace.write", "workspace.settings", "workspace.integrations", "workspace.members"]),
  manager: new Set(["workspace.read", "workspace.write", "workspace.settings"]),
  member: new Set(["workspace.read", "workspace.write"]),
  viewer: new Set(["workspace.read"]),
};

/** Rank, for "may only assign roles at or below your own". Higher is more powerful. */
const RANK: Record<WorkspaceRole, number> = { owner: 5, admin: 4, manager: 3, member: 2, viewer: 1 };

export function asWorkspaceRole(value: string | null | undefined): WorkspaceRole {
  return value && (WORKSPACE_ROLES as string[]).includes(value) ? (value as WorkspaceRole) : "viewer";
}

export function can(role: WorkspaceRole | string | null | undefined, permission: Permission): boolean {
  return MATRIX[asWorkspaceRole(role)].has(permission);
}

export function roleRank(role: WorkspaceRole | string | null | undefined): number {
  return RANK[asWorkspaceRole(role)];
}

/** Whether `actor` may set `target` to `newRole`: only below the actor's own rank, and owners are never demoted by non-owners. */
export function canAssignRole(actorRole: WorkspaceRole, targetCurrentRole: WorkspaceRole, newRole: WorkspaceRole): boolean {
  if (!can(actorRole, "workspace.members")) return false;
  if (actorRole !== "owner" && (targetCurrentRole === "owner" || newRole === "owner")) return false;
  if (actorRole === "owner") return true;
  return roleRank(newRole) < roleRank(actorRole) && roleRank(targetCurrentRole) < roleRank(actorRole);
}
