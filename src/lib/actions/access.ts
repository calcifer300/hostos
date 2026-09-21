"use server";

import { auth } from "@/auth";
import { decideAccessRequest, upsertAccessRequest } from "@/lib/access-requests";
import { sendEmail } from "@/lib/email/send";
import { FOUNDER_EMAILS, isFounderEmail } from "@/lib/roles/constants";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A stranger asks for access. Stored, and the Founder is emailed when a mail provider is configured. */
export async function requestAccess(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = str(form.get("email"), 160).toLowerCase();
  const name = str(form.get("name"), 80);
  const business = str(form.get("business"), 120);
  const message = str(form.get("message"), 800);
  if (!EMAIL.test(email)) return { ok: false, error: "Enter the email you will sign in with." };
  if (!name) return { ok: false, error: "Tell us your name." };
  if (isFounderEmail(email)) return { ok: true };
  const r = await upsertAccessRequest({ email, name, business, message });
  if (!r.ok) return { ok: false, error: /table/i.test(r.error) ? "Access requests aren't set up yet (migration 0034)." : r.error };
  try {
    await sendEmail([...FOUNDER_EMAILS], `HostOS access request — ${name}`, `${name} <${email}> asked for access to HostOS.\n\nBusiness: ${business || "—"}\n\n${message || "(no message)"}\n\nApprove or deny at Settings → Website → Access requests.`);
  } catch (err) {
    console.error("[access] notify failed:", err);
  }
  return { ok: true };
}

/** The Founder decides. */
export async function decideAccess(id: string, status: "approved" | "denied"): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const by = session?.user?.email ?? "";
  if (!isFounderEmail(by)) return { ok: false, error: "Only the Founder can decide." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Bad id." };
  const r = await decideAccessRequest(id, status, by);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
