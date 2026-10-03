import "server-only";

import { isFounderEmail } from "@/lib/roles/constants";
import { runMutation, runQueryOr } from "@/lib/supabase/server";

/**
 * Who may sign in. HostOS is by invitation: the Founder, anyone on the team
 * roster with an email, and anyone whose access request the Founder has
 * approved. Everyone else is shown the request form instead of a workspace.
 */
export interface AccessRequest { id: string; email: string; name: string; business: string; message: string; status: "pending" | "approved" | "denied"; created_at: string }

const norm = (e: string) => e.trim().toLowerCase();

export async function isAllowedEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = norm(email);
  if (isFounderEmail(e)) return true;
  const team = await runQueryOr<{ id: string }[]>("team_profiles.byEmail", [], (c) => c.from("team_profiles").select("id").ilike("email", e).limit(1).returns<{ id: string }[]>());
  if (team.data.length > 0) return true;
  const ok = await runQueryOr<{ id: string }[]>("access_requests.approved", [], (c) => c.from("access_requests").select("id").eq("status", "approved").ilike("email", e).limit(1).returns<{ id: string }[]>());
  return ok.data.length > 0;
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  const r = await runQueryOr<AccessRequest[]>("access_requests.list", [], (c) => c.from("access_requests").select("id, email, name, business, message, status, created_at").order("created_at", { ascending: false }).limit(200).returns<AccessRequest[]>());
  return r.data;
}

export async function upsertAccessRequest(input: { email: string; name: string; business: string; message: string }) {
  const row = { email: norm(input.email), name: input.name, business: input.business, message: input.message, status: "pending" };
  return runMutation("access_requests.upsert", (c) => c.from("access_requests").upsert(row, { onConflict: "email" }).select("id"));
}

export async function decideAccessRequest(id: string, status: "approved" | "denied", by: string) {
  return runMutation("access_requests.decide", (c) => c.from("access_requests").update({ status, decided_at: new Date().toISOString(), decided_by: by }).eq("id", id).select("id"));
}
