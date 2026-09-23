import type { CustomMetric } from "@/lib/custom/queries";

/**
 * Pure metric maths, importable from client components — the queries module
 * is server-only and must never reach a browser bundle.
 */

/** Where a metric stands against its target, using the latest entry. */
export function metricStatus(m: CustomMetric): { latest: number | null; onTarget: boolean | null; changePct: number | null } {
  const latest = m.entries.length > 0 ? m.entries[m.entries.length - 1].value : null;
  const previous = m.entries.length > 1 ? m.entries[m.entries.length - 2].value : null;
  const onTarget = latest === null || m.target === null ? null : m.direction === "up" ? latest >= m.target : latest <= m.target;
  const changePct = latest !== null && previous !== null && previous !== 0 ? ((latest - previous) / Math.abs(previous)) * 100 : null;
  return { latest, onTarget, changePct };
}
