import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Web & domains (migration 0025): the websites and domains a workspace looks
 * after — its own and its clients'. Registrar and hosting are recorded by
 * name (GoDaddy first); HostOS does the checking itself (lib/web/check.ts),
 * so a property is useful the moment it is typed in, API or no API.
 */

export type PropertyStatus = "up" | "down" | "unknown";

export interface WebProperty {
  id: string;
  hostId: string;
  name: string;
  domain: string;
  siteUrl: string | null;
  registrar: string;
  hosting: string | null;
  clientName: string | null;
  domainExpiresAt: string | null;
  autoRenew: boolean;
  sslExpiresAt: string | null;
  sslIssuer: string | null;
  status: PropertyStatus;
  httpStatus: number | null;
  responseMs: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  host_id: string;
  name: string;
  domain: string;
  site_url: string | null;
  registrar: string;
  hosting: string | null;
  client_name: string | null;
  domain_expires_at: string | null;
  auto_renew: boolean;
  ssl_expires_at: string | null;
  ssl_issuer: string | null;
  status: string;
  http_status: number | null;
  response_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, host_id, name, domain, site_url, registrar, hosting, client_name, domain_expires_at, auto_renew, ssl_expires_at, ssl_issuer, status, http_status, response_ms, last_checked_at, last_error, notes, created_at, updated_at";

const STATUSES = new Set<string>(["up", "down", "unknown"]);

function rowToProperty(row: Row): WebProperty {
  return {
    id: row.id,
    hostId: row.host_id,
    name: row.name,
    domain: row.domain,
    siteUrl: row.site_url,
    registrar: row.registrar,
    hosting: row.hosting,
    clientName: row.client_name,
    domainExpiresAt: row.domain_expires_at,
    autoRenew: row.auto_renew,
    sslExpiresAt: row.ssl_expires_at,
    sslIssuer: row.ssl_issuer,
    status: (STATUSES.has(row.status) ? row.status : "unknown") as PropertyStatus,
    httpStatus: row.http_status,
    responseMs: row.response_ms,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getProperties = cache(async function getProperties(hostId: string): Promise<WebProperty[]> {
  const { data } = await runQueryOr<Row[]>("web_properties.list", [], (client) =>
    client.from("web_properties").select(COLUMNS).eq("host_id", hostId).order("name", { ascending: true }).limit(500).returns<Row[]>()
  );
  return data.map(rowToProperty);
});

export const getProperty = cache(async function getProperty(hostId: string, id: string): Promise<WebProperty | null> {
  const { data } = await runQueryOr<Row | null>("web_properties.get", null, (client) =>
    client.from("web_properties").select(COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<Row>()
  );
  return data ? rowToProperty(data) : null;
});

export interface PropertyWrite {
  name: string;
  domain: string;
  siteUrl: string | null;
  registrar: string;
  hosting: string | null;
  clientName: string | null;
  domainExpiresAt: string | null;
  autoRenew: boolean;
  notes: string | null;
}

function toRow(input: PropertyWrite) {
  return {
    name: input.name,
    domain: input.domain,
    site_url: input.siteUrl,
    registrar: input.registrar,
    hosting: input.hosting,
    client_name: input.clientName,
    domain_expires_at: input.domainExpiresAt,
    auto_renew: input.autoRenew,
    notes: input.notes,
  };
}

export async function insertProperty(hostId: string, input: PropertyWrite): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }>("web_properties.insert", (client) =>
    client.from("web_properties").insert({ host_id: hostId, ...toRow(input) }).select("id").single<{ id: string }>()
  );
  if (!outcome.ok) return { ok: false, error: outcome.failure.reason };
  return { ok: true, id: outcome.data.id };
}

export async function updateProperty(hostId: string, id: string, input: PropertyWrite): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("web_properties.update", (client) => client.from("web_properties").update(toRow(input)).eq("host_id", hostId).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteProperty(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("web_properties.delete", (client) => client.from("web_properties").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}

export interface CheckOutcome {
  status: PropertyStatus;
  httpStatus: number | null;
  responseMs: number | null;
  sslExpiresAt: string | null;
  sslIssuer: string | null;
  error: string | null;
}

export async function recordCheck(hostId: string, id: string, outcome: CheckOutcome): Promise<boolean> {
  const result = await runMutation("web_properties.check", (client) =>
    client
      .from("web_properties")
      .update({
        status: outcome.status,
        http_status: outcome.httpStatus,
        response_ms: outcome.responseMs,
        ssl_expires_at: outcome.sslExpiresAt,
        ssl_issuer: outcome.sslIssuer,
        last_checked_at: new Date().toISOString(),
        last_error: outcome.error,
      })
      .eq("host_id", hostId)
      .eq("id", id)
  );
  return result.ok;
}

/** Days until an ISO date, floored; null when unknown. */
export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - now) / 86_400_000);
}
