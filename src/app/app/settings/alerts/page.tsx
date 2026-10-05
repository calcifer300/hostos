import type { Metadata } from "next";
import { AlertSettingsCard } from "@/components/settings/alert-settings";
import { getAlertSettings } from "@/lib/alerts/queries";
import { isEmailConfigured } from "@/lib/email/send";
import { canManageSettings, getCurrentHostId } from "@/lib/host/context";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsSettingsPage() {
  const hostId = await getCurrentHostId();
  const [settings, canEdit] = await Promise.all([getAlertSettings(hostId), canManageSettings()]);
  return <AlertSettingsCard initial={settings} canEdit={canEdit} emailConfigured={isEmailConfigured()} />;
}
