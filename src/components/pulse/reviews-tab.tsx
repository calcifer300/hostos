"use client";

import * as React from "react";
import type { ReviewRow, ReviewsSection } from "@/lib/command/snapshot";

/**
 * Reviews: the guests whose trip ended in the last 14 days and who have not reviewed the host yet, so Matthew can ask them.
 * Read-only like the rest of the page: nothing is sent from here. Each card has the message to copy (he sends it himself in
 * Turo, from the trip's own conversation) and a link that opens that conversation. A tick on a card is kept on this device only.
 */

const STORE = "cc_reviews_done";
const HOUR = 3600000;

const when = (value: string | number | null, zone: string): string | null => {
  if (value === null || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      return ok;
    } catch {
      return false;
    }
  }
}

function Stars({ n }: { n: number }) {
  return <span className={n >= 5 ? "text-success" : n === 4 ? "text-warning" : "text-danger"} aria-label={`${n} stars`}>{"★".repeat(n)}<span className="text-muted-foreground/40">{"★".repeat(Math.max(0, 5 - n))}</span></span>;
}

function Chip({ tone, children }: { tone: "blue" | "amber" | "grey" | "red"; children: React.ReactNode }) {
  const cls = tone === "blue" ? "bg-accent/10 text-accent" : tone === "amber" ? "bg-warning/10 text-warning" : tone === "red" ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}>{children}</span>;
}

