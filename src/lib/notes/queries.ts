import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";

/**
 * Quick notes (migration 0026): a person's scratchpad that follows them
 * through every page and every workspace. Keyed by email, never by host —
 * a note written while looking at the Turo dashboard is still there on the
 * DoorDash one, and in another workspace altogether.
 */

export interface QuickNote {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, body, pinned, created_at, updated_at";

const rowToNote = (r: Row): QuickNote => ({ id: r.id, body: r.body, pinned: r.pinned, createdAt: r.created_at, updatedAt: r.updated_at });

/** Pinned first, then most recently edited. Empty (not an error) before migration 0026. */
export const getQuickNotes = cache(async function getQuickNotes(email: string | null): Promise<QuickNote[]> {
  if (!email) return [];
  const { data } = await runQueryOr<Row[]>("quick_notes.list", [], (client) =>
    client.from("quick_notes").select(COLUMNS).eq("user_email", email).order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(200).returns<Row[]>()
  );
  return data.map(rowToNote);
});

export async function insertQuickNote(email: string, hostId: string | null, body: string): Promise<{ ok: true; note: QuickNote } | { ok: false; error: string }> {
  const outcome = await runQuery<Row | null>("quick_notes.insert", (client) =>
    client.from("quick_notes").insert({ user_email: email, host_id: hostId, body }).select(COLUMNS).maybeSingle<Row>()
  );
  if (!outcome.ok) return { ok: false, error: outcome.failure.reason };
  if (!outcome.data) return { ok: false, error: "The note wasn't saved." };
  return { ok: true, note: rowToNote(outcome.data) };
}

/** Every write is scoped to the owner's email as well as the id, so an id alone can never reach someone else's note. */
export async function updateQuickNote(email: string, id: string, patch: { body?: string; pinned?: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("quick_notes.update", (client) => client.from("quick_notes").update(patch).eq("id", id).eq("user_email", email));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteQuickNote(email: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("quick_notes.delete", (client) => client.from("quick_notes").delete().eq("id", id).eq("user_email", email));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
