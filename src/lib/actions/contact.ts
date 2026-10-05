"use server";

import { headers } from "next/headers";
import { runMutation } from "@/lib/supabase/server";
import { CONTACT_INTERESTS } from "@/components/marketing/data";
import { SITE } from "@/lib/site";

export interface ContactResult {
  ok: boolean;
  error?: string;
}

const MAX = { name: 120, email: 200, company: 120, message: 4000 } as const;

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/**
 * Stores a landing-page enquiry. Public, unauthenticated, and therefore
 * strict about input: lengths are capped, the interest must come from the
 * form's own list, and the email must look like one. A failed write is
 * reported honestly rather than swallowed — a person who typed a message
 * deserves to know whether it arrived.
 */
export async function submitContactRequest(formData: FormData): Promise<ContactResult> {
  const fullName = clean(formData.get("fullName"), MAX.name);
  const email = clean(formData.get("email"), MAX.email).toLowerCase();
  const company = clean(formData.get("company"), MAX.company);
  const interestRaw = clean(formData.get("interest"), 80);
  const message = typeof formData.get("message") === "string" ? String(formData.get("message")).trim().slice(0, MAX.message) : "";

  // Honeypot: a real person never fills a field they cannot see.
  if (clean(formData.get("website"), 10)) return { ok: true };

  if (!fullName) return { ok: false, error: "Tell us your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email address doesn't look right." };
  if (message.length < 10) return { ok: false, error: "Add a few more words so we know how to help." };

  const interest = (CONTACT_INTERESTS as readonly string[]).includes(interestRaw) ? interestRaw : null;
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  const result = await runMutation("contact_requests.insert", (client) =>
    client.from("contact_requests").insert({
      full_name: fullName,
      email,
      company: company || null,
      interest,
      message,
      source: "landing",
      user_agent: userAgent,
    })
  );

  if (!result.ok) {
    return {
      ok: false,
      error: `We couldn't save your message just now. Email ${SITE.contactEmail} and we'll pick it up directly.`,
    };
  }

  return { ok: true };
}
