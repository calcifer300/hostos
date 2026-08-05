"use client";

import * as React from "react";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { setAutomationEnabled } from "@/lib/actions/automations";
import type { AutomationDefinition } from "@/lib/automations/definitions";

export function AutomationRow({
  automation,
  initialEnabled,
}: {
  automation: AutomationDefinition;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);

    startTransition(async () => {
      const res = await setAutomationEnabled(automation.id, next);
      if (!res.ok) {
        setEnabled(!next); // roll back
        setError(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-medium tracking-tight">{automation.name}</p>
            {!automation.implemented && <Badge variant="neutral">Not wired yet</Badge>}
            {automation.requiresReview && (
              <Badge variant="warning">
                <ShieldAlert className="h-3 w-3" />
                Acts on your behalf
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {automation.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">{automation.triggerLabel}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded-md bg-muted px-2 py-1">{automation.action}</span>
          </div>

          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        </div>

        <button
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Disable" : "Enable"} ${automation.name}`}
          onClick={toggle}
          disabled={isPending}
          className={cn(
            "relative mt-1 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-accent" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-1"
            )}
            style={{ height: 18, width: 18 }}
          />
          {isPending && (
            <Loader2 className="absolute -right-5 h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
