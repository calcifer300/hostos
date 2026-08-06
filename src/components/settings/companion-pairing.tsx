"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateCompanionApiKey } from "@/lib/actions/host";

/**
 * Minimal pairing UI for the HostOS Companion extension — not the full
 * Aurora "Connectors" grid from the mockup yet, just a functional home for
 * the token until the visual phase redesigns this page.
 */
export function CompanionPairing({ hasKey }: { hasKey: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [connected, setConnected] = React.useState(hasKey);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateCompanionApiKey();
      if (res.ok && res.apiKey) {
        setApiKey(res.apiKey);
        setConnected(true);
      } else {
        setError(res.error ?? "Could not generate a pairing code.");
      }
    });
  }

  async function handleCopy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <KeyRound className="h-[15px] w-[15px] text-accent" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight">HostOS Companion</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {connected
              ? "Paired — the extension can sync trips to this account."
              : "Not paired yet. Generate a code and enter it in the extension."}
          </p>
        </div>
      </div>

      {apiKey && (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] text-muted-foreground">
            Copy this now — it won&rsquo;t be shown again. Paste it into the Companion extension&rsquo;s
            Synchronization tab.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2.5">
            <code className="flex-1 truncate text-[12.5px]">{apiKey}</code>
            <button
              onClick={handleCopy}
              aria-label="Copy pairing key"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}

      <div className="mt-4">
        <Button
          variant={connected ? "secondary" : "primary"}
          size="sm"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : connected ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          {isPending ? "Generating…" : connected ? "Regenerate pairing code" : "Generate pairing code"}
        </Button>
      </div>
    </div>
  );
}
