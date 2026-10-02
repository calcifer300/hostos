"use client";

import * as React from "react";

/**
 * "Install on Mobile": the steps for putting this page on a phone's home screen so it opens like an app. Shown open the
 * first time (with a choice to hide it); after "Don't show this again" it stays as a small button that opens it again.
 * It picks iPhone or Android from the device and never appears inside the installed app.
 */

const STORE = "cc_install_hidden";

type Platform = "ios" | "android";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-[18px] w-[18px] align-[-4px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-[18px] w-[18px] align-[-4px]" fill="currentColor" aria-label="Menu">
      <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-[18px] w-[18px] align-[-4px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Plus">
      <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-left">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-accent-foreground">{n}</span>
      <span className="text-[13.5px] leading-snug">{children}</span>
    </li>
  );
}

export function InstallGuide() {
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(true);
  const [platform, setPlatform] = React.useState<Platform>("ios");
  const [installed, setInstalled] = React.useState(false);
  const [prompt, setPrompt] = React.useState<{ prompt: () => Promise<void> } | null>(null);

  // Which phone this is, whether the app is already installed, and whether the guide was hidden are only known in the browser, so
  // they are read once after the page loads (reading them during the server render would not match what the phone shows).
  React.useEffect(() => {
    const ua = navigator.userAgent || "";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    let hidden = false;
    try { hidden = window.localStorage.getItem(STORE) === "1"; } catch { /* private mode: show it */ }
    /* eslint-disable react-hooks/set-state-in-effect */
    setPlatform(/android/i.test(ua) ? "android" : "ios");
    setInstalled(standalone);
    setOpen(!hidden);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as unknown as { prompt: () => Promise<void> }); };
    window.addEventListener("beforeinstallprompt", before);
    return () => window.removeEventListener("beforeinstallprompt", before);
  }, []);

  if (!ready || installed) return null;

  function hideForever() {
    try { window.localStorage.setItem(STORE, "1"); } catch { /* it just shows again next time */ }
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground">
        <span aria-hidden>📱</span> Install on Mobile
      </button>
    );
  }

  return (
    <section className="mt-5 w-full rounded-2xl border border-border bg-card p-4 text-center shadow-[var(--shadow-card)]" aria-label="Install on Mobile">
      <div className="mb-1 flex items-center justify-center gap-2">
        <span aria-hidden className="text-lg">📱</span>
        <h2 className="text-[15px] font-semibold tracking-tight">Install on Mobile</h2>
      </div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">Welcome, Matt. Put Colorado Cruisers Pulse on your phone&rsquo;s home screen. It opens like an app, full screen, with one tap.</p>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1" role="tablist">
        {(["ios", "android"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={platform === id} onClick={() => setPlatform(id)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${platform === id ? "bg-card shadow" : "text-muted-foreground"}`}>
            {id === "ios" ? "iPhone" : "Android"}
          </button>
        ))}
      </div>

      {platform === "ios" ? (
        <ol className="space-y-2.5">
          <Step n={1}>Open this page in <b>Safari</b> (not inside another app).</Step>
          <Step n={2}>Tap the <b>Share</b> button <ShareIcon /> at the bottom of the screen.</Step>
          <Step n={3}>Scroll down and tap <b>Add to Home Screen</b> <PlusIcon />.</Step>
          <Step n={4}>Tap <b>Add</b>. The Colorado Cruisers icon is now on your home screen.</Step>
        </ol>
      ) : (
        <ol className="space-y-2.5">
          <Step n={1}>Open this page in <b>Chrome</b>.</Step>
          {prompt ? (
            <Step n={2}>Tap the button below, then <b>Install</b>.</Step>
          ) : (
            <Step n={2}>Tap the menu <DotsIcon /> in the top-right corner.</Step>
          )}
          {prompt ? null : <Step n={3}>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</Step>}
          <Step n={prompt ? 3 : 4}>Tap <b>Install</b>. The Colorado Cruisers icon is now on your home screen.</Step>
        </ol>
      )}

      {platform === "android" && prompt ? (
        <button type="button" onClick={() => { void prompt.prompt(); }} className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-foreground active:scale-[.98]">Install Now</button>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <button type="button" onClick={hideForever} className="text-[12.5px] font-medium text-muted-foreground underline-offset-2 hover:underline">Don&rsquo;t show this again</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium">Close</button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">It stays available any time under &ldquo;Install on Mobile&rdquo; on this screen.</p>
    </section>
  );
}
