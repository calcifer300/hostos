import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getAutomationSettings } from "@/lib/automations/queries";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getTasks } from "@/lib/tasks/queries";
import { isAiConfigured } from "@/lib/ai";
import { ButlerWorkspace } from "@/components/butler/butler-workspace";

export const metadata: Metadata = { title: "Butler" };

/**
 * The Butler's home: ask it questions, see what it filed, review the
 * rule-based suggestions, and manage automations. One AI system; this is
 * its front door.
 */
export default async function ButlerPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const hostId = await getCurrentHostId();

  const [data, tasks, settings, canEdit] = await Promise.all([
    getDashboardData(email),
    getTasks(hostId),
    getAutomationSettings(hostId),
    canEditCurrentFleet(),
  ]);

  return (
    <ButlerWorkspace
      suggestions={data.suggestions}
      tasks={tasks}
      automationSettings={settings}
      canEdit={canEdit}
      aiConfigured={isAiConfigured()}
    />
  );
}
