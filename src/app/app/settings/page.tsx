import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Plug } from "lucide-react";
import { auth } from "@/auth";
import { getAllUserRoles, getUserRoles } from "@/lib/roles/queries";
import { DEV_TOOLS_ROLES } from "@/lib/roles/constants";
import { TeamRolesSection } from "@/components/settings/team-roles-section";
import { FleetSettings } from "@/components/settings/fleet-settings";
import { ModuleSettings } from "@/components/settings/module-settings";
import { getHost, getHostModules } from "@/lib/host/queries";
import { canManageSettings, getCurrentFleet, getCurrentHostId, getFleetMembers } from "@/lib/host/context";
import { asWorkspaceRole, ROLE_LABELS } from "@/lib/roles/permissions";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const hostId = await getCurrentHostId();

  const [myRoles, host, modules, members, fleet, canSettings] = await Promise.all([
    getUserRoles(session?.user?.email ?? null),
    getHost(hostId),
    getHostModules(hostId),
    getFleetMembers(hostId),
    getCurrentFleet(),
    canManageSettings(),
  ]);

  const hasDevToolsAccess = myRoles.some((r) => DEV_TOOLS_ROLES.has(r));
  // Fetched only when it will actually be rendered — a deployment-wide list.
  const roleAssignments = hasDevToolsAccess ? await getAllUserRoles() : [];
  const myRole = fleet ? asWorkspaceRole(fleet.role) : "owner";

  return (
    <div className="space-y-3">
      <FleetSettings
        initialName={host?.name ?? "Workspace"}
        members={members}
        canRename={canSettings && Boolean(host)}
        isOwner={myRole === "owner"}
      />

      <ModuleSettings enabled={modules} canEdit={canSettings} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
        {session?.user ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium">{session.user.name || "Operator"}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{session.user.email}</p>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              <p>
                Workspace role: <span className="font-medium text-foreground">{ROLE_LABELS[myRole].label}</span>
              </p>
              {myRoles.length > 0 && (
                <p>
                  Platform: <span className="font-medium text-foreground">{myRoles.join(" · ")}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">
            No Google account connected.{" "}
            <Link href={routes.login} className="font-medium text-accent">
              Sign in
            </Link>{" "}
            to get your own workspace.
          </p>
        )}
      </div>

      {hasDevToolsAccess && <TeamRolesSection initialAssignments={roleAssignments} />}

      <Link
        href={routes.knowledge}
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13.5px] font-medium">Knowledge base</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Check-in process, house rules, tone — what the Butler grounds every draft in.
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <Link
        href={routes.connectors}
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Plug className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13.5px] font-medium">Connectors</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">The Companion, Shopify, Gmail, and every platform HostOS talks to.</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
