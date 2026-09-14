import "server-only";
import { cache } from "react";
import { runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * The cross-module activity stream (migration 0019). trip_events remains the
 * fleet's authoritative change log; this is the human-readable feed the
 * dashboard's "Recent events" widget reads, and the only feed the restaurant
 * module and the Butler write to.
 */

export type ActivityModule = "fleet" | "restaurant" | "commerce" | "butler" | "system" | "team";

export interface ActivityEvent {
  id: string;
  module: ActivityModule;
  event: string;
  description: string;
  href: string | null;
  actorEmail: string | null;
  occurredAt: string;
}

interface ActivityRow {
  id: string;
  module: string;
  event: string;
  description: string;
  href: string | null;
  actor_email: string | null;
  occurred_at: string;
}

const MODULES = new Set<string>(["fleet", "restaurant", "butler", "system", "team", "commerce"]);

export const getActivity = cache(async function getActivity(hostId: string, limit = 40): Promise<ActivityEvent[]> {
  const { data } = await runQueryOr<ActivityRow[]>("activity_log.list", [], (client) =>
    client
      .from("activity_log")
      .select("id, module, event, description, href, actor_email, occurred_at")
      .eq("host_id", hostId)
      .order("occurred_at", { ascending: false })
      .limit(limit)
      .returns<ActivityRow[]>()
  );

  return data.map((row) => ({
    id: row.id,
    module: (MODULES.has(row.module) ? row.module : "system") as ActivityModule,
    event: row.event,
    description: row.description,
    href: row.href,
    actorEmail: row.actor_email,
    occurredAt: row.occurred_at,
  }));
});

export interface LogActivityInput {
  hostId: string;
  module: ActivityModule;
  event: string;
  description: string;
  href?: string | null;
  actorEmail?: string | null;
  payload?: Record<string, unknown> | null;
}

/** Best-effort: a failed activity write never fails the action that caused it. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  await runQuery("activity_log.insert", (client) =>
    client.from("activity_log").insert({
      host_id: input.hostId,
      module: input.module,
      event: input.event,
      description: input.description.slice(0, 500),
      href: input.href ?? null,
      actor_email: input.actorEmail ?? null,
      payload: input.payload ?? null,
    })
  );
}
