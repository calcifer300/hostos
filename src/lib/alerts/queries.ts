import "server-only";
import { runQuery, runQueryOr, runMutation } from "@/lib/supabase/server";

/**
 * Per-fleet alert delivery: what a fleet wants emailed, and what already was.
 *
 * Fleet-scoped rather than per-person because the alerts describe the FLEET's
 * problems. Two co-hosts watching one fleet want the same licence warning to
 * reach the same inbox, not two private copies each configured separately —
 * which is the mistake knowledge_base and automation_settings made and
 * migration 0013 had to undo.
 */

export interface AlertSettings {
  emailEnabled: boolean;
  recipients: string[];
  onLicence: boolean;
  onPremier: boolean;
  onProfit: boolean;
}

interface AlertSettingsRow {
  email_enabled: boolean;
  recipients: string[] | null;
  on_licence: boolean;
  on_premier: boolean;
  on_profit: boolean;
}

/**
 * Off, with all three kinds selected.
 *
 * Deliberately: turning email ON is the deliberate act, and once someone does
 * that they almost certainly want all three rather than an empty selection
 * that silently sends nothing.
 */
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  emailEnabled: false,
  recipients: [],
  onLicence: true,
  onPremier: true,
  onProfit: true,
};

const COLUMNS = "email_enabled, recipients, on_licence, on_premier, on_profit";

function rowToSettings(row: AlertSettingsRow): AlertSettings {
  return {
    emailEnabled: row.email_enabled,
    recipients: row.recipients ?? [],
    onLicence: row.on_licence,
    onPremier: row.on_premier,
    onProfit: row.on_profit,
  };
}

/** Never throws: an un-migrated or unreachable install means "email is off". */
export async function getAlertSettings(hostId: string): Promise<AlertSettings> {
  const { data } = await runQueryOr<AlertSettingsRow | null>("alert_settings.get", null, (client) =>
    client.from("alert_settings").select(COLUMNS).eq("host_id", hostId).maybeSingle<AlertSettingsRow>()
  );

  return data ? rowToSettings(data) : DEFAULT_ALERT_SETTINGS;
}

export async function saveAlertSettings(
  hostId: string,
  settings: AlertSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  return runMutation("alert_settings.upsert", (client) =>
    client.from("alert_settings").upsert(
      {
        host_id: hostId,
        email_enabled: settings.emailEnabled,
        recipients: settings.recipients,
        on_licence: settings.onLicence,
        on_premier: settings.onPremier,
        on_profit: settings.onProfit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host_id" }
    )
  );
}

/**
 * Alert keys this fleet has already been emailed about.
 *
 * Returns null — not an empty set — when the lookup fails, so the caller can
 * tell "nothing sent yet" from "I don't know what was sent". Those must behave
 * differently: the first means send, the second means DON'T, because a dispatch
 * that can't read its own history would re-send everything every five minutes.
 */
export async function getDeliveredKeys(hostId: string): Promise<Set<string> | null> {
  const outcome = await runQuery<{ alert_key: string }[]>("alert_deliveries.list", (client) =>
    client
      .from("alert_deliveries")
      .select("alert_key")
      .eq("host_id", hostId)
      .eq("channel", "email")
      .returns<{ alert_key: string }[]>()
  );

  if (!outcome.ok) return null;
  return new Set(outcome.data.map((row) => row.alert_key));
}

/**
 * Records what just went out.
 *
 * Written AFTER a successful send, so a provider outage means the alert is
 * retried on the next poll rather than silently dropped. The opposite ordering
 * loses alerts permanently, which is the worse failure for something whose
 * entire job is telling you about a licence before a pickup.
 */
export async function recordDeliveries(
  hostId: string,
  keys: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (keys.length === 0) return { ok: true };

  return runMutation("alert_deliveries.insert", (client) =>
    client.from("alert_deliveries").upsert(
      keys.map((alert_key) => ({ host_id: hostId, alert_key, channel: "email" })),
      { onConflict: "host_id,alert_key,channel" }
    )
  );
}
