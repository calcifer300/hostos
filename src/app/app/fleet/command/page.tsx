import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { CommandView } from "@/components/command/command-view";
import { getCommandSnapshot } from "@/lib/command/queries";
import { getCurrentHostId, verticalAccess } from "@/lib/host/context";

export const metadata: Metadata = { title: "Command Center" };
export const dynamic = "force-dynamic";

/**
 * The Command Center on the web: the HostOS extension scrapes Turo on the operator's PC and sends a snapshot
 * here; this page only draws it. Read-only. It belongs to the fleet vertical, so nothing is queried unless this
 * person may open it.
 */
export default async function CommandCenterPage() {
  const access = await verticalAccess("fleet");
  if (access !== "ok") return <ModuleOff module="fleet" reason={access} />;
  const stored = await getCommandSnapshot(await getCurrentHostId());
  return <CommandView stored={stored} now={Date.now()} />;
}
