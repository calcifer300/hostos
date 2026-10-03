import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateCompanion, type Host } from "@/lib/host/queries";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared bearer-key gate for the three Companion ingest routes
 * (/api/turo/sync, /messages, /license-status).
 *
 * The important behaviour here is the distinction the previous code could not
 * make. `getHostByApiKey` collapsed every failure into `null`, so the routes
 * answered 401 "Invalid or unknown pairing key" whenever Supabase was
 * unreachable — telling a correctly-paired extension that its credentials had
 * been revoked. A client that believes it is deauthenticated stops retrying
 * and asks the user to re-pair; a client that gets 503 backs off and recovers
 * on its own once the database returns. Same outage, opposite outcomes.
 */

export interface CompanionContext {
  host: Host;
  supabase: SupabaseClient;
}

export type CompanionAuth =
  | { ok: true; ctx: CompanionContext }
  | { ok: false; response: NextResponse };

function bearerToken(req: NextRequest): string | null {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * `Retry-After` is the part that makes a 503 actionable: it tells the
 * extension's alarm loop how long to wait instead of hammering a dead
 * backend on its normal cadence.
 */
function unavailable(detail: string): NextResponse {
  return NextResponse.json(
    {
      error: "HostOS can't reach its database right now. This is a server-side problem, not a pairing problem — retry shortly.",
      retryable: true,
      detail,
    },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}

/**
 * Turns an exception thrown mid-ingest into the right status for a retrying
 * client: 503 when the database dropped out (worth retrying, and the payload
 * is still valid), 502 for anything else (a genuine server bug — retrying the
 * same body will not help, so no Retry-After).
 */
export function ingestFailureResponse(scope: string, err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const transport = /fetch failed|network|socket|timeout|ECONN|ENOTFOUND|EAI_AGAIN|not configured/i.test(message);

  console.error(`[${scope}] ${transport ? "database unreachable" : "unhandled failure"}: ${message}`);

  return transport
    ? unavailable(message)
    : NextResponse.json({ error: "Failed to store the payload.", retryable: false }, { status: 502 });
}

export async function requireCompanionHost(req: NextRequest): Promise<CompanionAuth> {
  const token = bearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Authorization: Bearer <pairing key> header.", retryable: false },
        { status: 401 }
      ),
    };
  }

  const supabase = tryGetSupabaseAdmin();
  if (!supabase) {
    return { ok: false, response: unavailable("Supabase is not configured on the server.") };
  }

  const result = await authenticateCompanion(token);

  if (result.status === "unavailable") {
    return { ok: false, response: unavailable(result.failure.reason) };
  }

  if (result.status === "unknown_key") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or unknown pairing key.", retryable: false },
        { status: 401 }
      ),
    };
  }

  return { ok: true, ctx: { host: result.host, supabase } };
}
