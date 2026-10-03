"use client";

import * as React from "react";
import { AlertTriangle, PlugZap, RefreshCw, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Serializable projection of `BackendHealth` — the server passes only what
 * the banner renders, never the raw failure (which can carry query details
 * that don't belong in the browser).
 */
export interface BackendStatusView {
  state: "ok" | "unconfigured" | "degraded" | "unknown";
  kind: "unconfigured" | "missing_table" | "unreachable" | "unauthorized" | "query_error" | null;
}

interface Copy {
  title: string;
  body: string;
  icon: typeof AlertTriangle;
  /** Retrying only helps when the cause is transient. */
  retryable: boolean;
}

/**
 * What the operator sees instead of a raw `TypeError: fetch failed`. Each
 * message names the actual cause and the next action — an empty dashboard
 * and an unreachable database look identical without this.
 */
function copyFor(status: BackendStatusView): Copy | null {
  if (status.state === "ok" || status.state === "unknown") return null;

  switch (status.kind) {
    case "unconfigured":
      return {
        title: "HostOS isn't connected to a database yet",
        body: "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart the dev server. Everything below is empty until then.",
        icon: Settings2,
        retryable: false,
      };
    case "unauthorized":
      return {
        title: "HostOS can't authenticate with the database",
        body: "The Supabase service-role key was rejected. Re-copy it from Project Settings → API keys; a publishable key here reads back as empty tables.",
        icon: AlertTriangle,
        retryable: true,
      };
    case "unreachable":
    default:
      return {
        title: "Can't reach the HostOS database",
        body: "Your data is safe — this view just can't load it right now. If the Supabase project is paused, resume it from the Supabase dashboard and retry.",
        icon: PlugZap,
        retryable: true,
      };
  }
}

/**
 * Sits above page content whenever the data layer is degraded. Rendering it
 * in the shell (rather than per card) means every route inherits the
 * explanation, including ones whose only symptom would be a blank list.
 */
export function BackendStatusBanner({ status }: { status: BackendStatusView }) {
  const router = useRouter();
  const [retrying, setRetrying] = React.useState(false);
  const copy = copyFor(status);

  if (!copy) return null;

  const Icon = copy.icon;

  function retry() {
    setRetrying(true);
    // A refresh re-runs the server render; the circuit breaker's cooldown
    // decides whether that actually reaches Supabase or short-circuits again.
    router.refresh();
    window.setTimeout(() => setRetrying(false), 1500);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-bg px-4 py-3 md:mx-8"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug">{copy.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
      {copy.retryable && (
        <Button variant="ghost" size="sm" onClick={retry} disabled={retrying} className="shrink-0">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          {retrying ? "Retrying" : "Retry"}
        </Button>
      )}
    </div>
  );
}
