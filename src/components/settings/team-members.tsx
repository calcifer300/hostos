"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, Mail, Shield, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { changeMemberRole, inviteMember, removeMember } from "@/lib/actions/members";
import { canAssignRole, ROLE_LABELS, WORKSPACE_ROLES, asWorkspaceRole, type WorkspaceRole } from "@/lib/roles/permissions";
import type { FleetMember } from "@/lib/host/context";
import { cn, formatRelativeTime } from "@/lib/utils";

export function TeamMembers({
  members,
  myEmail,
  myRole,
  canManage,
}: {
  members: FleetMember[];
  myEmail: string | null;
  myRole: WorkspaceRole;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("member");

  const assignable = WORKSPACE_ROLES.filter((r) => canAssignRole(myRole, "viewer", r));

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteMember({ email, role, displayName: name });
      if (!result.ok) return void toast.error(result.error ?? "Couldn't invite.");
      toast.success(result.emailed ? `Invitation sent to ${email}` : `${email} added — share the sign-in link with them`);
      setEmail("");
      setName("");
      router.refresh();
    });
  }

  function setMemberRole(target: string, next: string) {
    startTransition(async () => {
      const result = await changeMemberRole(target, next);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't change the role.");
      toast.success("Role updated");
      router.refresh();
    });
  }

  function remove(target: string) {
    startTransition(async () => {
      const result = await removeMember(target);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't remove.");
      toast.success("Removed from the workspace");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-[13px] font-semibold">People ({members.length})</p>
          <span className="text-[12px] text-muted-foreground">Your role: <span className="font-medium text-foreground">{ROLE_LABELS[myRole].label}</span></span>
        </div>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const r = asWorkspaceRole(m.role);
            const isMe = m.email === myEmail;
            const editable = canManage && !isMe && WORKSPACE_ROLES.some((next) => next !== r && canAssignRole(myRole, r, next));
            return (
              <li key={m.email} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-semibold uppercase text-white">
                  {(m.displayName ?? m.email).slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
                    {m.displayName ?? m.email}
                    {r === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}
                    {isMe && <span className="text-[11px] text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {m.displayName ? `${m.email} · ` : ""}
                    {m.acceptedAt ? `joined ${formatRelativeTime(m.acceptedAt)}` : m.invitedAt ? `invited ${formatRelativeTime(m.invitedAt)} · not signed in yet` : `since ${formatRelativeTime(m.createdAt)}`}
                  </p>
                </div>
                {editable ? (
                  <NativeSelect className="h-8 w-36 text-[12.5px]" value={r} disabled={pending} onChange={(e) => setMemberRole(m.email, e.target.value)}>
                    {WORKSPACE_ROLES.filter((next) => next === r || canAssignRole(myRole, r, next)).map((next) => (
                      <option key={next} value={next}>
                        {ROLE_LABELS[next].label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge variant={r === "owner" ? "warning" : r === "admin" ? "accent" : "neutral"}>{ROLE_LABELS[r].label}</Badge>
                )}
                {canManage && !isMe && r !== "owner" && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.email}`} disabled={pending} onClick={() => remove(m.email)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage && (
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <p className="text-[13px] font-semibold">Invite someone</p>
          </div>
          <form onSubmit={invite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1fr_0.8fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Google account email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="karl@example.com" className="pl-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Name (optional)</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Karl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <NativeSelect id="inv-role" value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r].label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="primary" loading={pending}>
              Invite
            </Button>
          </form>
          <p className="mt-3 text-[12px] text-muted-foreground">They sign in with that Google account and land in this workspace with the role you chose. Nothing else is needed.</p>
        </Card>
      )}

      <Card padding="md">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-[13px] font-semibold">What each role can do</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORKSPACE_ROLES.map((r) => (
            <li key={r} className={cn("rounded-xl border border-border px-3.5 py-2.5", r === myRole && "border-accent/40 bg-accent/5")}>
              <p className="text-[13px] font-medium">{ROLE_LABELS[r].label}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{ROLE_LABELS[r].description}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
