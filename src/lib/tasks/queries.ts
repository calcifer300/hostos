import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Tasks (migration 0019): the unit of work shared by both products and the
 * AI Butler. Generated tasks carry a dedupe key so the Butler can re-run
 * without duplicating; manual ones don't.
 */

export type TaskStatus = "open" | "in_progress" | "done" | "dismissed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskSource = "manual" | "butler" | "automation";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  assigneeEmail: string | null;
  source: TaskSource;
  relatedKind: string | null;
  relatedId: string | null;
  href: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  assignee_email: string | null;
  source: string;
  related_kind: string | null;
  related_id: string | null;
  href: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const COLUMNS =
  "id, title, description, status, priority, due_at, assignee_email, source, related_kind, related_id, href, created_by, created_at, updated_at, completed_at";

const STATUSES = new Set<string>(["open", "in_progress", "done", "dismissed"]);
const PRIORITIES = new Set<string>(["low", "medium", "high", "critical"]);
const SOURCES = new Set<string>(["manual", "butler", "automation"]);

export const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: (STATUSES.has(row.status) ? row.status : "open") as TaskStatus,
    priority: (PRIORITIES.has(row.priority) ? row.priority : "medium") as TaskPriority,
    dueAt: row.due_at,
    assigneeEmail: row.assignee_email,
    source: (SOURCES.has(row.source) ? row.source : "manual") as TaskSource,
    relatedKind: row.related_kind,
    relatedId: row.related_id,
    href: row.href,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/** Open and in-progress tasks first (by priority, then due date), then the rest. */
export const getTasks = cache(async function getTasks(hostId: string, limit = 200): Promise<Task[]> {
  const { data } = await runQueryOr<TaskRow[]>("tasks.list", [], (client) =>
    client
      .from("tasks")
      .select(COLUMNS)
      .eq("host_id", hostId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<TaskRow[]>()
  );

  const tasks = data.map(rowToTask);
  const activeRank = (t: Task) => (t.status === "open" || t.status === "in_progress" ? 0 : 1);
  return tasks.sort((a, b) => {
    const ar = activeRank(a);
    const br = activeRank(b);
    if (ar !== br) return ar - br;
    if (ar === 0) {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

export interface TaskCounts {
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
  critical: number;
}

export function summarizeTasks(tasks: Task[], now = Date.now()): TaskCounts {
  const counts: TaskCounts = { open: 0, inProgress: 0, done: 0, overdue: 0, critical: 0 };
  for (const t of tasks) {
    if (t.status === "open") counts.open += 1;
    if (t.status === "in_progress") counts.inProgress += 1;
    if (t.status === "done") counts.done += 1;
    const active = t.status === "open" || t.status === "in_progress";
    if (active && t.dueAt && new Date(t.dueAt).getTime() < now) counts.overdue += 1;
    if (active && t.priority === "critical") counts.critical += 1;
  }
  return counts;
}

export interface CreateTaskInput {
  hostId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeEmail?: string | null;
  source?: TaskSource;
  relatedKind?: string | null;
  relatedId?: string | null;
  href?: string | null;
  dedupeKey?: string | null;
  createdBy?: string | null;
}

/**
 * Creates a task. With a dedupe key, an existing open task with the same key
 * is left alone and `created` is false — the Butler's re-runs depend on it.
 */
export async function createTask(input: CreateTaskInput): Promise<{ created: boolean; id: string | null }> {
  const row = {
    host_id: input.hostId,
    title: input.title.slice(0, 200),
    description: input.description ? input.description.slice(0, 4000) : null,
    priority: input.priority ?? "medium",
    due_at: input.dueAt ?? null,
    assignee_email: input.assigneeEmail ?? null,
    source: input.source ?? "manual",
    related_kind: input.relatedKind ?? null,
    related_id: input.relatedId ?? null,
    href: input.href ?? null,
    dedupe_key: input.dedupeKey ?? null,
    created_by: input.createdBy ?? null,
  };

  const outcome = await runQuery<{ id: string }[]>("tasks.insert", (client) =>
    input.dedupeKey
      ? client.from("tasks").upsert(row, { onConflict: "host_id,dedupe_key", ignoreDuplicates: true }).select("id")
      : client.from("tasks").insert(row).select("id")
  );

  if (!outcome.ok || !outcome.data || outcome.data.length === 0) return { created: false, id: null };
  return { created: true, id: outcome.data[0].id };
}

export async function updateTask(
  hostId: string,
  id: string,
  patch: Partial<{ status: TaskStatus; priority: TaskPriority; title: string; description: string | null; dueAt: string | null; assigneeEmail: string | null }>
): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (patch.status) {
    update.status = patch.status;
    update.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  }
  if (patch.priority) update.priority = patch.priority;
  if (patch.title !== undefined) update.title = patch.title.slice(0, 200);
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.assigneeEmail !== undefined) update.assignee_email = patch.assigneeEmail;

  const result = await runMutation("tasks.update", (client) =>
    client.from("tasks").update(update).eq("host_id", hostId).eq("id", id)
  );
  return result.ok;
}

export async function deleteTask(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("tasks.delete", (client) => client.from("tasks").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}
