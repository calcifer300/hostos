"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, Mail, Shield, Trash2, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { changeMemberRole, inviteMember, removeMember, setMemberModules } from "@/lib/actions/members";
import { moduleById, type WorkspaceModule } from "@/lib/modules";
import { canAssignRole, ROLE_LABELS, WORKSPACE_ROLES, asWorkspaceRole, type WorkspaceRole } from "@/lib/roles/permissions";
import type { FleetMember } from "@/lib/host/context";
import { cn, formatRelativeTime } from "@/lib/utils";

/** Owners and admins manage the workspace, so they always see every vertical; the picker only applies below them. */
const ALWAYS_ALL: WorkspaceRole[] = ["owner", "admin"];

/**
 * Which verticals a person may open: every one the workspace runs (null),
 * or a chosen few. Chips, so "Shopify and Turo, nothing else" is two taps.
 */
function VerticalPicker({
  modules,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  modules: WorkspaceModule[];
  /** null = every vertical. */
  value: WorkspaceModule[] | null;
  onChange: (next: WorkspaceModule[] | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const all = value === null;
  function toggle(id: WorkspaceModule) {
    // From "every vertical", a chip starts a specific selection with just that one.
    if (all) return onChange([id]);
    const next = value.includes(id) ? value.filter((m) => m !== id) : [...value, id];
    // Every chip picked is the same as "all"; the last chip removed falls back to it — nobody is left able to open nothing.
    if (next.length === modules.length || next.length === 0) return onChange(null);
    onChange(modules.filter((m) => next.includes(m)));
  }
  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border font-medium transition-[background-color,border-color,color,scale] duration-200 ease-[var(--ease-out-expo)] active:scale-95 disabled:opacity-60",
      compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
      active ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={() => onChange(null)} className={chip(all)} aria-pressed={all}>
        {all && <Check className="h-3 w-3" />} Every vertical
      </button>
      {modules.map((id) => {
        const def = moduleById(id);
        if (!def) return null;
        const Icon = MODULE_ICONS[def.icon];
        const active = all || value.includes(id);
        return (
          <motion.button key={id} type="button" layout disabled={disabled} onClick={() => toggle(id)} className={chip(active && !all)} aria-pressed={active} style={active && !all ? { borderColor: `color-mix(in oklab, ${def.hue} 55%, var(--border))`, background: `color-mix(in oklab, ${def.hue} 12%, transparent)`, color: def.hue } : undefined}>
            <Icon className="h-3 w-3" strokeWidth={2} /> {def.title}
          </motion.button>
        );
      })}
    </div>
  );
}

/** "Turo · Shopify" or "Every vertical", for the roster. */
function describeModules(value: WorkspaceModule[] | null): string {
  if (!value) return "Every vertical";
  return value.map((m) => moduleById(m)?.title ?? m).join(" · ");
}

export function TeamMembers({
  members,
  myEmail,
  myRole,
  canManage,
  workspaceModules,
}: {
  members: FleetMember[];
  myEmail: string | null;
  myRole: WorkspaceRole;
  canManage: boolean;
  /** Everything the workspace runs — the choices for per-member access. */
  workspaceModules: WorkspaceModule[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("member");
  const [modules, setModules] = React.useState<WorkspaceModule[] | null>(null);

  const assignable = WORKSPACE_ROLES.filter((r) => canAssignRole(myRole, "viewer", r));
  const limitable = !ALWAYS_ALL.includes(role) && workspaceModules.length > 1;

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteMember({ email, role, displayName: name, modules: limitable ? modules : null });
      if (!result.ok) return void toast.error(result.error ?? "Couldn't invite.");
      toast.success(result.emailed ? `Invitation sent to ${email}` : `${email} added — share the sign-in link with them`);
      setEmail("");
      setName("");
      setModules(null);
      router.refresh();
    });
  }

  function setAccess(target: string, next: WorkspaceModule[] | null) {
    startTransition(async () => {
      const result = await setMemberModules(target, next);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't change access.");
      toast.success(next ? `${target} can open ${describeModules(next)}` : `${target} can open every vertical`);
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
                  {/* Which verticals they can open. Owners and admins: all, always. */}
                  <div className="mt-1.5">
                    {ALWAYS_ALL.includes(r) ? (
                      <p className="text-[11px] text-muted-foreground">Every vertical — {ROLE_LABELS[r].label.toLowerCase()}s manage the whole workspace.</p>
                    ) : canManage && workspaceModules.length > 1 ? (
                      <VerticalPicker compact modules={workspaceModules} value={m.modules} onChange={(next) => setAccess(m.email, next)} disabled={pending} />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Can open: {describeModules(m.modules)}</p>
                    )}
                  </div>
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
          {workspaceModules.length > 1 && (
            <div className="mt-4 space-y-1.5">
              <Label>Verticals they can open</Label>
              {limitable ? (
                <VerticalPicker modules={workspaceModules} value={modules} onChange={setModules} disabled={pending} />
              ) : (
                <p className="text-[12px] text-muted-foreground">{ROLE_LABELS[role].label}s manage the whole workspace, so they see every vertical.</p>
              )}
            </div>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">They sign in with that Google account and land in this workspace with the role you chose — and only the verticals you picked. Nothing else is needed.</p>
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
