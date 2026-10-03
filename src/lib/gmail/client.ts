import "server-only";
import { UpstreamResponseError, fetchWithTimeout } from "@/lib/http";
import type { SyncedEmail } from "@/types/gmail";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

/**
 * Bounded so a hung Gmail request can't hold a sync open indefinitely — Node's
 * `fetch` applies no timeout of its own, and this runs inside a request
 * handler. A transport failure surfaces as UpstreamUnavailableError (named and
 * retryable) rather than a bare `TypeError: fetch failed`.
 */
async function gmailFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetchWithTimeout("Gmail API", `${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    timeoutMs: 15_000,
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new UpstreamResponseError(
        "Gmail API",
        403,
        "Make sure the Gmail API is enabled for this project in Google Cloud Console."
      );
    }
    const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new UpstreamResponseError("Gmail API", res.status, body || res.statusText);
  }

  return res.json();
}

/** IDs of the most recent inbox messages, newest first. */
/**
 * Restricted to Turo's own sending domains via Gmail's search syntax —
 * without this, "most recent 15 inbox messages" pulls in whatever else
 * the host's personal inbox happens to receive, none of which belongs in
 * a Turo-operations feed.
 */
const TURO_SENDER_QUERY = "from:(turo.com OR mail.turo.com)";

export async function listRecentMessageIds(
  accessToken: string,
  maxResults = 15
): Promise<string[]> {
  const data = (await gmailFetch(
    accessToken,
    `/messages?maxResults=${maxResults}&labelIds=INBOX&q=${encodeURIComponent(TURO_SENDER_QUERY)}`
  )) as { messages?: { id: string }[] };

  return (data.messages ?? []).map((m) => m.id);
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBody(part: GmailMessagePart | undefined): { text: string | null; html: string | null } {
  if (!part) return { text: null, html: null };

  if (part.mimeType === "text/plain" && part.body?.data) {
    return { text: decodeBase64Url(part.body.data), html: null };
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return { text: null, html: decodeBase64Url(part.body.data) };
  }

  for (const child of part.parts ?? []) {
    const found = extractBody(child);
    if (found.text || found.html) return found;
  }

  return { text: null, html: null };
}

function parseFromHeader(value: string | undefined): { name: string | null; email: string | null } {
  if (!value) return { name: null, email: null };
  const match = value.match(/^\s*"?([^"<]*)"?\s*<?([^<>\s]+@[^<>\s]+)?>?\s*$/);
  const name = match?.[1]?.trim() || null;
  const email = match?.[2]?.trim() || (value.includes("@") ? value.trim() : null);
  return { name: name || email, email };
}

/**
 * Best-effort parse of a Turo-style subject line ("New message from Andrew
 * about your Tesla Model 3"). Falls back to nulls — this is a heuristic,
 * not a guarantee, same spirit as the rest of v0.1's staged connectors.
 */
function guessGuestAndVehicle(subject: string | null, fromName: string | null) {
  const vehicleMatch = subject?.match(/(?:your|the)\s+([A-Z][\w-]*(?:\s+[A-Z0-9][\w-]*){0,3})(?:\s+trip)?/);
  return {
    guestName: fromName,
    vehicle: vehicleMatch?.[1]?.trim() ?? null,
  };
}

export async function fetchMessage(
  accessToken: string,
  userEmail: string,
  id: string
): Promise<SyncedEmail> {
  const raw = (await gmailFetch(accessToken, `/messages/${id}?format=full`)) as GmailMessage;

  const headers = raw.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

  const { name: fromName, email: fromEmail } = parseFromHeader(getHeader("From"));
  const subject = getHeader("Subject") ?? null;

  const { text, html } = extractBody(raw.payload);
  const body = text ?? (html ? stripHtml(html) : null) ?? raw.snippet ?? null;

  const { guestName, vehicle } = guessGuestAndVehicle(subject, fromName);

  return {
    id: raw.id,
    userEmail,
    threadId: raw.threadId ?? null,
    fromName,
    fromEmail,
    subject,
    snippet: raw.snippet ?? null,
    body,
    receivedAt: raw.internalDate
      ? new Date(Number(raw.internalDate)).toISOString()
      : new Date().toISOString(),
    isUnread: (raw.labelIds ?? []).includes("UNREAD"),
    guestName,
    vehicle,
    syncedAt: new Date().toISOString(),
  };
}
