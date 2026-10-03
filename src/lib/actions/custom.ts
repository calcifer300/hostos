"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { getHost } from "@/lib/host/queries";
import { deleteMetric, insertBuildRequest, insertMetric, setBuildRequestStatus, upsertMetricEntry, type BuildRequest } from "@/lib/custom/queries";
import { logActivity } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { createTask } from "@/lib/tasks/queries";
import { sendEmail } from "@/lib/email/send";
import { SITE } from "@/lib/site";
import { routes } from "@/lib/routes";

/** Every write in the custom vertical. { ok, error? }, never throws, permission-checked. */

export interface CustomActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet. Reload and try again." };
  if (!(await canEditCurrentFleet())) return { error: "You have read-only access to this workspace." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const migrationHint = (error: string) => (/relation|created/i.test(error) ? "Run migration 0025 to enable the custom vertical." : error);

export async function createMetric(input: { name: string; unit?: string; target?: number | null; direction?: "up" | "down" }): Promise<CustomActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const name = str(input.name, 80);
  if (!name) return { ok: false, error: "Name the number you want to track." };
  const target = input.target === null || input.target === undefined || (input.target as unknown) === "" ? null : Number(input.target);
  const outcome = await insertMetric(g.hostId, { name, unit: str(input.unit, 20) || null, target: target !== null && Number.isFinite(target) ? target : null, direction: input.direction === "down" ? "down" : "up", createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  await logActivity({ hostId: g.hostId, module: "custom", event: "metric.created", description: `Now tracking ${name}`, actorEmail: g.email, href: routes.custom });
  revalidatePath(routes.custom);
  return { ok: true, id: outcome.id };
}

export async function removeMetric(id: string): Promise<CustomActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!(await deleteMetric(g.hostId, str(id, 40)))) return { ok: false, error: "Couldn't remove the metric." };
  revalidatePath(routes.custom);
  return { ok: true };
}

export async function logMetric(input: { metricId: string; day: string; value: number; note?: string }): Promise<CustomActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const day = str(input.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Pick a day." };
  const value = Number(input.value);
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a number." };
  const outcome = await upsertMetricEntry(g.hostId, { metricId: str(input.metricId, 40), day, value, note: str(input.note, 500) || null, createdBy: g.email });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };
  revalidatePath(routes.custom);
  return { ok: true };
}

/** A build request goes to the Collective: stored, filed as a task, and emailed when mail is configured. */
export async function requestBuild(input: { title: string; description?: string; priority?: BuildRequest["priority"] }): Promise<CustomActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const title = str(input.title, 160);
  if (!title) return { ok: false, error: "Say what you'd like built." };
  const description = str(input.description, 4000) || null;
  const priority: BuildRequest["priority"] = input.priority === "high" ? "high" : input.priority === "low" ? "low" : "medium";
  const outcome = await insertBuildRequest(g.hostId, { title, description, priority, requestedBy: g.email });
  if (!outcome.ok) return { ok: false, error: migrationHint(outcome.error) };

  const host = await getHost(g.hostId);
  await createTask({ hostId: g.hostId, title: `Build request: ${title}`, description, priority: priority === "high" ? "high" : "medium", source: "manual", relatedKind: "build_request", relatedId: outcome.id, href: routes.custom, createdBy: g.email, dedupeKey: `build:${outcome.id}` });
  await notify({ hostId: g.hostId, kind: "custom", severity: "info", title: `Build request sent: ${title}`, body: "HostOS Collective will scope it and come back to you.", href: routes.custom, dedupeKey: `build:${outcome.id}` });
  await logActivity({ hostId: g.hostId, module: "custom", event: "build.requested", description: `Build request: ${title}`, actorEmail: g.email, href: routes.custom });
  try {
    await sendEmail([SITE.contactEmail], `[HostOS] Build request from ${host?.name ?? "a workspace"}: ${title}`, `${g.email ?? "Someone"} asked for a custom build.\n\nPriority: ${priority}\n\n${description ?? "(no description)"}\n\nWorkspace: ${host?.name ?? g.hostId}`);
  } catch {
    // Mail is optional; the request is already stored and filed.
  }
  revalidatePath(routes.custom);
  return { ok: true, id: outcome.id };
}

export async function updateBuildRequest(id: string, status: BuildRequest["status"]): Promise<CustomActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  if (!["new", "scoping", "building", "done", "declined"].includes(status)) return { ok: false, error: "Unknown status." };
  if (!(await setBuildRequestStatus(g.hostId, str(id, 40), status))) return { ok: false, error: "Couldn't update the request." };
  revalidatePath(routes.custom);
  return { ok: true };
}
