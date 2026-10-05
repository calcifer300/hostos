"use server";

import { auth } from "@/auth";
import { canUseQuickNotes, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { deleteQuickNote, insertQuickNote, updateQuickNote, type QuickNote } from "@/lib/notes/queries";

/**
 * Quick notes are a person's own scratchpad, so nothing here revalidates a
 * path: the panel keeps its own state and the layout re-reads on the next
 * navigation. Owners and admins only — the same check the panel uses to
 * decide whether to render at all, re-derived here because a server action
 * is a public endpoint.
 */

export type NoteActionResult = { ok: true; note?: QuickNote } | { ok: false; error: string };

const MAX_BODY = 4000;

async function gate(): Promise<{ email: string; hostId: string | null } | { error: string }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Sign in to keep notes." };
  if (!(await canUseQuickNotes())) return { error: "Quick notes are for owners and admins." };
  const hostId = (await hasNoFleetAccess()) ? null : await getCurrentHostId();
  return { email, hostId };
}

const migrationHint = (error: string) => (/relation|quick_notes|does not exist/i.test(error) ? "Run migration 0026 to enable quick notes." : error);

export async function addQuickNote(body: string): Promise<NoteActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const text = typeof body === "string" ? body.trim().slice(0, MAX_BODY) : "";
  if (!text) return { ok: false, error: "Write something first." };
  const outcome = await insertQuickNote(g.email, g.hostId, text);
  return outcome.ok ? { ok: true, note: outcome.note } : { ok: false, error: migrationHint(outcome.error) };
}

export async function editQuickNote(id: string, body: string): Promise<NoteActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const text = typeof body === "string" ? body.trim().slice(0, MAX_BODY) : "";
  if (!text) return { ok: false, error: "A note can't be empty — delete it instead." };
  const outcome = await updateQuickNote(g.email, String(id).slice(0, 40), { body: text });
  return outcome.ok ? { ok: true } : { ok: false, error: migrationHint(outcome.error) };
}

export async function pinQuickNote(id: string, pinned: boolean): Promise<NoteActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const outcome = await updateQuickNote(g.email, String(id).slice(0, 40), { pinned: Boolean(pinned) });
  return outcome.ok ? { ok: true } : { ok: false, error: migrationHint(outcome.error) };
}

export async function removeQuickNote(id: string): Promise<NoteActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const outcome = await deleteQuickNote(g.email, String(id).slice(0, 40));
  return outcome.ok ? { ok: true } : { ok: false, error: migrationHint(outcome.error) };
}
