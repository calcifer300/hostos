"use client";

import * as React from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveAlertPreferences } from "@/lib/actions/alerts";
import type { AlertSettings } from "@/lib/alerts/queries";

/**
 * Who gets emailed when this fleet has a problem.
 *
 * Fleet-scoped, not per-person: the alerts describe the fleet's problems, so
 * two co-hosts watching one fleet want the same warning reaching the same
 * inbox — not two private copies configured separately, which is the mistake
 * knowledge_base made and migration 0013 had to undo.
 */
export function AlertSettingsCard({
  initial,
  canEdit,
  emailConfigured,
}: {
  initial: AlertSettings;
  canEdit: boolean;
  /** False when the deployment has no mail provider — say so rather than looking healthy. */
  emailConfigured: boolean;
}) {
  const [enabled, setEnabled] = React.useState(initial.emailEnabled);
  const [recipients, setRecipients] = React.useState(initial.recipients.join(", "));
  const [onLicence, setOnLicence] = React.useState(initial.onLicence);
  const [onPremier, setOnPremier] = React.useState(initial.onPremier);
  const [onProfit, setOnProfit] = React.useState(initial.onProfit);

  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rejected, setRejected] = React.useState<string[]>([]);

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setRejected([]);

    startTransition(async () => {
      const res = await saveAlertPreferences({
        emailEnabled: enabled,
        recipients,
        onLicence,
        onPremier,
        onProfit,
      });

      if (res.rejected) setRejected(res.rejected);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    });
  }

  const KINDS: [boolean, (v: boolean) => void, string, string][] = [
    [onLicence, setOnLicence, "Unverified licences", "Pickup is within 24 hours and the licence isn't confirmed."],
    [onPremier, setOnPremier, "Zero-deductible bookings", "Damage can't be billed to the guest."],
    [onProfit, setOnProfit, "Below $0.20 a mile", "What you earn, divided by the miles included."],
  ];

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Mail className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium">Email alerts</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Sent once per trip, when something needs a person. Desktop notifications in the
            Companion are separate and stay on regardless.
          </p>
        </div>

        <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!canEdit || isPending}
            className="peer sr-only"
          />
          <span className="relative h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:left-[3px] after:top-[3px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {!emailConfigured && enabled && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12.5px] leading-relaxed text-warning">
          This deployment has no mail provider configured, so nothing will actually be sent. Set
          RESEND_API_KEY and MAIL_FROM_EMAIL.
        </p>
      )}

      {enabled && (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="alert-recipients" className="block text-[12.5px] font-medium">
              Send to
            </label>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              One or more addresses, separated by commas.
            </p>
            <input
              id="alert-recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="you@example.com, cohost@example.com"
              className="mt-2 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-accent/60 disabled:opacity-60"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[12.5px] font-medium">Alert me about</legend>
            {KINDS.map(([value, set, title, hint]) => (
              <label key={title} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => set(e.target.checked)}
                  disabled={!canEdit || isPending}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-[13px]">{title}</span>
                  <span className="block text-[12px] leading-relaxed text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {rejected.length > 0 && (
        <p className="mt-3 text-[12.5px] text-warning">
          Not a valid address, so {rejected.length === 1 ? "it was" : "they were"} dropped:{" "}
          {rejected.join(", ")}
        </p>
      )}
      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
      {saved && !error && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-success">
          <Check className="h-3.5 w-3.5" />
          Saved.
        </p>
      )}

      {canEdit ? (
        <div className="mt-4">
          <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          You have read-only access to this fleet.
        </p>
      )}
    </form>
  );
}
