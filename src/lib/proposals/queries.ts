import "server-only";
import { cache } from "react";
import { runMutation, runQuery, runQueryOr } from "@/lib/supabase/server";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { isProposalStatus, normalizeProposal, type ProposalDoc, type ProposalEvent, type ProposalRow, type ProposalStatus } from "@/lib/proposals/types";

/**
 * The Proposal Center's reads and writes (migration 0037).
 *
 * Every read is total: before the migration, or with nothing saved, the list
 * is empty rather than the page failing. A stored document is always made
 * whole against the house story, so a proposal written before a section
 * existed still renders.
 */

interface Raw {
  id: string;
  title: string;
  client_company: string;
  client_contact: string;
  client_email: string;
  industry: string;
  status: string;
  doc: unknown;
  notes: string;
  share_token: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id,title,client_company,client_contact,client_email,industry,status,doc,notes,share_token,version,created_by,updated_by,created_at,updated_at";

function toRow(r: Raw): ProposalRow {
  return {
    id: r.id,
    title: r.title,
    clientCompany: r.client_company ?? "",
    clientContact: r.client_contact ?? "",
    clientEmail: r.client_email ?? "",
    industry: r.industry ?? "",
    status: isProposalStatus(r.status) ? r.status : "draft",
    doc: normalizeProposal(r.doc, HOUSE_PROPOSAL),
    notes: r.notes ?? "",
    shareToken: r.share_token,
    version: typeof r.version === "number" ? r.version : 1,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listProposals = cache(async function listProposals(): Promise<{ rows: ProposalRow[]; degraded: boolean }> {
  const { data, degraded } = await runQueryOr<Raw[]>("proposals.list", [], (client) =>
    client.from("proposals").select(COLUMNS).order("updated_at", { ascending: false }).limit(200).returns<Raw[]>()
  );
  return { rows: data.map(toRow), degraded };
});

export const getProposal = cache(async function getProposal(id: string): Promise<ProposalRow | null> {
  const { data } = await runQueryOr<Raw[]>("proposals.get", [], (client) =>
    client.from("proposals").select(COLUMNS).eq("id", id).limit(1).returns<Raw[]>()
  );
  return data.length ? toRow(data[0]) : null;
});

/** The shared client view: found by its secret token, never by id. */
export async function getProposalByToken(token: string): Promise<ProposalRow | null> {
  if (!token || token.length < 16) return null;
  const { data } = await runQueryOr<Raw[]>("proposals.byToken", [], (client) =>
    client.from("proposals").select(COLUMNS).eq("share_token", token).limit(1).returns<Raw[]>()
  );
  return data.length ? toRow(data[0]) : null;
}

export interface NewProposal {
  title: string;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  industry: string;
  doc: ProposalDoc;
  notes?: string;
  by: string | null;
}

export async function insertProposal(input: NewProposal): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const outcome = await runQuery<{ id: string }[]>("proposals.insert", (client) =>
    client
      .from("proposals")
      .insert({
        title: input.title,
        client_company: input.clientCompany,
        client_contact: input.clientContact,
        client_email: input.clientEmail,
        industry: input.industry,
        doc: input.doc,
        notes: input.notes ?? "",
        status: "draft",
        created_by: input.by,
        updated_by: input.by,
      })
      .select("id")
      .returns<{ id: string }[]>()
  );
  if (!outcome.ok) return { ok: false, error: outcome.failure.hint ?? "Could not create the proposal." };
  const id = outcome.data?.[0]?.id;
  return id ? { ok: true, id } : { ok: false, error: "The proposal was not created." };
}

export async function updateProposal(
  id: string,
  patch: Partial<{
    title: string;
    clientCompany: string;
    clientContact: string;
    clientEmail: string;
    industry: string;
    status: ProposalStatus;
    doc: ProposalDoc;
    notes: string;
    shareToken: string | null;
    version: number;
  }>,
  by: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = { updated_by: by, updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.clientCompany !== undefined) row.client_company = patch.clientCompany;
  if (patch.clientContact !== undefined) row.client_contact = patch.clientContact;
  if (patch.clientEmail !== undefined) row.client_email = patch.clientEmail;
  if (patch.industry !== undefined) row.industry = patch.industry;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.doc !== undefined) row.doc = patch.doc;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.shareToken !== undefined) row.share_token = patch.shareToken;
  if (patch.version !== undefined) row.version = patch.version;

  const result = await runMutation("proposals.update", (client) => client.from("proposals").update(row).eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteProposal(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runMutation("proposals.delete", (client) => client.from("proposals").delete().eq("id", id));
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/* ------------------------------------------------------------ versions */

export async function snapshotVersion(proposalId: string, version: number, doc: ProposalDoc, by: string | null): Promise<void> {
  // A failed snapshot must never fail the save it is protecting.
  await runMutation("proposals.snapshot", (client) =>
    client.from("proposal_versions").insert({ proposal_id: proposalId, version, doc, saved_by: by })
  );
}

export interface VersionRow { version: number; savedBy: string | null; savedAt: string }

export async function listVersions(proposalId: string): Promise<VersionRow[]> {
  const { data } = await runQueryOr<{ version: number; saved_by: string | null; saved_at: string }[]>("proposals.versions", [], (client) =>
    client.from("proposal_versions").select("version,saved_by,saved_at").eq("proposal_id", proposalId).order("version", { ascending: false }).limit(50).returns<{ version: number; saved_by: string | null; saved_at: string }[]>()
  );
  return data.map((r) => ({ version: r.version, savedBy: r.saved_by, savedAt: r.saved_at }));
}

export async function getVersionDoc(proposalId: string, version: number): Promise<ProposalDoc | null> {
  const { data } = await runQueryOr<{ doc: unknown }[]>("proposals.version.get", [], (client) =>
    client.from("proposal_versions").select("doc").eq("proposal_id", proposalId).eq("version", version).limit(1).returns<{ doc: unknown }[]>()
  );
  return data.length ? normalizeProposal(data[0].doc, HOUSE_PROPOSAL) : null;
}

/* ------------------------------------------------------------- analytics */

export async function recordEvent(proposalId: string, kind: string, detail = ""): Promise<void> {
  await runMutation("proposals.event", (client) =>
    client.from("proposal_events").insert({ proposal_id: proposalId, kind: kind.slice(0, 40), detail: detail.slice(0, 200) })
  );
}

export async function listEvents(proposalId: string): Promise<ProposalEvent[]> {
  const { data } = await runQueryOr<{ kind: string; detail: string; at: string }[]>("proposals.events", [], (client) =>
    client.from("proposal_events").select("kind,detail,at").eq("proposal_id", proposalId).order("at", { ascending: false }).limit(100).returns<{ kind: string; detail: string; at: string }[]>()
  );
  return data.map((r) => ({ kind: r.kind, detail: r.detail, at: r.at }));
}

/** Opens per proposal, for the list page. */
export async function viewCounts(): Promise<Record<string, { views: number; last: string | null }>> {
  const { data } = await runQueryOr<{ proposal_id: string; at: string }[]>("proposals.viewCounts", [], (client) =>
    client.from("proposal_events").select("proposal_id,at").eq("kind", "view").order("at", { ascending: false }).limit(1000).returns<{ proposal_id: string; at: string }[]>()
  );
  const out: Record<string, { views: number; last: string | null }> = {};
  for (const r of data) {
    const entry = out[r.proposal_id] ?? { views: 0, last: null };
    entry.views += 1;
    if (!entry.last) entry.last = r.at;
    out[r.proposal_id] = entry;
  }
  return out;
}
