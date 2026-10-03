import "server-only";
import { fetchJsonOrThrow } from "@/lib/http";

/**
 * One place that knows how to send mail.
 *
 * The digest route grew its own copy of this first; alert dispatch would have
 * been the second, and two senders means two answers to "why did nothing
 * arrive" — one of which is always the stale one.
 */

export type SendOutcome =
  | { status: "sent"; recipients: number }
  /** Nothing wrong: no provider configured, or nobody to send to. */
  | { status: "skipped"; reason: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM_EMAIL?.trim());
}

/**
 * A missing provider is a normal state, not an error.
 *
 * The caller stays green and reports that it sent nothing, rather than
 * alarming on an optional integration nobody has set up yet. What it must not
 * do is claim success — hence the discriminated result rather than a boolean.
 */
export async function sendEmail(
  to: string[],
  subject: string,
  text: string
): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  // MAIL_FROM_EMAIL, falling back to the digest's older name so an existing
  // deployment doesn't lose its digest the moment this ships.
  const from = process.env.MAIL_FROM_EMAIL?.trim() || process.env.DIGEST_FROM_EMAIL?.trim();

  if (!apiKey) return { status: "skipped", reason: "RESEND_API_KEY is not set." };
  if (!from) return { status: "skipped", reason: "MAIL_FROM_EMAIL is not set." };

  const recipients = to.map((address) => address.trim()).filter(Boolean);
  if (recipients.length === 0) return { status: "skipped", reason: "No recipients." };

  await fetchJsonOrThrow("Resend", "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: recipients, subject, text }),
    timeoutMs: 15_000,
  });

  return { status: "sent", recipients: recipients.length };
}
