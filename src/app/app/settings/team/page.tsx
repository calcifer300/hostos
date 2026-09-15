import type { Metadata } from "next";
import { auth } from "@/auth";
import { canManageMembers, getCurrentFleet, getCurrentHostId, getFleetMembers } from "@/lib/host/context";
import { getHostModules } from "@/lib/host/queries";
import { asWorkspaceRole } from "@/lib/roles/permissions";
import { TeamMembers } from "@/components/settings/team-members";

export const metadata: Metadata = { title: "Team & roles" };

export default async function TeamPage() {
  const session = await auth();
  const hostId = await getCurrentHostId();
  const [members, fleet, canManage, modules] = await Promise.all([getFleetMembers(hostId), getCurrentFleet(), canManageMembers(), getHostModules(hostId)]);
  return (
    <TeamMembers
      members={members}
      workspaceModules={modules}
      myEmail={session?.user?.email?.toLowerCase() ?? null}
      myRole={fleet ? asWorkspaceRole(fleet.role) : "owner"}
      canManage={canManage}
    />
  );
}
