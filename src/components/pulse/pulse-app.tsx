"use client";

import * as React from "react";
import type { CommandSnapshot, FleetCard, ScheduleSlot, TripRow, UnreadRow } from "@/lib/command/snapshot";
import { PULSE_NAME, PULSE_TAGLINE } from "@/lib/pulse/brand";

/** The data the page was given and keeps refreshing (mirrors lib/pulse/data.ts; kept here because that module is server-only). */
export interface PulsePayload {
  snapshot: CommandSnapshot | null;
  receivedAt: number | null;
  seenAt: number | null;
  lastScanAt: number | null;
  serverNow: number;
  signedIn: boolean;
}

const money = (value: number) => "$" + Math.round(value).toLocaleString("en-US");
const cents = (value: number) => "$" + (value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type TabId = "overview" | "trips" | "messages" | "fleet" | "tolls";

/** How alive the scanner is, from the freshest sign: its own heartbeat, a snapshot, or the last time Turo was read. */
function liveState(data: PulsePayload, now: number): { state: "live" | "late" | "off"; label: string; detail: string } {
  const signs = [data.seenAt, data.receivedAt, data.lastScanAt, data.snapshot ? data.snapshot.builtAt : null].filter((value): value is number => typeof value === "number" && value > 0);
  if (!signs.length) return { state: "off", label: "Waiting for the Scanner", detail: "Nothing received yet" };
  const newest = Math.max(...signs);
  const seconds = Math.max(0, Math.round((now - newest) / 1000));
  const age = seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)} min ago` : `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 150) return { state: "live", label: "Live", detail: `Watching Turo · checked ${age}` };
  if (seconds < 900) return { state: "late", label: "Delayed", detail: `Last heard ${age}` };
  return { state: "off", label: "Scanner Offline", detail: `Last heard ${age}. The scanning PC may be off.` };
}

function Badge({ n, urgent }: { n: number; urgent?: boolean }) {
  if (!n) return null;
  return <span className={`pulse-badge ${urgent ? "urgent" : ""}`}>{n}</span>;
}

