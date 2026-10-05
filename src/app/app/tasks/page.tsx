import type { Metadata } from "next";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getTasks } from "@/lib/tasks/queries";
import { TaskBoard } from "@/components/tasks/task-board";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const hostId = await getCurrentHostId();
  const [tasks, canEdit] = await Promise.all([getTasks(hostId), canEditCurrentFleet()]);
  return <TaskBoard tasks={tasks} canEdit={canEdit} />;
}
