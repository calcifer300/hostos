import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { IntegrationProvider } from "@/lib/modules";

/**
 * Integration connections (migration 0022): one row per platform link per
 * workspace. Credentials are encrypted before they reach the database and
 * only ever decrypted inside a server action or sync job — nothing returns
 * them to a page.
 */

export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending";

export interface IntegrationConnection {
  id: string;
  provider: IntegrationProvider;
  externalId: string | null;
  displayName: string | null;
  status: ConnectionStatus;
  hasCredentials: boolean;
  settings: Record<string, unknown>;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionRow {
  id: string;
  provider: string;
  external_id: string | null;
  display_name: string | null;
  status: string;
  credentials_encrypted?: string | null;
  settings: Record<string, unknown> | null;
  last_synced_at: string | null;
  last_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, provider, external_id, display_name, status, credentials_encrypted, settings, last_synced_at, last_error, connected_by, created_at, updated_at";
const STATUSES = new Set<string>(["connected", "disconnected", "error", "pending"]);

function rowToConnection(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    externalId: row.external_id,
    displayName: row.display_name,
    status: (STATUSES.has(row.status) ? row.status : "pending") as ConnectionStatus,
    hasCredentials: Boolean(row.credentials_encrypted),
    settings: row.settings ?? {},
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    connectedBy: row.connected_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getConnections = cache(async function getConnections(hostId: string): Promise<IntegrationConnection[]> {
  const { data } = await runQueryOr<ConnectionRow[]>("integration_connections.list", [], (client) =>
    client.from("integration_connections").select(COLUMNS).eq("host_id", hostId).order("created_at", { ascending: true }).returns<ConnectionRow[]>()
  );
  return data.map(rowToConnection);
});

export async function getConnection(hostId: string, id: string): Promise<IntegrationConnection | null> {
  const { data } = await runQueryOr<ConnectionRow | null>("integration_connections.get", null, (client) =>
    client.from("integration_connections").select(COLUMNS).eq("host_id", hostId).eq("id", id).maybeSingle<ConnectionRow>()
  );
  return data ? rowToConnection(data) : null;
}

/** The decrypted credential for a sync job. Null when absent or unreadable (rotated key). */
export async function getConnectionSecret(hostId: string, id: string): Promise<string | null> {
  const { data } = await runQueryOr<{ credentials_encrypted: string | null } | null>("integration_connections.secret", null, (client) =>
    client.from("integration_connections").select("credentials_encrypted").eq("host_id", hostId).eq("id", id).maybeSingle<{ credentials_encrypted: string | null }>()
  );
  if (!data?.credentials_encrypted) return null;
  return decryptSecret(data.credentials_encrypted);
}

export interface UpsertConnectionInput {
  hostId: string;
  provider: IntegrationProvider;
  externalId?: string | null;
  displayName?: string | null;
  /** Plaintext; encrypted here, never stored raw. */
  secret?: string | null;
  settings?: Record<string, unknown>;
  status?: ConnectionStatus;
  connectedBy?: string | null;
}

export async function upsertConnection(input: UpsertConnectionInput): Promise<IntegrationConnection | null> {
  const row: Record<string, unknown> = {
    host_id: input.hostId,
    provider: input.provider,
    external_id: input.externalId ?? null,
    display_name: input.displayName ?? null,
    status: input.status ?? (input.secret ? "connected" : "pending"),
    settings: input.settings ?? {},
    connected_by: input.connectedBy ?? null,
    last_error: null,
  };
  if (input.secret) row.credentials_encrypted = encryptSecret(input.secret);

  const outcome = await runQuery<ConnectionRow | null>("integration_connections.upsert", (client) =>
    client
      .from("integration_connections")
      .upsert(row, { onConflict: "host_id,provider,external_id" })
      .select(COLUMNS)
      .maybeSingle<ConnectionRow>()
  );

  if (outcome.ok && outcome.data) return rowToConnection(outcome.data);

  // The unique index coalesces null external ids, which upsert's onConflict
  // cannot express; fall back to update-then-insert for that case.
  if (!input.externalId) {
    const existing = await runQueryOr<ConnectionRow | null>("integration_connections.find", null, (client) =>
      client.from("integration_connections").select(COLUMNS).eq("host_id", input.hostId).eq("provider", input.provider).is("external_id", null).maybeSingle<ConnectionRow>()
    );
    if (existing.data) {
      const updated = await runQuery<ConnectionRow | null>("integration_connections.update", (client) =>
        client.from("integration_connections").update(row).eq("id", existing.data!.id).select(COLUMNS).maybeSingle<ConnectionRow>()
      );
      return updated.ok && updated.data ? rowToConnection(updated.data) : null;
    }
    const inserted = await runQuery<ConnectionRow | null>("integration_connections.insert", (client) =>
      client.from("integration_connections").insert(row).select(COLUMNS).maybeSingle<ConnectionRow>()
    );
    return inserted.ok && inserted.data ? rowToConnection(inserted.data) : null;
  }
  return null;
}

export async function markConnection(hostId: string, id: string, patch: { status?: ConnectionStatus; lastError?: string | null; lastSyncedAt?: string | null }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.lastError !== undefined) update.last_error = patch.lastError;
  if (patch.lastSyncedAt !== undefined) update.last_synced_at = patch.lastSyncedAt;
  await runMutation("integration_connections.mark", (client) => client.from("integration_connections").update(update).eq("host_id", hostId).eq("id", id));
}

export async function deleteConnection(hostId: string, id: string): Promise<boolean> {
  const result = await runMutation("integration_connections.delete", (client) => client.from("integration_connections").delete().eq("host_id", hostId).eq("id", id));
  return result.ok;
}
