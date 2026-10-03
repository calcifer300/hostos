"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation, runQuery } from "@/lib/supabase/server";
import { canManageMembers, getCurrentFleet, getCurrentHostId, getFleetMembers, hasNoFleetAccess } from "@/lib/host/context";
import { getHost } from "@/lib/host/queries";
import { asWorkspaceRole, canAssignRole, ROLE_LABELS, type WorkspaceRole } from "@/lib/roles/permissions";
import { isWorkspaceModule, moduleById, type WorkspaceModule } from "@/lib/modules";
import { logActivity } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { getPublicAppUrl } from "@/lib/site";
import { routes } from "@/lib/routes";

/**
 * Team management for the current workspace. Every check re-derives the
 * caller's role from the session — a server action is a public endpoint,
 * and "the UI hid the button" is not a permission check.
 */

export interface MemberActionResult {
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function actor(): Promise<{ hostId: string; email: string; role: WorkspaceRole } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet." };
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return { error: "Sign in to manage the team." };
  if (!(await canManageMembers())) return { error: "Only an owner or admin can manage members." };
  const fleet = await getCurrentFleet();
  return { hostId: await getCurrentHostId(), email, role: fleet ? asWorkspaceRole(fleet.role) : "owner" };
}

/**
 * Invites someone by email. Membership is the invitation: the row exists
 * now, and the moment that address signs in with Google it resolves to this
 * workspace. An email goes out when Resend is configured; otherwise the
 * inviter is told to send the link themselves.
 */
/**
 * Which verticals an invitation or a membership is limited to. Null is
 * "every vertical the workspace runs"; an empty list is refused rather than
 * stored, because a member who can open nothing is a mistake, not a choice.
 * Owners and admins are never limited (see getAccessibleModules).
 */
function parseModules(role: WorkspaceRole, raw: unknown): { modules: WorkspaceModule[] | null } | { error: string } {
  if (raw === null || raw === undefined) return { modules: null };
  if (!Array.isArray(raw)) return { error: "Pick the verticals as a list." };
  const modules = raw.filter((m): m is WorkspaceModule => typeof m === "string" && isWorkspaceModule(m));
  if (modules.length !== raw.length) return { error: "Unknown vertical." };
  if (asWorkspaceRole(role) === "owner" || asWorkspaceRole(role) === "admin") return { modules: null };
  if (modules.length === 0) return { error: "Give them at least one vertical, or every vertical." };
  return { modules };
}

export async function inviteMember(input: { email: string; role: string; displayName?: string; modules?: string[] | null }): Promise<MemberActionResult & { emailed?: boolean }> {
  const a = await actor();
  if ("error" in a) return { ok: false, error: a.error };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  const role = asWorkspaceRole(input.role);
  if (input.role !== role) return { ok: false, error: "Unknown role." };
  if (!canAssignRole(a.role, "viewer", role)) return { ok: false, error: `You can't invite someone as ${ROLE_LABELS[role].label}.` };
  const parsed = parseModules(role, input.modules ?? null);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const existing = (await getFleetMembers(a.hostId)).find((m) => m.email === email);
  if (existing) return { ok: false, error: "That person is already on this workspace." };

  const invitation = {
    host_id: a.hostId,
    user_email: email,
    role,
    display_name: input.displayName?.trim().slice(0, 120) || null,
    invited_by: a.email,
    invited_at: new Date().toISOString(),
  };
  // Columns arrive with migrations (modules: 0026, invitation details: 0024);
  // an insert naming a missing column fails outright, so retry without it
  // rather than lose the membership — which is the part that matters.
  const attempts = [
    { op: "host_members.invite", row: { ...invitation, modules: parsed.modules } },
    { op: "host_members.invite_0024", row: invitation },
    { op: "host_members.invite_bare", row: { host_id: a.hostId, user_email: email, role } },
  ];
  let lastError = "";
  let inserted = false;
  for (const attempt of attempts) {
    const result = await runMutation(attempt.op, (client) => client.from("host_members").insert(attempt.row));
    if (result.ok) {
      inserted = true;
      break;
    }
    lastError = result.error;
  }
  if (!inserted) return { ok: false, error: lastError };

  const host = await getHost(a.hostId);
  const workspaceName = host?.name ?? "a HostOS workspace";
  await logActivity({ hostId: a.hostId, module: "team", event: "member.invited", description: `${email} invited as ${ROLE_LABELS[role].label}`, actorEmail: a.email, href: routes.team });
  await notify({ hostId: a.hostId, kind: "system", severity: "info", title: `${email} was invited as ${ROLE_LABELS[role].label}`, href: routes.team, dedupeKey: `invite:${email}` });

  let emailed = false;
  if (isEmailConfigured()) {
    try {
      const outcome = await sendEmail(
        [email],
        `You've been added to ${workspaceName} on HostOS`,
        `${a.email} added you to ${workspaceName} on HostOS as ${ROLE_LABELS[role].label}.\n\nSign in with this Google account to open it: ${getPublicAppUrl()}${routes.login}\n\nHostOS — built by HostOS Collective`
      );
      emailed = outcome.status === "sent";
    } catch (err) {
      // The membership exists regardless; the inviter is told to pass the link on.
      console.warn("[members] invitation email failed:", err instanceof Error ? err.message : err);
    }
  }

  revalidatePath(routes.team);
  revalidatePath(routes.settings);
  revalidatePath(routes.app, "layout");
  return { ok: true, emailed };
}

