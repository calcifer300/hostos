"use client";

import * as React from "react";
import { Download, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { regenerateCompanionApiKey } from "@/lib/actions/host";

/**
 * Install-and-pair, in one place.
 *
 * This replaced a card that did nothing but generate a token. That was the
 * whole gap between "signed up" and "has data": the extension is the only
 * real source HostOS reads from, and there was no download link, no install
 * instructions, and nowhere that said an extension existed at all. A pairing
 * key on its own is not a setup flow.
 *
 * The steps are numbered and stay visible after pairing, because people
 * re-install extensions, switch machines, and hand this to a co-host.
 */
export function CompanionSetup({
  hasKey,
  canManage,
}: {
  hasKey: boolean;
  /** Viewers can see the steps; only owners and members may issue a key. */
  canManage: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(hasKey);
  const [confirmingRotate, setConfirmingRotate] = React.useState(false);

  function handleGenerate() {
    setError(null);
    setConfirmingRotate(false);
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

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3 border-b border-border p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <KeyRound className="h-[16px] w-[16px] text-accent" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-tight">HostOS Companion</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {connected
              ? "Paired. The extension syncs trips, guest messages, license status and protection plans on its own while Chrome is open."
              : "A Chrome extension that reads your fleet from Turo. Everything on your dashboard comes from it."}
          </p>
        </div>
      </div>

      <ol className="divide-y divide-border">
        <Step n={1} title="Download the extension">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            A .zip you unpack yourself — it isn&rsquo;t on the Chrome Web Store yet.
          </p>
          <a
            href="/hostos-companion.zip"
            download="hostos-companion.zip"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download HostOS Companion
          </a>
        </Step>

        <Step n={2} title="Load it into Chrome">
          <ol className="space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>
              1. Unzip the download somewhere you won&rsquo;t delete — Chrome loads the extension
              from that folder every time it starts.
            </li>
            <li className="flex flex-wrap items-center gap-1.5">
              <span>2. Open</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-foreground">
                chrome://extensions
              </code>
              <CopyButton value="chrome://extensions" label="the extensions URL" />
              <span>— Chrome blocks links to it, so paste it in the address bar.</span>
            </li>
            <li>
              3. Turn on <span className="text-foreground">Developer mode</span> (top right), click{" "}
              <span className="text-foreground">Load unpacked</span>, and pick the unzipped folder.
            </li>
          </ol>
        </Step>

        <Step n={3} title="Get your pairing key">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            This key is what ties the extension to{" "}
            <span className="text-foreground">your fleet</span>. Anyone holding it can write data
            into it, so treat it like a password.
          </p>

          {apiKey && (
            <div className="mt-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-background/50 px-3 py-2.5">
                <code className="flex-1 truncate text-[12.5px]">{apiKey}</code>
                <CopyButton value={apiKey} label="pairing key" />
              </div>
              <p className="mt-1.5 text-[12px] text-warning">
                Copy it now — it is shown once and never again.
              </p>
            </div>
          )}

          {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}

          {!canManage ? (
            <p className="mt-2.5 text-[12.5px] text-muted-foreground">
              You have read-only access to this fleet, so you can&rsquo;t issue a pairing key. Ask
              an owner for one.
            </p>
          ) : confirmingRotate ? (
            <div className="mt-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-[12.5px] leading-relaxed">
                This fleet already has a key. Generating a new one{" "}
                <span className="font-medium">immediately stops any extension using the old one</span>{" "}
                — including a co-host&rsquo;s. Continue?
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button variant="primary" size="sm" onClick={handleGenerate} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Generate a new key
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingRotate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant={connected ? "secondary" : "primary"}
              size="sm"
              className="mt-2.5"
              onClick={connected ? () => setConfirmingRotate(true) : handleGenerate}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : connected ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              {isPending ? "Generating…" : connected ? "Regenerate pairing key" : "Generate pairing key"}
            </Button>
          )}
        </Step>

        <Step n={4} title="Paste the key into the extension">
          <ol className="space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>
              1. Click the HostOS icon in Chrome&rsquo;s toolbar to open the side panel, then the{" "}
              <span className="text-foreground">Sync</span> tab.
            </li>
            <li>
              2. Paste the key and click <span className="text-foreground">Connect</span>. The
              HostOS URL is already filled in.
            </li>
            <li>
              3. Open <span className="text-foreground">turo.com</span> and leave the tab open. The
              first sync lands within a minute, and it keeps syncing by itself after that.
            </li>
          </ol>
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 p-5">
      <span
        aria-hidden
        className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold tabular-nums text-muted-foreground"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium tracking-tight">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
