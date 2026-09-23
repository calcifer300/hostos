"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { createTask, deleteTask, updateTask, type TaskPriority, type TaskStatus } from "@/lib/tasks/queries";
import { logActivity } from "@/lib/activity/queries";
import { routes } from "@/lib/routes";

export interface TaskActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const PRIORITIES = new Set<TaskPriority>(["low", "medium", "high", "critical"]);
const STATUSES = new Set<TaskStatus>(["open", "in_progress", "done", "dismissed"]);

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet. Reload and try again." };
  if (!(await canEditCurrentFleet())) return { error: "You have read-only access to this workspace." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

function refresh() {
  revalidatePath(routes.tasks);
  revalidatePath(routes.app);
}

export async function addTask(input: {
  title: string;
  description?: string;
  priority?: string;
  dueAt?: string | null;
  assigneeEmail?: string | null;
}): Promise<TaskActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the task a title." };

  const priority = PRIORITIES.has(input.priority as TaskPriority) ? (input.priority as TaskPriority) : "medium";
  const dueAt = input.dueAt && !Number.isNaN(Date.parse(input.dueAt)) ? new Date(input.dueAt).toISOString() : null;

  const { created, id } = await createTask({
    hostId: g.hostId,
    title,
    description: input.description?.trim() || null,
    priority,
    dueAt,
    assigneeEmail: input.assigneeEmail?.trim().toLowerCase() || null,
    source: "manual",
    createdBy: g.email,
  });

  if (!created || !id) return { ok: false, error: "Couldn't create the task. The problem has been logged." };

  await logActivity({ hostId: g.hostId, module: "team", event: "task.created", description: `Task created: ${title}`, actorEmail: g.email, href: routes.tasks });
  refresh();
  return { ok: true, id };
}

export async function setTaskStatus(id: string, status: string): Promise<TaskActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!STATUSES.has(status as TaskStatus)) return { ok: false, error: "Unknown status." };

  const ok = await updateTask(g.hostId, id, { status: status as TaskStatus });
  if (!ok) return { ok: false, error: "Couldn't update the task." };

  if (status === "done") {
    await logActivity({ hostId: g.hostId, module: "team", event: "task.completed", description: "Task completed", actorEmail: g.email, href: routes.tasks });
  }
  refresh();
  return { ok: true };
}

export async function setTaskPriority(id: string, priority: string): Promise<TaskActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!PRIORITIES.has(priority as TaskPriority)) return { ok: false, error: "Unknown priority." };

  const ok = await updateTask(g.hostId, id, { priority: priority as TaskPriority });
  if (!ok) return { ok: false, error: "Couldn't update the task." };
  refresh();
  return { ok: true };
}

export async function removeTask(id: string): Promise<TaskActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };

  const ok = await deleteTask(g.hostId, id);
  if (!ok) return { ok: false, error: "Couldn't delete the task." };
  refresh();
  return { ok: true };
}
