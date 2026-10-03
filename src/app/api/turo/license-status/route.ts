import { NextRequest, NextResponse } from "next/server";
import { ingestFailureResponse, requireCompanionHost } from "@/lib/api/companion-auth";
import { isUndefinedColumnError, isUndefinedTableError } from "@/lib/supabase/server";

/**
 * Driver's-license confirmation status for near-term check-ins, from the
 * Companion extension's background hostosLicenseCheck alarm (see sync.js's
 * performLicenseCheckSync) — moved off a popup-only manual button because a
 * closed popup kills any JS running inside it. Same bearer-pairing-key auth
 * as /api/turo/sync and /api/turo/messages.
 */

interface IncomingLicenseStatus {
  reservation?: string;
  submitted?: boolean | null;
  statusText?: string | null;
  /** The HOST s own deductible, scraped from the same page. See migration 0011. */
  hostDamageResponsibility?: number | null;
}

interface LicenseStatusPayload {
  licenseStatuses?: IncomingLicenseStatus[];
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host, supabase } = auth.ctx;

  let payload: LicenseStatusPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const statuses = (Array.isArray(payload.licenseStatuses) ? payload.licenseStatuses : []).filter(
    (s): s is IncomingLicenseStatus & { reservation: string } =>
      typeof s?.reservation === "string" && s.reservation.trim().length > 0
  );

  if (statuses.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const checkedAt = new Date().toISOString();
  let updated = 0;
  let failed = 0;

  try {
    for (const status of statuses) {
      const { error, count } = await supabase
        .from("trips")
        .update(
          {
            license_confirmed: status.submitted ?? null,
            license_status_text: status.statusText ?? null,
            license_checked_at: checkedAt,
            // Only written when actually read. Absent on most trips by design —
            // this is the one signal that needs rendered markup, so it exists
            // for near-term check-ins and nothing else.
            ...(typeof status.hostDamageResponsibility === "number"
              ? { host_damage_responsibility: status.hostDamageResponsibility }
              : {}),
          },
          { count: "exact" }
        )
        .eq("host_id", host.id)
        .eq("id", status.reservation);

      if (error) {
        if (isUndefinedTableError(error) || isUndefinedColumnError(error)) {
          return NextResponse.json(
            {
              error:
                "The trips table is missing its license_* columns. Run supabase/migrations/0005_license_status.sql.",
              retryable: false,
            },
            { status: 503, headers: { "Retry-After": "300" } }
          );
        }
        // One unreachable row shouldn't abandon the rest of the batch, but a
        // whole batch failing must not report `ok: true, updated: 0` either —
        // the extension would treat a total outage as "nothing to update".
        failed += 1;
        console.warn(`[turo/license-status] Failed to update ${status.reservation}: ${error.message}`);
        continue;
      }

      updated += count ?? 0;
    }

    if (failed === statuses.length) {
      return ingestFailureResponse(
        "turo/license-status",
        new Error(`All ${failed} license-status updates failed.`)
      );
    }

    return NextResponse.json({ ok: true, updated, failed });
  } catch (err) {
    return ingestFailureResponse("turo/license-status", err);
  }
}
