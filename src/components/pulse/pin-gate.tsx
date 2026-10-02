"use client";

import * as React from "react";
import { PULSE_NAME, PULSE_TAGLINE } from "@/lib/pulse/brand";
import { InstallGuide } from "@/components/pulse/install-guide";

/** The 4-digit key screen: big keys for a thumb, dots that fill, a shake when it is wrong. Submits by itself on the fourth digit. */
export function PinGate() {
  const [digits, setDigits] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [shake, setShake] = React.useState(false);

  const submit = React.useCallback(async (pin: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/cocruisers/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      if (response.ok) { window.location.reload(); return; }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "Could not check the key.");
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    } catch {
      setMessage("No connection. Try again.");
    } finally {
      setDigits("");
      setBusy(false);
    }
  }, []);

  const press = React.useCallback((digit: string) => {
    if (busy) return;
    setDigits((current) => {
      if (current.length >= 4) return current;
      const next = current + digit;
      if (next.length === 4) window.setTimeout(() => submit(next), 120);
      return next;
    });
  }, [busy, submit]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") setDigits((current) => current.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center py-6 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),24px)] text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/colorado-cruisers.webp" alt="Colorado Cruisers" className="mb-4 h-24 w-24 rounded-2xl bg-black object-contain p-1" />
      <h1 className="text-xl font-semibold tracking-tight">{PULSE_NAME}</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">{PULSE_TAGLINE}</p>
      <div className={`mb-3 flex gap-3 ${shake ? "pin-shake" : ""}`} aria-label="Key" role="status">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i < digits.length ? "border-accent bg-accent" : "border-muted-foreground/50"}`} />
        ))}
      </div>
      <p className="mb-5 min-h-5 text-[13px] text-danger" aria-live="polite">{message ?? ""}</p>
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button key={digit} type="button" onClick={() => press(digit)} disabled={busy} className="h-16 rounded-2xl border border-border bg-card text-2xl font-medium shadow-[var(--shadow-card)] active:scale-95 disabled:opacity-60">{digit}</button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} disabled={busy} className="h-16 rounded-2xl border border-border bg-card text-2xl font-medium shadow-[var(--shadow-card)] active:scale-95 disabled:opacity-60">0</button>
        <button type="button" onClick={() => setDigits((current) => current.slice(0, -1))} disabled={busy} className="h-16 rounded-2xl text-lg text-muted-foreground active:scale-95" aria-label="Delete">⌫</button>
      </div>
      <InstallGuide />
      <p className="mt-6 text-[11px] text-muted-foreground">A read-only view. Enter the 4-digit key once; this browser remembers it.</p>
    </main>
  );
}
