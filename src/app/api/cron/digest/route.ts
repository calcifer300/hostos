import { NextResponse, type NextRequest } from "next/server";
import { composeDigest, renderDigestText } from "@/lib/digest/compose";
import { getServerEnv } from "@/lib/env";
import { runQueryOr } from "@/lib/supabase/server";
import { fetchJsonOrThrow, UpstreamResponseError, UpstreamUnavailableError } from "@/lib/http";

/**
 * The daily operations digest, replacing the CC build's Apps Script relay.
 *
 * Runs for EVERY fleet, not just the default one — a multi-fleet deployment
 * would otherwise silently email only the first operator. Each fleet's owners
 * get their own fleet's digest and nothing from anyone else's.
 *
 * Triggered by Vercel Cron (see vercel.json). Cron requests carry an
 * `Authorization: Bearer $CRON_SECRET` header when that variable is set;
 * without the secret configured this refuses to run rather than exposing a
 * URL that emails people on demand.
 */

interface FleetRow {
  id: string;
  name: string | null;
  timezone: string | null;
}

interface MemberRow {
  host_id: string;
  user_email: string;
  role: string;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

async function sendEmail(to: string[], subject: string, text: string): Promise<"sent" | "skipped"> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DIGEST_FROM_EMAIL?.trim();

  // No provider configured is a normal state, not an error: the digest is
  // still computed and returned in the response so it can be inspected, and
  // the cron stays green rather than alarming on a missing optional feature.
  if (!apiKey || !from || to.length === 0) return "skipped";

  await fetchJsonOrThrow("Resend", "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    timeoutMs: 15_000,
  });

  return "sent";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return unauthorized();

  const { data: fleets } = await runQueryOr<FleetRow[]>("hosts.all", [], (client) =>
    client.from("hosts").select("id, name, timezone").returns<FleetRow[]>()
  );

  const { data: members } = await runQueryOr<MemberRow[]>("host_members.all", [], (client) =>
    client.from("host_members").select("host_id, user_email, role").returns<MemberRow[]>()
  );

  const results: { fleet: string; recipients: number; delivery: string; empty: boolean }[] = [];

  for (const fleet of fleets) {
    // allSettled semantics by hand: one fleet failing must not stop the rest
    // from getting their digest.
    try {
      const digest = await composeDigest(fleet.id, fleet.timezone ?? "America/Denver");

      // Owners and members, not viewers — a read-only account shouldn't be
      // signed up for daily mail it can't act on.
      const to = members
        .filter((m) => m.host_id === fleet.id && m.role !== "viewer")
        .map((m) => m.user_email);

      const label = fleet.name ?? fleet.id.slice(0, 8);
      const subject = `${digest.subject} — ${label}`;
      const delivery = digest.empty
        ? "skipped_empty"
        : await sendEmail(to, subject, renderDigestText(digest));

      results.push({ fleet: label, recipients: to.length, delivery, empty: digest.empty });
    } catch (err) {
      const detail =
        err instanceof UpstreamUnavailableError || err instanceof UpstreamResponseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "unknown error";
      console.error(`[cron/digest] Fleet ${fleet.id} failed: ${detail}`);
      results.push({ fleet: fleet.name ?? fleet.id, recipients: 0, delivery: "failed", empty: false });
    }
  }

  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);

  return NextResponse.json({
    ok: true,
    fleets: results.length,
    emailConfigured,
    // Said plainly rather than left implicit: a green cron that silently sends
    // nothing is worse than one that reports it did nothing.
    note: emailConfigured
      ? undefined
      : "RESEND_API_KEY and DIGEST_FROM_EMAIL are not set, so digests were computed but not emailed.",
    aiConfigured: Boolean(getServerEnv().geminiApiKey),
    results,
  });
}
