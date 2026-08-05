import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured, isUndefinedTableError } from "@/lib/supabase/server";

interface AutomationSettingRow {
  automation_id: string;
  enabled: boolean;
}

/**
 * Map of automation id → enabled. Missing ids mean "off". Never throws: an
 * un-migrated install simply shows every rule disabled.
 */
export async function getAutomationSettings(userEmail: string): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured()) return {};

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("automation_settings")
      .select("automation_id, enabled")
      .eq("user_email", userEmail);

    if (error) {
      if (!isUndefinedTableError(error)) {
        console.error("[automations] Failed to load settings:", error.message);
      }
      return {};
    }

    const out: Record<string, boolean> = {};
    for (const row of (data ?? []) as AutomationSettingRow[]) {
      out[row.automation_id] = row.enabled;
    }
    return out;
  } catch (err) {
    console.error("[automations] Failed to load settings:", err);
    return {};
  }
}