export function ReviewsTab({ reviews, zone, now, fresh }: { reviews: ReviewsSection | null; zone: string; now: number; fresh: { at: string | null } }) {
  const [done, setDone] = React.useState<Record<string, number>>({});
  const [copied, setCopied] = React.useState<string | null>(null);

  // ticks are remembered on this device only; they are read once after the page loads
  React.useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORE) || "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw && typeof raw === "object") setDone(raw as Record<string, number>);
    } catch { /* private mode: no ticks kept */ }
  }, []);

  if (!reviews) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">Reviews have not been read yet. They appear once the scanning PC has run with the latest HostOS.</p>;
  }

  const tick = (id: string) => {
    const next = { ...done };
    if (next[id]) delete next[id]; else next[id] = Date.now();
    setDone(next);
    try { window.localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* not kept */ }
  };
  const copy = async (row: ReviewRow) => {
    if (await copyText(row.draft)) { setCopied(row.tripId); window.setTimeout(() => setCopied((current) => (current === row.tripId ? null : current)), 2000); }
  };

  const open = reviews.toAsk.filter((row) => !row.windowClosed);
  const closed = reviews.toAsk.filter((row) => row.windowClosed);
  const list = [...open, ...closed];
  const s = reviews.summary;
  const readAge = fresh.at ? Math.max(0, now - Date.parse(fresh.at)) : null;
  const sample = reviews.toAsk[0]?.draft ?? "Hi {Name}, thank you for choosing Colorado Cruisers! If you enjoyed your trip, an honest review on Turo helps our small business a lot, and it only takes a minute. Thanks again, and safe travels! – Matt";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Reviews to Ask For · {open.length}</h2>
        <span className="text-[12px] text-muted-foreground">
          Last {reviews.lookbackDays} days · {s.reviewed} of {s.trips} guests reviewed{s.average !== null ? ` · average ${s.average.toFixed(2)}★` : ""}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-12 lg:h-[clamp(320px,calc(100dvh-330px),600px)]">
        <section className="flex min-h-0 flex-col rounded-[20px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)] h-[420px] lg:col-span-8 lg:h-full">
          <div className="mb-2 flex shrink-0 items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-tight">No Review Yet</h3>
            <span className="text-[12px] text-muted-foreground">oldest first · window closes soonest</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin]">
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((row) => {
                  const ticked = Boolean(done[row.tripId]);
                  return (
                    <li key={row.tripId} className={`py-2.5 ${ticked ? "opacity-50" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold">{row.guest ?? "Guest"}</div>
                          <div className="truncate text-[12px] text-muted-foreground">{[row.vehicle, row.plate].filter(Boolean).join(" · ")}</div>
                          <div className="text-[11.5px] text-muted-foreground">Ended {row.ended} · {row.daysAgo === 0 ? "today" : row.daysAgo === 1 ? "yesterday" : `${row.daysAgo} days ago`}</div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {row.status === "unchecked" ? <Chip tone="grey">Not Checked Yet</Chip> : null}
                          {row.windowClosed ? <Chip tone="grey">Past Turo&rsquo;s {reviews.windowDays}-Day Window</Chip> : <Chip tone={row.windowLeft <= 2 ? "red" : "amber"}>{row.windowLeft} {row.windowLeft === 1 ? "Day" : "Days"} Left</Chip>}
                          {row.asked ? <Chip tone="blue">Asked {row.asked.label}</Chip> : null}
                          {row.saysRated ? <Chip tone="amber">Guest Says They Rated</Chip> : null}
                        </div>
                      </div>
                      {row.saysRated ? <p className="mt-1 text-[11px] italic text-muted-foreground">“{row.saysRated.quote}”</p> : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => void copy(row)} className="rounded-full bg-accent px-3 py-1 text-[11.5px] font-semibold text-accent-foreground active:scale-[.97]">
                          {copied === row.tripId ? "Copied ✓" : "Copy Message"}
                        </button>
                        {row.threadUrl ? (
                          <a href={row.threadUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 text-[11.5px] font-semibold hover:bg-muted">Open Conversation ↗</a>
                        ) : null}
                        <button type="button" onClick={() => tick(row.tripId)} className="rounded-full border border-border px-3 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted" aria-pressed={ticked}>
                          {ticked ? "✓ Done on This Device" : "Mark Done"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-[13px] text-muted-foreground"><span className="text-success">✔</span> Every guest from the last {reviews.lookbackDays} days has reviewed.</p>
            )}
          </div>
        </section>

        <div className="grid min-h-0 gap-3 lg:col-span-4 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
          <section className="rounded-[20px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
            <h3 className="mb-1.5 text-[15px] font-semibold tracking-tight">The Message</h3>
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-[12px] leading-snug">{sample.replace(/^Hi [^,]+,/, "Hi {Name},").replace(/with the .+?, an honest/, "with the {Car}, an honest")}</p>
            <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground/80">Copy it on a guest&rsquo;s card, open the conversation and send it from Turo. It asks for an honest review only: Turo does not allow asking for a star rating or offering anything in return.</p>
          </section>
          <section className="flex min-h-0 flex-col rounded-[20px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)] h-[260px] lg:h-full">
            <div className="mb-2 flex shrink-0 items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold tracking-tight">Already Reviewed</h3>
              <span className="text-[12px] text-muted-foreground">{reviews.reviewed.length}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin]">
              {reviews.reviewed.length ? (
                <ul className="divide-y divide-border">
                  {reviews.reviewed.map((row) => (
                    <li key={row.tripId} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold">{row.guest ?? "Guest"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{row.vehicle} · {row.reviewed ?? row.ended}</div>
                      </div>
                      <div className="shrink-0 text-[12px]">{row.rating !== null ? <Stars n={row.rating} /> : <span className="text-muted-foreground">No rating</span>}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-[12px] text-muted-foreground">None in the last {reviews.lookbackDays} days yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <p className="text-[10.5px] leading-snug text-muted-foreground/80">
        {fresh.at ? `Guest reviews last read ${when(fresh.at, zone)}${readAge !== null && readAge > 2 * HOUR ? ". That is a while ago: keep Turo open on the scanning PC to refresh them" : ""}.` : "Guest reviews have not been read yet: keep Turo open on the scanning PC."}
        {" "}A guest is matched to their trip by their Turo account, not by name.
        {s.unchecked ? ` ${s.unchecked} trip${s.unchecked === 1 ? " is" : "s are"} not checked yet because the guest's account has not been read for it.` : ""}
        {closed.length ? ` Trips past Turo's ${reviews.windowDays}-day window are listed last: a guest can no longer review them.` : ""}
        {s.blank ? ` ${s.blank} guest${s.blank === 1 ? "" : "s"} never rated (Turo posted a blank review).` : ""}
      </p>
    </div>
  );
}
