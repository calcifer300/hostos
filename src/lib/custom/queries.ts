import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * The custom vertical (migration 0025): a business defines the numbers it
 * wants to see every morning and logs them; checklists come from the shared
 * local-business tables; build requests go to HostOS Collective.
 */

export interface CustomMetric {
  id: string;
  name: string;
  unit: string | null;
  target: number | null;
  direction: "up" | "down";
  cadence: string;
  position: number;
  entries: { day: string; value: number; note: string | null }[];
}

export interface BuildRequest {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "new" | "scoping" | "building" | "done" | "declined";
  requestedBy: string | null;
  createdAt: string;
}

interface MetricRow {
  id: string;
  name: string;
  unit: string | null;
  target: number | string | null;
  direction: string;
  cadence: string;
  position: number;
}

interface EntryRow {
  metric_id: string;
  day: string;
  value: number | string;
  note: string | null;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const getMetrics = cache(async function getMetrics(hostId: string, sinceDay: string): Promise<CustomMetric[]> {
  const { data: metrics } = await runQueryOr<MetricRow[]>("custom_metrics.list", [], (client) =>
    client.from("custom_metrics").select("id, name, unit, target, direction, cadence, position").eq("host_id", hostId).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(100).returns<MetricRow[]>()
  );
  if (metrics.length === 0) return [];
  const { data: entries } = await runQueryOr<EntryRow[]>("custom_metric_entries.list", [], (client) =>
    client.from("custom_metric_entries").select("metric_id, day, value, note").eq("host_id", hostId).gte("day", sinceDay).order("day", { ascending: true }).limit(10000).returns<EntryRow[]>()
  );
  const byMetric = new Map<string, CustomMetric["entries"]>();
  for (const e of entries) {
    const list = byMetric.get(e.metric_id) ?? [];
    list.push({ day: e.day, value: num(e.value) ?? 0, note: e.note });
    byMetric.set(e.metric_id, list);
  }
  return metrics.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    target: num(m.target),
    direction: m.direction === "down" ? "down" : "up",
    cadence: m.cadence,
    position: m.position,
    entries: byMetric.get(m.id) ?? [],
  }));
});

export async function insertMetric(hostId: string, input: { name: string; unit: string | null; target: number | null; direction: "up" | "down"; createdBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("custom_metrics.insert", (client) =>
    client.from("custom_metrics").insert({ host_id: hostId, name: input.name, unit: input.unit, target: input.target, direction: input.direction, created_by: input.createdBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function deleteMetric(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("custom_metrics.delete", (client) => client.from("custom_metrics").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

export async function upsertMetricEntry(hostId: string, input: { metricId: string; day: string; value: number; note: string | null; createdBy: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("custom_metric_entries.upsert", (client) =>
    client.from("custom_metric_entries").upsert({ host_id: hostId, metric_id: input.metricId, day: input.day, value: input.value, note: input.note, created_by: input.createdBy }, { onConflict: "metric_id,day" })
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* ------------------------------------------------------ build requests */

interface RequestRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  requested_by: string | null;
  created_at: string;
}

const PRIORITIES = new Set<string>(["low", "medium", "high"]);
const STATUSES = new Set<string>(["new", "scoping", "building", "done", "declined"]);

export const getBuildRequests = cache(async function getBuildRequests(hostId: string): Promise<BuildRequest[]> {
  const { data } = await runQueryOr<RequestRow[]>("build_requests.list", [], (client) =>
    client.from("build_requests").select("id, title, description, priority, status, requested_by, created_at").eq("host_id", hostId).order("created_at", { ascending: false }).limit(100).returns<RequestRow[]>()
  );
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: (PRIORITIES.has(r.priority) ? r.priority : "medium") as BuildRequest["priority"],
    status: (STATUSES.has(r.status) ? r.status : "new") as BuildRequest["status"],
    requestedBy: r.requested_by,
    createdAt: r.created_at,
  }));
});

export async function insertBuildRequest(hostId: string, input: { title: string; description: string | null; priority: BuildRequest["priority"]; requestedBy: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("build_requests.insert", (client) =>
    client.from("build_requests").insert({ host_id: hostId, title: input.title, description: input.description, priority: input.priority, requested_by: input.requestedBy }).select("id").single<{ id: string }>()
  );
  return outcome.ok ? { ok: true, id: outcome.data.id } : { ok: false, error: outcome.failure.reason };
}

export async function setBuildRequestStatus(hostId: string, id: string, status: BuildRequest["status"]): Promise<boolean> {
  const result = await runMutation("build_requests.status", (client) => client.from("build_requests").update({ status }).eq("host_id", hostId).eq("id", id));
  return result.ok;
}
