import type { Metadata } from "next";
import { auth } from "@/auth";
import { VerticalChooser } from "@/components/verticals/vertical-chooser";
import { canManageSettings, getChosenVertical, getCurrentHostId } from "@/lib/host/context";
import { getHost, getHostModules } from "@/lib/host/queries";
import { acceptInvitation } from "@/lib/actions/members";

export const metadata: Metadata = { title: "Choose a vertical" };

/** The first screen after sign-in: pick the line of business to run HostOS for. */
export default async function StartPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? null;
  const hostId = await getCurrentHostId();
  const [host, modules, canEnable] = await Promise.all([getHost(hostId), getHostModules(hostId), canManageSettings()]);
  const current = await getChosenVertical(modules);

  // Someone opening a workspace they were invited to: record it (best effort).
  if (session?.user?.email) void acceptInvitation();

  return <VerticalChooser firstName={firstName} enabled={modules} current={current} canEnable={canEnable} workspaceName={host?.name ?? "Your workspace"} />;
}
