"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { runMutation, runQuery } from "@/lib/supabase/server";
import { canManageMembers, getCurrentFleet, getCurrentHostId, getFleetMembers, hasNoFleetAccess } from "@/lib/host/context";
import { getHost } from "@/lib/host/queries";
import { asWorkspaceRole, canAssignRole, ROLE_LABELS, type WorkspaceRole } from "@/lib/roles/permissions";
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
export async function inviteMember(input: { email: string; role: string; displayName?: string }): Promise<MemberActionResult & { emailed?: boolean }> {
  const a = await actor();
  if ("error" in a) return { ok: false, error: a.error };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  const role = asWorkspaceRole(input.role);
  if (input.role !== role) return { ok: false, error: "Unknown role." };
  if (!canAssignRole(a.role, "viewer", role)) return { ok: false, error: `You can't invite someone as ${ROLE_LABELS[role].label}.` };

  const existing = (await getFleetMembers(a.hostId)).find((m) => m.email === email);
  if (existing) return { ok: false, error: "That person is already on this workspace." };

  const result = await runMutation("host_members.invite", (client) =>
    client.from("host_members").insert({
      host_id: a.hostId,
      user_email: email,
      role,
      display_name: input.displayName?.trim().slice(0, 120) || null,
      invited_by: a.email,
      invited_at: new Date().toISOString(),
    })
  );
  if (!result.ok) {
    // Pre-0024 deployments lack the invitation columns; the membership itself still works.
    const bare = await runMutation("host_members.invite_bare", (client) => client.from("host_members").insert({ host_id: a.hostId, user_email: email, role }));
    if (!bare.ok) return { ok: false, error: bare.error };
  }

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
