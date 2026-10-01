import "server-only";
import { cache } from "react";
import { runMutation, runQueryOr } from "@/lib/supabase/server";
import { normalizeSnapshot, type CommandSnapshot } from "@/lib/command/snapshot";

/**
 * The workspace's Command Center snapshot (migration 0038). Reads never throw: before the migration, or before
 * the extension has sent anything, the answer is simply "no snapshot yet".
 */

interface Row {
  snapshot: unknown;
  built_at: string;
  received_at: string;
}

export interface StoredSnapshot {
  snapshot: CommandSnapshot;
  receivedAt: string;
}

export const getCommandSnapshot = cache(async function getCommandSnapshot(hostId: string): Promise<StoredSnapshot | null> {
  const { data } = await runQueryOr<Row[]>("command_snapshots.get", [], (client) =>
    client.from("command_snapshots").select("snapshot, built_at, received_at").eq("host_id", hostId).limit(1).returns<Row[]>()
  );
  if (!data.length) return null;
  const snapshot = normalizeSnapshot(data[0].snapshot);
  return snapshot ? { snapshot, receivedAt: data[0].received_at } : null;
});

/** Stores the latest snapshot for a workspace, replacing the previous one. */
export async function saveCommandSnapshot(hostId: string, snapshot: CommandSnapshot, sizeBytes: number) {
  return runMutation("command_snapshots.save", (client) =>
    client.from("command_snapshots").upsert({
      host_id: hostId,
      snapshot,
      version: snapshot.version,
      built_at: new Date(snapshot.builtAt || Date.now()).toISOString(),
      received_at: new Date().toISOString(),
      size_bytes: sizeBytes,
    })
  );
}

/** The snapshot and the moment it is being read, taken here so a page component stays pure. */
export async function getCommandView(hostId: string): Promise<{ stored: StoredSnapshot | null; now: number }> {
  const stored = await getCommandSnapshot(hostId);
  return { stored, now: Date.now() };
}
