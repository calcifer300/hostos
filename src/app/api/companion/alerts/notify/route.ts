import { NextResponse, type NextRequest } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { getRiskQueues } from "@/lib/risk/queries";
import { buildAlerts, type CompanionAlert } from "@/lib/alerts/build";
import { getAlertSettings, getDeliveredKeys, recordDeliveries } from "@/lib/alerts/queries";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

/**
 * Emails a fleet's outstanding alerts, once each.
 *
 * POST, not GET, because it sends mail. The Companion calls it on the same
 * five-minute cadence it already polls the summary on — which is the right
 * driver: alerts describe changes in scraped data, so when the extension
 * isn't running there is nothing new to alert about anyway.
 *
 * The whole design rests on alert_deliveries. An unverified license stays
 * unverified for hours; polling every five minutes without a record of what
 * was sent would email the same trip twelve times an hour, which is how
 * people learn to filter your alerts into a folder they never open.
 */

function renderAlertEmail(fleetName: string, alerts: CompanionAlert[]): string {
  const byKind = {
    licence: alerts.filter((a) => a.kind === "licence"),
    premier: alerts.filter((a) => a.kind === "premier"),
    profit: alerts.filter((a) => a.kind === "profit"),
  };

  const section = (title: string, items: CompanionAlert[]) =>
    items.length === 0 ? "" : `${title}\n${items.map((a) => `  · ${a.body}`).join("\n")}\n\n`;

  return (
    `${fleetName} — ${alerts.length} ${alerts.length === 1 ? "item needs" : "items need"} attention\n\n` +
    section("UNVERIFIED LICENSES (pickup within 24h)", byKind.licence) +
    section("ZERO-DEDUCTIBLE BOOKINGS", byKind.premier) +
    section("BELOW $0.20 PER MILE", byKind.profit) +
    "Open HostOS: https://hostoscollective.com/app/risk\n\n" +
    "You're getting this because email alerts are on for this fleet.\n" +
    "Turn them off or change who receives them in Settings."
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  const settings = await getAlertSettings(host.id);

  if (!settings.emailEnabled) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Email alerts are off for this fleet." });
  }
  if (settings.recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "No recipients configured." });
  }
  if (!isEmailConfigured()) {
    // Said plainly. A deployment with no mail provider should not look like a
    // fleet with nothing wrong.
    return NextResponse.json({
      ok: true,
      sent: 0,
      reason: "No email provider is configured on this deployment (RESEND_API_KEY / MAIL_FROM_EMAIL).",
    });
  }

  try {
    const queues = await getRiskQueues(host.id, host.timezone);

    const allowed: Record<CompanionAlert["kind"], boolean> = {
      licence: settings.onLicence,
      premier: settings.onPremier,
      profit: settings.onProfit,
    };
    const wanted = buildAlerts(queues).filter((alert) => allowed[alert.kind]);

    // Null means the delivery history could not be read. Send NOTHING rather
    // than risk re-sending everything — a dispatch that can't remember what it
    // sent would mail the same list every five minutes.
    const delivered = await getDeliveredKeys(host.id);
    if (delivered === null) {
      return NextResponse.json(
        { ok: false, error: "Couldn't read the delivery history, so nothing was sent.", retryable: true },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }

    const fresh = wanted.filter((alert) => !delivered.has(alert.key));
    if (fresh.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, outstanding: wanted.length, reason: "Nothing new." });
    }

    const fleetName = host.name ?? "Your fleet";
    const subject =
      fresh.length === 1
        ? `${fleetName}: ${fresh[0].title}`
        : `${fleetName}: ${fresh.length} items need attention`;

    const outcome = await sendEmail(settings.recipients, subject, renderAlertEmail(fleetName, fresh));

    if (outcome.status === "skipped") {
      return NextResponse.json({ ok: true, sent: 0, reason: outcome.reason });
    }

    // Recorded only AFTER the send succeeded. The other order loses an alert
    // permanently on a provider blip, which is the worse failure for something
    // whose job is warning you about a license before a pickup.
    const recorded = await recordDeliveries(host.id, fresh.map((a) => a.key));
    if (!recorded.ok) {
      // The mail is already gone; say so, and note the risk of a repeat rather
      // than reporting a clean success.
      console.error(`[alerts/notify] Sent but could not record: ${recorded.error}`);
      return NextResponse.json({
        ok: true,
        sent: fresh.length,
        warning: "Sent, but the delivery record failed — these may repeat on the next poll.",
      });
    }

    return NextResponse.json({
      ok: true,
      sent: fresh.length,
      recipients: outcome.recipients,
      outstanding: wanted.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[alerts/notify] ${message}`);
    return NextResponse.json(
      { ok: false, error: "Couldn't send alerts.", detail: message.slice(0, 200), retryable: true },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
}
