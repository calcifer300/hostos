import "server-only";
import { runQueryOr } from "@/lib/supabase/server";

interface AutomationSettingRow {
  automation_id: string;
  enabled: boolean;
}

/**
 * Map of automation id -> enabled, for one FLEET. Missing ids mean "off".
 *
 * Keyed on host_id since migration 0013. It was user_email, which meant two
 * co-hosts on one fleet each toggled their own private copy of every rule —
 * the switch looked like it applied to the fleet, and did not.
 *
 * Never throws: an un-migrated or unreachable install simply shows every rule
 * disabled, which is the safe direction to fail — an automation is never
 * reported as running when we can't confirm it.
 */
export async function getAutomationSettings(hostId: string): Promise<Record<string, boolean>> {
  const { data } = await runQueryOr<AutomationSettingRow[]>("automation_settings.list", [], (client) =>
    client
      .from("automation_settings")
      .select("automation_id, enabled")
      .eq("host_id", hostId)
      .returns<AutomationSettingRow[]>()
  );

  const out: Record<string, boolean> = {};
  for (const row of data) {
    out[row.automation_id] = row.enabled;
  }
  return out;
}
