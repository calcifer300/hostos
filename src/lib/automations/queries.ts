import "server-only";
import { runQueryOr } from "@/lib/supabase/server";

interface AutomationSettingRow {
  automation_id: string;
  enabled: boolean;
}

/**
 * Map of automation id -> enabled. Missing ids mean "off". Never throws: an
 * un-migrated or unreachable install simply shows every rule disabled, which
 * is the safe direction to fail — an automation is never reported as running
 * when we can't confirm it.
 */
export async function getAutomationSettings(userEmail: string): Promise<Record<string, boolean>> {
  const { data } = await runQueryOr<AutomationSettingRow[]>("automation_settings.list", [], (client) =>
    client
      .from("automation_settings")
      .select("automation_id, enabled")
      .eq("user_email", userEmail)
      .returns<AutomationSettingRow[]>()
  );

  const out: Record<string, boolean> = {};
  for (const row of data) {
    out[row.automation_id] = row.enabled;
  }
  return out;
}
