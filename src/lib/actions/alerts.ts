"use server";

import { revalidatePath } from "next/cache";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { saveAlertSettings, type AlertSettings } from "@/lib/alerts/queries";

export interface SaveAlertsResult {
  ok: boolean;
  error?: string;
  /** Addresses that were dropped, so the UI can say which rather than silently trimming. */
  rejected?: string[];
}

/**
 * A deliberately boring address check.
 *
 * Not RFC 5322 — that regex is famously enormous and still accepts things no
 * mail provider will. This catches the actual failure mode, which is a typo or
 * a pasted name, and lets the provider reject anything exotic.
 */
function isPlausibleAddress(value: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(value);
}

export async function saveAlertPreferences(input: {
  emailEnabled: boolean;
  recipients: string;
  onLicence: boolean;
  onPremier: boolean;
  onProfit: boolean;
}): Promise<SaveAlertsResult> {
  if (await hasNoFleetAccess()) {
    return { ok: false, error: "Your fleet isn't set up yet. Reload the page and try again." };
  }

  // Alert recipients are fleet configuration: who gets told when this fleet
  // has a problem. A viewer can see it and must not be able to redirect it.
  if (!(await canEditCurrentFleet())) {
    return { ok: false, error: "You have read-only access to this fleet." };
  }

  const parts = input.recipients
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const recipients = [...new Set(parts.filter(isPlausibleAddress))];
  const rejected = parts.filter((value) => !isPlausibleAddress(value));

  // Turning alerts on with nobody to send them to is a setting that looks
  // active and does nothing — the exact failure this whole feature exists to
  // stop. Refused rather than saved.
  if (input.emailEnabled && recipients.length === 0) {
    return {
      ok: false,
      error: "Add at least one email address, or turn email alerts off.",
      rejected: rejected.length > 0 ? rejected : undefined,
    };
  }

  if (input.emailEnabled && !input.onLicence && !input.onPremier && !input.onProfit) {
    return { ok: false, error: "Choose at least one thing to be alerted about." };
  }

  const settings: AlertSettings = {
    emailEnabled: input.emailEnabled,
    recipients,
    onLicence: input.onLicence,
    onPremier: input.onPremier,
    onProfit: input.onProfit,
  };

  const result = await saveAlertSettings(await getCurrentHostId(), settings);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings");
  return { ok: true, rejected: rejected.length > 0 ? rejected : undefined };
}
