import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Unified notifications (migration 0019).
 *
 * Every module writes here through `notify()` and nowhere else, so the bell,
 * the Notifications page, the digest and the Companion all agree on what
 * happened. Dedupe keys make the writers idempotent — a sync loop that runs
 * every minute can call notify() every minute and the same fact lands once.
 */

export type NotificationKind = "trip" | "message" | "alert" | "restaurant" | "order" | "store" | "web" | "cafe" | "salon" | "custom" | "task" | "system" | "butler";
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export interface Notification {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

const COLUMNS = "id, kind, severity, title, body, href, read_at, created_at";

const KINDS = new Set<string>(["trip", "message", "alert", "restaurant", "order", "store", "web", "cafe", "salon", "custom", "task", "system", "butler"]);
const SEVERITIES = new Set<string>(["info", "success", "warning", "critical"]);

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    kind: (KINDS.has(row.kind) ? row.kind : "system") as NotificationKind,
    severity: (SEVERITIES.has(row.severity) ? row.severity : "info") as NotificationSeverity,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * Notifications visible to one person on one fleet: everything addressed to
 * the whole fleet plus anything addressed to them personally. Never throws —
 * an un-migrated install shows an empty bell, not a broken shell.
 */
export const getNotifications = cache(async function getNotifications(
  hostId: string,
  userEmail: string | null,
  limit = 50
): Promise<Notification[]> {
  const { data } = await runQueryOr<NotificationRow[]>("notifications.list", [], (client) => {
    let query = client.from("notifications").select(COLUMNS).eq("host_id", hostId);
    query = userEmail ? query.or(`user_email.is.null,user_email.eq.${userEmail}`) : query.is("user_email", null);
    return query.order("created_at", { ascending: false }).limit(limit).returns<NotificationRow[]>();
  });

  return data.map(rowToNotification);
});

export const getUnreadNotificationCount = cache(async function getUnreadNotificationCount(
  hostId: string,
  userEmail: string | null
): Promise<number> {
  const { data } = await runQueryOr<number>("notifications.unread_count", 0, async (client) => {
    let query = client.from("notifications").select("id", { count: "exact", head: true }).eq("host_id", hostId).is("read_at", null);
    query = userEmail ? query.or(`user_email.is.null,user_email.eq.${userEmail}`) : query.is("user_email", null);
    const res = await query;
    return { data: res.count ?? 0, error: res.error, status: res.status };
  });
  return data;
});

export interface NotifyInput {
  hostId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: NotificationSeverity;
  /** Address one member; omit for the whole fleet. */
  userEmail?: string | null;
  /** Idempotency key. Same host + key never inserts twice. */
  dedupeKey?: string | null;
}

/**
 * Records a notification. Returns true when a row was written, false when the
 * dedupe key already existed or the write failed — callers treat both as
 * "nothing new to tell anyone", which is the safe direction.
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  const row = {
    host_id: input.hostId,
    user_email: input.userEmail ?? null,
    kind: input.kind,
    severity: input.severity ?? "info",
    title: input.title.slice(0, 200),
    body: input.body ? input.body.slice(0, 2000) : null,
    href: input.href ?? null,
    dedupe_key: input.dedupeKey ?? null,
  };

  const outcome = await runQuery("notifications.insert", (client) =>
    input.dedupeKey
      ? client.from("notifications").upsert(row, { onConflict: "host_id,dedupe_key", ignoreDuplicates: true }).select("id")
      : client.from("notifications").insert(row).select("id")
  );

  if (!outcome.ok) return false;
  return Array.isArray(outcome.data) ? outcome.data.length > 0 : true;
}

export async function markNotificationsRead(hostId: string, ids: string[] | "all", userEmail: string | null): Promise<boolean> {
  const result = await runMutation("notifications.mark_read", (client) => {
    let query = client.from("notifications").update({ read_at: new Date().toISOString() }).eq("host_id", hostId).is("read_at", null);
    if (ids !== "all") query = query.in("id", ids);
    query = userEmail ? query.or(`user_email.is.null,user_email.eq.${userEmail}`) : query.is("user_email", null);
    return query;
  });
  return result.ok;
}
