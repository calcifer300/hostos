"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { isProposalStatus, normalizeProposal, type ProposalStatus } from "@/lib/proposals/types";
import {
  deleteProposal,
  getProposal,
  getProposalByToken,
  getVersionDoc,
  insertProposal,
  recordEvent,
  snapshotVersion,
  updateProposal,
} from "@/lib/proposals/queries";

/**
 * The Proposal Center's writes.
 *
 * A server action is a public endpoint, so every one of these re-checks that
 * the caller is the Founder — the middleware gate in front of /app is the
 * first door, not the only one.
 *
 * Sharing is deliberate and per proposal: a proposal has no token until
 * someone asks for one, and revoking it takes the link dead immediately.
 */

export interface ProposalResult { ok: boolean; error?: string; id?: string; token?: string }

async function gate(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  return isFounderEmail(email) ? { ok: true, email } : { ok: false, error: "Only the Founder can manage proposals." };
}

const hint = (e: string) => (/relation|proposals|does not exist/i.test(e) ? "Run migration 0037 (proposals) to enable the Proposal Center." : e);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function refresh(id?: string) {
  revalidatePath("/app/proposals");
  if (id) {
    revalidatePath(`/app/proposals/${id}`);
    revalidatePath(`/app/proposals/${id}/edit`);
  }
}

/** A new proposal, starting from the house story. */
export async function createProposal(input: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };

  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const company = str(raw.clientCompany, 120);
  if (!company) return { ok: false, error: "Name the client company." };

  const doc = normalizeProposal({ ...HOUSE_PROPOSAL, client: { ...HOUSE_PROPOSAL.client, company, contact: str(raw.clientContact, 120), email: str(raw.clientEmail, 160), industry: str(raw.industry, 80) } }, HOUSE_PROPOSAL);

  const result = await insertProposal({
    title: str(raw.title, 160) || `${company} — operations partnership`,
    clientCompany: company,
    clientContact: str(raw.clientContact, 120),
    clientEmail: str(raw.clientEmail, 160),
    industry: str(raw.industry, 80),
    doc,
    by: who.email,
  });
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(result.id);
  return { ok: true, id: result.id };
}

/** Duplicate: the same story, a fresh client, back to draft, no share link. */
export async function duplicateProposal(id: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const source = await getProposal(str(id, 60));
  if (!source) return { ok: false, error: "That proposal no longer exists." };

  const result = await insertProposal({
    title: `${source.title} (copy)`,
    clientCompany: source.clientCompany,
    clientContact: source.clientContact,
    clientEmail: source.clientEmail,
    industry: source.industry,
    doc: source.doc,
    notes: source.notes,
    by: who.email,
  });
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(result.id);
  return { ok: true, id: result.id };
}

/** Save the document. The previous version is kept first, so a save can always be undone. */
export async function saveProposal(id: unknown, doc: unknown, meta: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const current = await getProposal(proposalId);
  if (!current) return { ok: false, error: "That proposal no longer exists." };

  // Keep what is being replaced before replacing it.
  await snapshotVersion(proposalId, current.version, current.doc, who.email);

  const next = normalizeProposal(doc, HOUSE_PROPOSAL);
  const m = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;

  const result = await updateProposal(
    proposalId,
    {
      doc: next,
      version: current.version + 1,
      title: str(m.title, 160) || current.title,
      clientCompany: next.client.company || current.clientCompany,
      clientContact: next.client.contact,
      clientEmail: next.client.email,
      industry: next.client.industry,
      notes: typeof m.notes === "string" ? str(m.notes, 8000) : current.notes,
    },
    who.email
  );
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId };
}

export async function setProposalStatus(id: unknown, status: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  if (!isProposalStatus(status)) return { ok: false, error: "Unknown status." };
  const proposalId = str(id, 60);
  const result = await updateProposal(proposalId, { status: status as ProposalStatus }, who.email);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId };
}

export async function saveProposalNotes(id: unknown, notes: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const result = await updateProposal(proposalId, { notes: str(notes, 8000) }, who.email);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId };
}

/**
 * Turn sharing on for one proposal. The token is 32 random bytes; the link is
 * the only way in, and nothing else about the Proposal Center becomes public.
 */
export async function shareProposal(id: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const current = await getProposal(proposalId);
  if (!current) return { ok: false, error: "That proposal no longer exists." };
  if (current.shareToken) return { ok: true, id: proposalId, token: current.shareToken };

  const token = randomBytes(24).toString("base64url");
  const result = await updateProposal(proposalId, { shareToken: token, status: current.status === "draft" ? "sent" : current.status }, who.email);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId, token };
}

/** Revoke: the link dies immediately. */
export async function unshareProposal(id: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const result = await updateProposal(proposalId, { shareToken: null }, who.email);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId };
}

/** Roll the document back to a kept version. The current one is snapshotted first. */
export async function restoreProposalVersion(id: unknown, version: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const v = typeof version === "number" ? version : Number(version);
  if (!Number.isFinite(v)) return { ok: false, error: "Unknown version." };

  const current = await getProposal(proposalId);
  if (!current) return { ok: false, error: "That proposal no longer exists." };
  const doc = await getVersionDoc(proposalId, v);
  if (!doc) return { ok: false, error: "That version is no longer kept." };

  await snapshotVersion(proposalId, current.version, current.doc, who.email);
  const result = await updateProposal(proposalId, { doc, version: current.version + 1 }, who.email);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh(proposalId);
  return { ok: true, id: proposalId };
}

export async function removeProposal(id: unknown): Promise<ProposalResult> {
  const who = await gate();
  if (!who.ok) return { ok: false, error: who.error };
  const proposalId = str(id, 60);
  const result = await deleteProposal(proposalId);
  if (!result.ok) return { ok: false, error: hint(result.error) };
  refresh();
  return { ok: true };
}

/**
 * Called from the shared client view. Deliberately ungated — it is how we
 * learn the client opened it — but it takes the share token, not an id, so
 * it can only ever record against a proposal whose secret link the caller
 * already holds, and it writes nothing but an event.
 */
export async function recordProposalView(token: unknown, detail: unknown): Promise<{ ok: boolean }> {
  const shareToken = str(token, 80);
  if (shareToken.length < 16) return { ok: false };
  const proposal = await getProposalByToken(shareToken);
  if (!proposal) return { ok: false };
  await recordEvent(proposal.id, "view", str(detail, 200));
  // The first open moves a sent proposal to "viewed" on the sales board.
  if (proposal.status === "sent") await updateProposal(proposal.id, { status: "viewed" }, proposal.updatedBy);
  return { ok: true };
}