/** Limits (or un-limits) which verticals a member may open. Owners and admins always see every vertical, so nothing is stored for them. */
export async function setMemberModules(email: string, modules: string[] | null): Promise<MemberActionResult> {
  const a = await actor();
  if ("error" in a) return { ok: false, error: a.error };

  const target = email.trim().toLowerCase();
  const members = await getFleetMembers(a.hostId);
  const current = members.find((m) => m.email === target);
  if (!current) return { ok: false, error: "That person isn't on this workspace." };
  const role = asWorkspaceRole(current.role);
  if (role === "owner" || role === "admin") return { ok: false, error: `${ROLE_LABELS[role].label}s always see every vertical.` };
  if (!canAssignRole(a.role, role, role)) return { ok: false, error: "You can't change what that person can open." };
  const parsed = parseModules(role, modules);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const result = await runMutation("host_members.modules", (client) => client.from("host_members").update({ modules: parsed.modules }).eq("host_id", a.hostId).eq("user_email", target));
  if (!result.ok) return { ok: false, error: /column|modules/i.test(result.error) ? "Run migration 0026 to assign verticals per member." : result.error };

  const summary = parsed.modules ? parsed.modules.map((m) => moduleById(m)?.title ?? m).join(", ") : "every vertical";
  await logActivity({ hostId: a.hostId, module: "team", event: "member.modules", description: `${target} can now open ${summary}`, actorEmail: a.email, href: routes.team });
  revalidatePath(routes.team);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

export async function changeMemberRole(email: string, role: string): Promise<MemberActionResult> {
  const a = await actor();
  if ("error" in a) return { ok: false, error: a.error };

  const target = email.trim().toLowerCase();
  const newRole = asWorkspaceRole(role);
  if (role !== newRole) return { ok: false, error: "Unknown role." };

  const members = await getFleetMembers(a.hostId);
  const current = members.find((m) => m.email === target);
  if (!current) return { ok: false, error: "That person isn't on this workspace." };
  if (target === a.email && newRole !== a.role) return { ok: false, error: "You can't change your own role. Ask another owner or admin." };
  if (!canAssignRole(a.role, asWorkspaceRole(current.role), newRole)) return { ok: false, error: "You can't assign that role." };

  if (asWorkspaceRole(current.role) === "owner" && newRole !== "owner") {
    const owners = members.filter((m) => asWorkspaceRole(m.role) === "owner");
    if (owners.length <= 1) return { ok: false, error: "A workspace needs at least one owner. Make someone else an owner first." };
  }

  const result = await runMutation("host_members.role", (client) => client.from("host_members").update({ role: newRole }).eq("host_id", a.hostId).eq("user_email", target));
  if (!result.ok) return { ok: false, error: result.error };
  if ((newRole === "owner" || newRole === "admin") && current.modules) {
    // Best effort: an owner or admin is never limited, so drop the stale list (no-op before 0026).
    await runMutation("host_members.modules_clear", (client) => client.from("host_members").update({ modules: null }).eq("host_id", a.hostId).eq("user_email", target));
  }

  await logActivity({ hostId: a.hostId, module: "team", event: "member.role", description: `${target} is now ${ROLE_LABELS[newRole].label}`, actorEmail: a.email, href: routes.team });
  revalidatePath(routes.team);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

export async function removeMember(email: string): Promise<MemberActionResult> {
  const a = await actor();
  if ("error" in a) return { ok: false, error: a.error };

  const target = email.trim().toLowerCase();
  if (target === a.email) return { ok: false, error: "You can't remove yourself. Ask another owner or admin." };

  const members = await getFleetMembers(a.hostId);
  const current = members.find((m) => m.email === target);
  if (!current) return { ok: false, error: "That person isn't on this workspace." };
  if (!canAssignRole(a.role, asWorkspaceRole(current.role), "viewer") && asWorkspaceRole(current.role) !== "viewer") {
    return { ok: false, error: "You can't remove someone with that role." };
  }
  if (asWorkspaceRole(current.role) === "owner" && a.role !== "owner") return { ok: false, error: "Only an owner can remove an owner." };

  const result = await runMutation("host_members.remove", (client) => client.from("host_members").delete().eq("host_id", a.hostId).eq("user_email", target));
  if (!result.ok) return { ok: false, error: result.error };

  await logActivity({ hostId: a.hostId, module: "team", event: "member.removed", description: `${target} removed from the workspace`, actorEmail: a.email, href: routes.team });
  revalidatePath(routes.team);
  revalidatePath(routes.app, "layout");
  return { ok: true };
}

/** Records that the signed-in person has opened a workspace they were invited to. */
export async function acceptInvitation(): Promise<void> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || (await hasNoFleetAccess())) return;
  const hostId = await getCurrentHostId();
  await runQuery("host_members.accept", (client) =>
    client.from("host_members").update({ accepted_at: new Date().toISOString() }).eq("host_id", hostId).eq("user_email", email).is("accepted_at", null)
  );
}