function Card({ title, aside, children, className = "" }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] ${className}`}>
      {title ? (
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {aside ? <span className="text-[12px] text-muted-foreground">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <div className={`pulse-tile ${tone} min-w-0 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)]`}>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div key={value} className="pulse-num mt-0.5 truncate text-[24px] font-semibold leading-tight tracking-tight tabular-nums">{value}</div>
      <div className="truncate text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

function Leg({ label, leg }: { label: string; leg: TripRow["pickup"] }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${leg?.soon ? "border-warning/50 bg-warning/10" : "border-border"} ${leg?.past ? "opacity-70" : ""}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary">{label}</div>
      <div className="text-[15px] font-bold tabular-nums">{leg ? leg.time : "not read"}</div>
      <div className="text-[11.5px] text-muted-foreground">{leg ? `${leg.day} · ${leg.rel}` : ""}</div>
    </div>
  );
}

function TripCards({ rows, empty }: { rows: TripRow[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => (
        <li key={`${row.tripId}-${index}`} className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{row.guest ?? "Guest"}</div>
              <div className="truncate text-[12px] text-muted-foreground">{[row.vehicle, row.plate].filter(Boolean).join(" · ")}</div>
              <div className="text-[11.5px] text-muted-foreground">{[row.tripId ? `Trip #${row.tripId}` : null, row.guestRating !== null ? `${row.guestRating.toFixed(1)}★` : null].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-success">
              {row.earnings === null ? <span className="font-normal text-muted-foreground">not priced</span> : `≈${money(row.earnings)}`}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Leg label="Pickup" leg={row.pickup} />
            <Leg label="Return" leg={row.ret} />
          </div>
          {row.flags.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {row.flags.map((flag) => (
                <span key={flag.text} className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${flag.tone === "red" ? "pulse-urgent-chip bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{flag.text}</span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Schedule({ slots }: { slots: ScheduleSlot[] }) {
  if (!slots.length) return <p className="py-4 text-center text-[13px] text-muted-foreground">No pickups or returns today.</p>;
  const next = slots.find((slot) => !slot.done);
  return (
    <ul className="space-y-1">
      {slots.map((slot, index) => (
        <li key={index} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 ${slot === next ? "pulse-next bg-primary/10" : ""} ${slot.done ? "opacity-60" : ""}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${slot.done ? "bg-muted-foreground" : slot.type === "Return" ? "bg-success" : "bg-violet-500"}`} />
          <span className="w-[66px] shrink-0 text-[13px] font-semibold tabular-nums">{slot.time}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{slot.done ? (slot.type === "Pickup" ? "Picked Up" : "Returned") : slot.type}</span>
          <span className="min-w-0 basis-full truncate pl-[22px] text-[13px] sm:basis-0 sm:flex-1 sm:pl-0">
            <b className="font-semibold">{slot.vehicle ?? slot.plate ?? "Vehicle"}</b>
            <span className="text-muted-foreground"> · {[slot.guest, slot.plate].filter(Boolean).join(" · ")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function TopCarCard({ snap }: { snap: CommandSnapshot }) {
  const top = snap.topCar;
  if (!top) return null;
  return (
    <section className="pulse-topcar relative min-h-[190px] overflow-hidden rounded-2xl border border-border bg-black shadow-[var(--shadow-card)]">
      {top.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={top.photo} alt={top.name} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-lg">
        <span aria-hidden>★</span> Top Car · Last 3 Months
      </span>
      <div className="absolute inset-x-3 bottom-2.5 text-white">
        <div className="text-[17px] font-semibold leading-tight drop-shadow">{top.name}</div>
        <div className="text-[12px] text-white/85">
          {[top.plate, `${money(top.total)} estimated`, `${top.trips} ${top.trips === 1 ? "trip" : "trips"}`, `avg ${money(top.perTrip)}`].filter(Boolean).join(" · ")}
        </div>
      </div>
    </section>
  );
}

function FleetGrid({ cars }: { cars: FleetCard[] }) {
  const LABEL: Record<FleetCard["state"], string> = { ontrip: "On a Trip", soon: "Pickup Soon", attention: "Needs Attention", available: "Available", unlisted: "Unlisted" };
  const TONE: Record<FleetCard["state"], string> = {
    ontrip: "bg-primary/10 text-primary", soon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", attention: "bg-warning/10 text-warning",
    available: "bg-success/10 text-success", unlisted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {cars.map((car, index) => (
        <article key={`${car.plate ?? car.name}-${index}`} className={`flex gap-3 rounded-xl border border-border p-2.5 ${car.state === "unlisted" ? "opacity-70" : ""}`}>
          {car.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[56px] w-[80px] shrink-0 rounded-lg bg-muted object-cover" />
          ) : (
            <div className="h-[56px] w-[80px] shrink-0 rounded-lg bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <b className="truncate text-[13px] font-semibold">{car.name}</b>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TONE[car.state]}`}>{LABEL[car.state]}</span>
            </div>
            <div className="font-mono text-[10.5px] tracking-wide text-muted-foreground">{car.plate ?? "No plate"}</div>
            <div className="mt-1 text-[12px] leading-snug">
              {car.now ? (
                <>With <b>{car.now.guest ?? "a guest"}</b>{car.now.until ? <span className="text-muted-foreground"> · back {car.now.until}</span> : null}</>
              ) : car.state === "unlisted" ? (
                <span className="text-muted-foreground">Not listed</span>
              ) : (
                "Free now"
              )}
            </div>
            {car.next ? <div className="text-[11.5px] text-muted-foreground">Next: {car.next.guest ?? "a guest"} · {car.next.from}</div> : null}
            {car.issues.map((issue) => <div key={issue} className="text-[11.5px] font-medium text-warning">{issue}</div>)}
          </div>
        </article>
      ))}
    </div>
  );
}

function Messages({ rows }: { rows: UnreadRow[] }) {
  if (!rows.length) return <Card><p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><span className="text-success">✔</span> No guest is waiting for a reply.</p></Card>;
  return (
    <ul className="grid gap-2.5 md:grid-cols-2">
      {rows.map((row, index) => (
        <li key={`${row.tripId}-${index}`} className={`rounded-2xl border bg-card p-3.5 shadow-[var(--shadow-card)] ${row.urgency === "high" ? "pulse-urgent border-destructive/50" : row.urgency === "medium" ? "border-warning/50" : "border-border"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{row.guest ?? "Guest"}</div>
              <div className="truncate text-[12px] text-muted-foreground">{[row.vehicle, row.tripId ? `Trip #${row.tripId}` : null].filter(Boolean).join(" · ")}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${row.urgency === "high" ? "bg-destructive/10 text-destructive" : row.urgency === "medium" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
              {row.wait || (row.urgency === "new" ? "New" : "Waiting")}
            </span>
          </div>
          <blockquote className="mt-2 rounded-lg border-l-[3px] border-primary bg-muted/50 px-3 py-2 text-[13px] leading-snug">{row.text || "Guest message waiting."}</blockquote>
          {row.sent ? <div className="mt-1.5 text-[11px] text-muted-foreground">Sent {row.sent}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function EarningsBars({ weeks }: { weeks: CommandSnapshot["weeks"] }) {
  const max = Math.max(1, ...weeks.map((week) => week.cents));
  return (
    <div className="flex h-32 items-end gap-1 sm:gap-2">
      {weeks.map((week) => (
        <div key={week.from} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className={`pulse-bar w-full rounded-md ${week.future ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ height: `${Math.max(3, (week.cents / max) * 88)}px`, opacity: week.trips ? 1 : 0.3 }} />
          <span className="truncate text-[9.5px] text-muted-foreground">{new Date(week.from).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
        </div>
      ))}
    </div>
  );
}

function Tolls({ snap }: { snap: CommandSnapshot }) {
  const tolls = snap.tolls;
  if (!tolls) return <Card><p className="py-4 text-[13px] text-muted-foreground">No toll figures yet. They appear once the toll file has been read on the scanning PC.</p></Card>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile tone="blue" label="Billed This Week" value={String(tolls.billedWeekTrips)} note={cents(tolls.billedWeekCents)} />
        <Tile tone="green" label="Ready to Bill" value={String(tolls.toBill)} note={cents(tolls.toBillCents)} />
        <Tile tone="amber" label="Waiting on Trips" value={String(tolls.running)} note={`${cents(tolls.runningCents)} so far`} />
        <Tile tone="violet" label="Need a Look" value={String(tolls.looks)} note="before billing" />
      </div>
      <Card title={`Billed · ${tolls.billedRows.length}`}>
        {tolls.billedRows.length ? (
          <ul className="divide-y divide-border">
            {tolls.billedRows.map((row, index) => (
              <li key={index} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{row.guest ?? "Guest"} <span className="font-normal text-muted-foreground">· {row.vehicle}</span></div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Reservation #{row.tripId} · Invoice {row.invoiceNumber ? `#${row.invoiceNumber}` : "not read yet"} · {row.billedAt}
                  </div>
                </div>
                <div className="shrink-0 text-[13px] font-semibold tabular-nums">{cents(row.cents)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nothing has been billed yet.</p>
        )}
      </Card>
      <Card title={`Not Yet Billed · ${tolls.notBilledRows.length}`}>
        {tolls.notBilledRows.length ? (
          <ul className="divide-y divide-border">
            {tolls.notBilledRows.map((row, index) => (
              <li key={index} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="truncate text-[13px] font-semibold">{row.guest ?? "Guest"} <span className="font-normal text-muted-foreground">· {row.vehicle} · #{row.tripId}</span></div>
                  <div className="shrink-0 text-[13px] tabular-nums">{cents(row.cents)}</div>
                </div>
                <div className="text-[11.5px] text-muted-foreground">{row.why}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Every trip with tolls has been billed.</p>
        )}
      </Card>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◧" },
  { id: "trips", label: "Trips", icon: "⇄" },
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "fleet", label: "Fleet", icon: "◫" },
  { id: "tolls", label: "Tolls", icon: "$" },
];

export function PulseApp({ initial }: { initial: PulsePayload }) {
  const [data, setData] = React.useState<PulsePayload>(initial);
  const [tab, setTab] = React.useState<TabId>("overview");
  const [range, setRange] = React.useState<"active" | "pickups" | "returns">("active");
  const [now, setNow] = React.useState<number>(initial.serverNow);
  const etag = React.useRef<string | null>(null);
  const skew = React.useRef<number>(0);
  const [online, setOnline] = React.useState(true);

  // the clock behind "checked 12s ago": the server's, so a phone with a wrong clock still reads true
  React.useEffect(() => {
    skew.current = initial.serverNow - Date.now();
    const id = window.setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the poll: every 8 seconds while the page is in view; an unchanged fleet costs an empty 304
  React.useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/cocruisers/data", { headers: etag.current ? { "If-None-Match": etag.current } : {}, cache: "no-store" });
        setOnline(true);
        const serverNow = Number(response.headers.get("X-Server-Now"));
        if (response.status === 304) { if (serverNow) skew.current = serverNow - Date.now(); return; }
        if (response.status === 401) { window.location.reload(); return; }
        if (!response.ok) return;
        etag.current = response.headers.get("ETag");
        const next = (await response.json()) as PulsePayload;
        skew.current = next.serverNow - Date.now();
        setData(next);
      } catch {
        setOnline(false);
      }
    }
    const id = window.setInterval(poll, 8000);
    const visible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", poll);
    return () => { stopped = true; window.clearInterval(id); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", poll); };
  }, []);

  const snap = data.snapshot;
  const live = liveState(data, now);
  const unread = snap ? snap.unread.length : 0;
  const urgentCount = snap ? snap.attention.filter((row) => row.tone === "red").length + snap.unread.filter((row) => row.urgency === "high").length : 0;
  const hours24 = 24 * 3600000;

  return (
    <div className="pulse-root mx-auto min-h-dvh max-w-[1200px] px-4 pb-28 pt-[max(env(safe-area-inset-top),14px)] md:pb-12">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/colorado-cruisers.webp" alt="" className="h-10 w-10 shrink-0 rounded-xl bg-black object-contain p-0.5" />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{PULSE_NAME}</h1>
            <p className="truncate text-[11.5px] text-muted-foreground">{PULSE_TAGLINE}</p>
          </div>
        </div>
        <button type="button" onClick={() => { fetch("/api/cocruisers/logout", { method: "POST" }).finally(() => window.location.reload()); }} className="hidden shrink-0 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-muted md:block" aria-label="Lock this browser">Lock</button>
        <div className={`pulse-live ${live.state} flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12px]`} role="status" aria-live="polite">
          <i className="pulse-dot" />
          <b>{live.label}</b>
          <span className="hidden text-muted-foreground sm:inline">{live.detail}</span>
        </div>
      </header>
      <div className="pulse-scan" aria-hidden />
      <p className="mb-3 mt-2 text-[11.5px] text-muted-foreground sm:hidden">{live.detail}{!online ? " · you are offline" : ""}</p>
      {!online ? <p className="mb-3 hidden rounded-lg bg-warning/10 px-3 py-1.5 text-[12px] text-warning sm:block">You are offline. Showing what was last received.</p> : null}

      {/* the desktop tab bar; on a phone the same tabs sit at the bottom */}
      <nav className="mb-4 hidden gap-1 rounded-xl border border-border bg-card p-1 md:flex" aria-label="Sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${tab === item.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}>
            {item.label}
            {item.id === "messages" ? <Badge n={unread} urgent={snap ? snap.unread.some((row) => row.urgency === "high") : false} /> : null}
          </button>
        ))}
      </nav>

      {!snap ? (
        <Card><p className="py-8 text-center text-[13px] text-muted-foreground">Waiting for the first scan from the PC. This page fills in by itself.</p></Card>
      ) : (
        <main className="space-y-3.5">
          {tab === "overview" ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{snap.greeting}{snap.owner ? "" : ""}</h2>
                <span className="text-[12px] text-muted-foreground">{snap.attention.length ? `${snap.attention.length} need${snap.attention.length === 1 ? "s" : ""} attention` : "Nothing needs attention"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                <Tile tone="blue" label="Total Vehicles" value={String(snap.kpis.vehicles)} note={snap.fleetSummary.unlisted ? `${snap.fleetSummary.unlisted} unlisted` : "all listed"} />
                <Tile tone="violet" label="Active Trips" value={String(snap.kpis.activeTrips)} note="on the road now" />
                <Tile tone="green" label="Upcoming Pickups" value={String(snap.kpis.pickups)} note="next 24 hours" />
                <Tile tone="amber" label="Upcoming Returns" value={String(snap.kpis.returns)} note="next 24 hours" />
                <div className="col-span-2 lg:col-span-1"><Tile tone="green" label="Est. Earnings" value={money(snap.kpis.earningsNext30)} note="trips ending in 30 days" /></div>
              </div>
              <div className="grid gap-3.5 lg:grid-cols-5">
                <Card title={`Needs Attention · ${snap.attention.length}`} aside={urgentCount ? <span className="pulse-urgent-chip rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">{urgentCount} urgent</span> : undefined} className="lg:col-span-3">
                  {snap.attention.length ? (
                    <ul className="max-h-[420px] divide-y divide-border overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin] sm:max-h-[470px]">
                      {snap.attention.slice(0, 100).map((row, index) => (
                        <li key={index} className={`flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between ${row.tone === "red" ? "pulse-row-red" : ""}`}>
                          <div className="min-w-0">
                            <div className={`text-[13px] font-semibold ${row.tone === "red" ? "text-destructive" : row.tone === "amber" ? "text-warning" : "text-primary"}`}>{row.label}</div>
                            <div className="text-[12px] text-muted-foreground sm:truncate">{[row.vehicle, row.tripId ? `Trip #${row.tripId}` : null].filter(Boolean).join(" · ")}</div>
                            {row.detail ? <div className="text-[11.5px] text-muted-foreground">{row.detail}</div> : null}
                          </div>
                          <div className="shrink-0 text-[12px] font-medium sm:text-right">{row.guest ?? "Guest"}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-4 text-[13px] text-muted-foreground"><span className="text-success">✔</span> All clear.</p>
                  )}
                </Card>
                <div className="space-y-3.5 lg:col-span-2">
                  <TopCarCard snap={snap} />
                  <Card title="Today’s Schedule" aside={`${snap.schedule.length} events`}><Schedule slots={snap.schedule} /></Card>
                </div>
              </div>
              <div className="grid gap-3.5 lg:grid-cols-2">
                <Card title="Fleet Right Now" aside={`${snap.fleetSummary.total} vehicles`}>
                  <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-5">
                    {([["On a Trip", snap.fleetSummary.onTrip], ["Pickup Soon", snap.fleetSummary.scheduled], ["Available", snap.fleetSummary.available], ["Needs Attention", snap.fleetSummary.needsAttention], ["Unlisted", snap.fleetSummary.unlisted]] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted/60 px-3 py-2"><div className="text-[18px] font-semibold tabular-nums">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
                    ))}
                  </div>
                </Card>
                <Card title="Earnings Overview" aside="estimates · not payouts">
                  <div className="mb-2 text-[24px] font-semibold tabular-nums">{money(snap.kpis.earningsNext30)}<span className="ml-2 text-[12px] font-medium text-success">next 30 days · {snap.kpis.tripsNext30} trips</span></div>
                  <EarningsBars weeks={snap.weeks} />
                </Card>
              </div>
            </>
          ) : null}

          {tab === "trips" ? (
            <>
              <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                {([["active", "Active", snap.tripLists.active.length], ["pickups", "Pickups", snap.tripLists.pickups.filter((row) => row.pickupAt !== null && row.pickupAt <= now + hours24).length], ["returns", "Returns", snap.tripLists.returns.filter((row) => row.returnAt !== null && row.returnAt <= now + hours24).length]] as const).map(([id, label, count]) => (
                  <button key={id} type="button" onClick={() => setRange(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium ${range === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}<span className="text-[11px] opacity-80">{count}</span></button>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">{range === "active" ? "On the road right now, soonest return first." : range === "pickups" ? "Starting in the next 24 hours." : "Ending in the next 24 hours."}</p>
              <TripCards
                rows={range === "active" ? snap.tripLists.active : range === "pickups" ? snap.tripLists.pickups.filter((row) => row.pickupAt !== null && row.pickupAt <= now + hours24) : snap.tripLists.returns.filter((row) => row.returnAt !== null && row.returnAt <= now + hours24)}
                empty={range === "active" ? "No trip is on the road right now." : "Nothing in this window."}
              />
            </>
          ) : null}

          {tab === "messages" ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight">Guests Waiting for a Reply · {snap.unread.length}</h2>
              <Messages rows={snap.unread} />
            </>
          ) : null}

          {tab === "fleet" ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight">Fleet · {snap.fleet.length}</h2>
              <FleetGrid cars={snap.fleet} />
            </>
          ) : null}

          {tab === "tolls" ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight">Toll Reimbursements</h2>
              <Tolls snap={snap} />
            </>
          ) : null}
        </main>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-foreground">A read-only view. Nothing here can be changed or uploaded. Estimates are not payouts.</p>

      {/* the phone's tab bar, with room for the home indicator */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }} aria-label="Sections">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${tab === item.id ? "text-primary" : "text-muted-foreground"}`}>
              <span className="text-[18px] leading-none" aria-hidden>{item.icon}</span>
              {item.label}
              {item.id === "messages" && unread ? <span className={`pulse-badge absolute right-[22%] top-1 ${snap && snap.unread.some((row) => row.urgency === "high") ? "urgent" : ""}`}>{unread}</span> : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
