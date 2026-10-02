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

const HOUR = 3600000;
const EXPIRE_MS = 72 * HOUR;

/** "Good afternoon, Matt": the owner's name (this page is his), and the time of day where the fleet is, right now. */
function greetingFor(snap: CommandSnapshot, now: number): string {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: snap.zone, hour: "numeric", hour12: false }).format(new Date(now))) % 24;
  } catch { /* keep midday */ }
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${snap.owner ?? "Matt"}`;
}

/** The Monday to Friday of the current week in the fleet's zone, as "Sept 28 – Oct 2". Matthew sends the week's tolls Monday to Friday. */
function weekRange(zone: string, now: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map((part) => [part.type, part.value]));
  const dow = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[parts.weekday] ?? 0;
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const monday = today - dow * 86400000;
  const label = (ms: number) => {
    const d = new Date(ms);
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    return `${month === "Sep" ? "Sept" : month} ${d.getUTCDate()}`;
  };
  return `${label(monday)} – ${label(monday + 4 * 86400000)}`;
}

/** Days until a trip ends, in words, for the trips whose tolls cannot be billed yet. */
function untilEnd(endsAt: number | null, now: number, zone: string): string {
  if (endsAt === null) return "End time not read yet";
  const days = Math.ceil((endsAt - now) / (24 * HOUR));
  const when = new Date(endsAt).toLocaleString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (endsAt <= now) return `Ended ${when}: can be billed`;
  return `Ends ${when} · ${days} ${days === 1 ? "day" : "days"} left`;
}

const money = (value: number) => "$" + Math.round(value).toLocaleString("en-US");
const cents = (value: number) => "$" + (value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Oct 2, 3:14 PM" in the fleet's zone; null when there is no time. */
function when(value: string | number | null, zone: string): string | null {
  if (value === null || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
const ageMs = (value: string | number | null, now: number): number | null => {
  if (value === null || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? Math.max(0, now - ms) : null;
};

/** The small grey line under a tile or section: shown only when HostOS is not fully sure of what is above it. */
function Note({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground/80">{children}</p>;
}

interface Weather { temp: number; feels: number; code: number; wind: number; high: number; low: number }
const WEATHER_TEXT: [number[], string, string][] = [
  [[0], "Clear", "☀️"], [[1, 2], "Partly Cloudy", "⛅"], [[3], "Overcast", "☁️"], [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"], [[61, 63, 65, 66, 67, 80, 81, 82], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "❄️"], [[95, 96, 99], "Thunderstorm", "⛈️"],
];
const weatherLabel = (code: number): [string, string] => { const hit = WEATHER_TEXT.find(([codes]) => codes.includes(code)); return hit ? [hit[1], hit[2]] : ["Weather", "🌡️"]; };
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=39.7392&longitude=-104.9903&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FDenver&forecast_days=1";

/** Live Denver weather (Open-Meteo, no key), refreshed every 10 minutes. Hidden if it cannot be reached. */
function WeatherChip() {
  const [weather, setWeather] = React.useState<Weather | null>(null);
  React.useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const response = await fetch(WEATHER_URL, { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        const cur = json.current;
        if (stopped || !cur || typeof cur.temperature_2m !== "number") return;
        setWeather({ temp: cur.temperature_2m, feels: cur.apparent_temperature, code: cur.weather_code, wind: cur.wind_speed_10m, high: json.daily?.temperature_2m_max?.[0], low: json.daily?.temperature_2m_min?.[0] });
      } catch { /* the chip just stays hidden */ }
    }
    void load();
    const id = window.setInterval(load, 600000);
    return () => { stopped = true; window.clearInterval(id); };
  }, []);
  if (!weather) return null;
  const [text, icon] = weatherLabel(weather.code);
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2 shadow-[var(--shadow-card)]" aria-label="Denver weather">
      <span className="text-[26px] leading-none" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">Denver, CO · {Math.round(weather.temp)}°F <span className="font-normal text-muted-foreground">{text}</span></div>
        <div className="text-[11px] text-muted-foreground">Feels {Math.round(weather.feels)}° · Wind {Math.round(weather.wind)} mph{Number.isFinite(weather.high) ? ` · High ${Math.round(weather.high)}° Low ${Math.round(weather.low)}°` : ""}</div>
      </div>
    </div>
  );
}

type TabId ="overview" | "trips" | "messages" | "fleet" | "tolls";

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

function Tile({ label, value, note, tone, hint, onOpen }: { label: string; value: string; note: string; tone: string; hint?: string; onOpen?: () => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-[11.5px] text-muted-foreground"><span>{label}</span>{onOpen ? <span aria-hidden className="text-[13px]">›</span> : null}</div>
      <div key={value} className="pulse-num mt-0.5 truncate text-[24px] font-semibold leading-tight tracking-tight tabular-nums">{value}</div>
      <div className="truncate text-[11px] text-muted-foreground">{note}</div>
      {hint ? <div className="mt-1 text-[10px] leading-snug text-muted-foreground/80">{hint}</div> : null}
    </>
  );
  const cls = `pulse-tile ${tone} min-w-0 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-[var(--shadow-card)]`;
  return onOpen ? (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${value}. Open the details`} className={`${cls} w-full cursor-pointer transition hover:border-accent/60 active:scale-[.98]`}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Leg({ label, leg }: { label: string; leg: TripRow["pickup"] }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${leg?.soon ? "border-warning/50 bg-warning/10" : "border-border"} ${leg?.past ? "opacity-70" : ""}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-accent">{label}</div>
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
              <div className="truncate text-[14px] font-semibold"><TuroLink href={row.tripUrl}>{row.guest ?? "Guest"}</TuroLink></div>
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
                <span key={flag.text} className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${flag.tone === "red" ? "pulse-urgent-chip bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{flag.text}</span>
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
        <li key={index} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 ${slot === next ? "pulse-next bg-accent/10" : ""} ${slot.done ? "opacity-60" : ""}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${slot.done ? "bg-muted-foreground" : slot.type === "Return" ? "bg-success" : "bg-violet-500"}`} />
          <span className="w-[66px] shrink-0 text-[13px] font-semibold tabular-nums">{slot.time}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{slot.done ? (slot.type === "Pickup" ? "Picked Up" : "Returned") : slot.type}</span>
          <span className="min-w-0 basis-full truncate pl-[22px] text-[13px] sm:basis-0 sm:flex-1 sm:pl-0">
            <b className="font-semibold"><TuroLink href={slot.tripUrl}>{slot.vehicle ?? slot.plate ?? "Vehicle"}</TuroLink></b>
            <span className="text-muted-foreground"> · {[slot.guest, slot.plate].filter(Boolean).join(" · ")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A link into Turo. These are plain turo.com addresses opened in a new tab: on a phone with the Turo app installed, the phone
 * hands a turo.com link to the app by itself (iPhone universal links, Android app links); without the app it opens in the browser.
 * A web page cannot force the app open, so this is the dependable way and the label says where it goes.
 */
function TuroLink({ href, children, className = "" }: { href: string | null | undefined; children: React.ReactNode; className?: string }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} underline decoration-dotted underline-offset-2 hover:text-accent`}>
      {children}<span aria-hidden className="ml-0.5 text-[10px] no-underline">↗</span>
    </a>
  );
}

/** A photo card with a badge: the Top Car and the Most Booked car. */
function FeaturedCar({ badge, tone, name, plate, photo, line, note, href }: { badge: string; tone: "gold" | "rose"; name: string; plate: string | null; photo: string | null; line: string; note: string; href: string | null }) {
  const gradient = tone === "gold" ? "from-yellow-300 to-amber-500 text-amber-950" : "from-rose-300 to-pink-500 text-rose-950";
  return (
    <section className="pulse-topcar relative min-h-[190px] overflow-hidden rounded-2xl border border-border bg-black shadow-[var(--shadow-card)]">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br px-2.5 py-1 text-[11px] font-bold shadow-lg ${gradient}`}>{badge}</span>
      <div className="absolute inset-x-3 bottom-2.5 text-white">
        <div className="text-[10.5px] text-white/60">{note}</div>
        <div className="text-[17px] font-semibold leading-tight drop-shadow">{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{name} ↗</a> : name}</div>
        <div className="text-[12px] text-white/85">{[plate, line].filter(Boolean).join(" · ")}</div>
      </div>
    </section>
  );
}

function TopCarCard({ snap }: { snap: CommandSnapshot }) {
  const top = snap.topCar;
  if (!top) return null;
  const listing = snap.fleet.find((car) => car.plate && top.plate && car.plate === top.plate)?.listingUrl ?? null;
  return (
    <FeaturedCar badge="★ Top Car · Last 3 Months" tone="gold" name={top.name} plate={top.plate} photo={top.photo} href={listing}
      line={`${money(top.total)} estimated · ${top.trips} ${top.trips === 1 ? "trip" : "trips"} · avg ${money(top.perTrip)}`}
      note="Most estimated earnings, from trip prices. Not a payout." />
  );
}

/** The car with the most trips started in the last 3 months. Ties go to the one that earned more. */
function MostBookedCard({ snap }: { snap: CommandSnapshot }) {
  const ranked = snap.fleet.filter((car) => car.booked90 > 0).sort((a, b) => b.booked90 - a.booked90 || b.earned90 - a.earned90);
  const best = ranked[0];
  if (!best) return null;
  return (
    <FeaturedCar badge="♥ Most Booked · Last 3 Months" tone="rose" name={best.name} plate={best.plate} photo={best.photo} href={best.listingUrl}
      line={`${best.booked90} ${best.booked90 === 1 ? "trip" : "trips"} started${best.earnedTrips90 ? ` · ${money(best.earned90)} estimated` : ""}`}
      note="Most trips started in the last 3 months." />
  );
}

type FleetFilter = "all" | "earners" | "booked" | "attention" | "unlisted" | "available";

const FLEET_FILTERS: { id: FleetFilter; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Every vehicle." },
  { id: "earners", label: "Top Earners", hint: "Most estimated earnings in the last 3 months, highest first." },
  { id: "booked", label: "Most Booked", hint: "Most trips started in the last 3 months." },
  { id: "attention", label: "Needs Attention", hint: "Inspection due or required, or restricted on Turo." },
  { id: "unlisted", label: "Unlisted", hint: "Not listed on Turo right now." },
  { id: "available", label: "Available", hint: "Listed, no trip now and none starting in the next 24 hours: parked and ready." },
];

function filterFleet(cars: FleetCard[], filter: FleetFilter): FleetCard[] {
  switch (filter) {
    case "earners": return cars.filter((car) => car.earned90 > 0).sort((a, b) => b.earned90 - a.earned90);
    case "booked": return cars.filter((car) => car.booked90 > 0).sort((a, b) => b.booked90 - a.booked90 || b.earned90 - a.earned90);
    case "attention": return cars.filter((car) => car.inspection || car.issues.length > 0);
    case "unlisted": return cars.filter((car) => car.status === "unlisted" || car.state === "unlisted");
    case "available": return cars.filter((car) => car.state === "available");
    default: return cars;
  }
}

function FleetGrid({ cars, filter }: { cars: FleetCard[]; filter: FleetFilter }) {
  const LABEL: Record<FleetCard["state"], string> = { ontrip: "On a Trip", soon: "Pickup Soon", attention: "Needs Attention", available: "Available", unlisted: "Unlisted" };
  const TONE: Record<FleetCard["state"], string> = {
    ontrip: "bg-accent/10 text-accent", soon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", attention: "bg-warning/10 text-warning",
    available: "bg-success/10 text-success", unlisted: "bg-muted text-muted-foreground",
  };
  if (!cars.length) return <p className="rounded-2xl border border-border bg-card py-8 text-center text-[13px] text-muted-foreground">No vehicle matches this filter right now.</p>;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {cars.map((car, index) => (
        <article key={`${car.plate ?? car.name}-${index}`} className={`flex gap-3 rounded-xl border border-border bg-card p-2.5 ${car.state === "unlisted" ? "opacity-70" : ""}`}>
          {car.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[56px] w-[80px] shrink-0 rounded-lg bg-muted object-cover" />
          ) : (
            <div className="h-[56px] w-[80px] shrink-0 rounded-lg bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <b className="truncate text-[13px] font-semibold"><TuroLink href={car.listingUrl}>{car.name}</TuroLink></b>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TONE[car.state]}`}>{LABEL[car.state]}</span>
            </div>
            <div className="font-mono text-[10.5px] tracking-wide text-muted-foreground">{car.plate ?? "No plate"}</div>
            <div className="mt-1 text-[12px] leading-snug">
              {car.now ? (
                <>
                  <TuroLink href={car.now.tripUrl}>With <b>{car.now.guest ?? "a guest"}</b></TuroLink>
                  {car.now.until ? <span className="text-muted-foreground"> · back {car.now.until}</span> : null}
                </>
              ) : car.status === "unlisted" ? (
                <span className="text-muted-foreground">Not listed</span>
              ) : (
                "Free now"
              )}
            </div>
            {car.next ? <div className="text-[11.5px] text-muted-foreground"><TuroLink href={car.next.tripUrl}>Next: {car.next.guest ?? "a guest"} · {car.next.from}</TuroLink></div> : null}
            {car.issues.map((issue) => <div key={issue} className="text-[11.5px] font-medium text-warning">{issue}</div>)}
            {filter === "earners" ? <div className="text-[11.5px] font-semibold text-success">≈{money(car.earned90)} · {car.earnedTrips90} {car.earnedTrips90 === 1 ? "trip" : "trips"}</div> : null}
            {filter === "booked" ? <div className="text-[11.5px] font-semibold text-accent">{car.booked90} {car.booked90 === 1 ? "trip" : "trips"} started</div> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function Messages({ rows, note }: { rows: UnreadRow[]; note?: React.ReactNode }) {
  if (!rows.length) return <Card><p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><span className="text-success">✔</span> No guest is waiting for a reply.</p><Note>{note}</Note></Card>;
  return (
    <>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {rows.map((row, index) => {
          const urgent = row.tone === "urgent";
          const fyi = row.tone === "fyi";
          return (
            <li key={`${row.tripId}-${index}`} className={`rounded-2xl border bg-card p-3.5 shadow-[var(--shadow-card)] ${urgent ? "pulse-urgent border-danger/60 bg-danger/[0.04]" : fyi ? "border-border opacity-75" : row.urgency === "high" ? "pulse-urgent border-danger/50" : row.urgency === "medium" ? "border-warning/50" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{row.guest ?? "Guest"}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{[row.vehicle, row.tripId ? `Trip #${row.tripId}` : null].filter(Boolean).join(" · ")}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${row.urgency === "high" ? "bg-danger/10 text-danger" : row.urgency === "medium" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"}`}>
                  {row.wait || (row.urgency === "new" ? "New" : "Waiting")}
                </span>
              </div>
              {row.labels.length || fyi ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.labels.map((entry) => (
                    <span key={entry.key} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${entry.level === "urgent" ? "pulse-urgent-chip bg-danger text-white" : "bg-warning/15 text-warning"}`}>{entry.label}</span>
                  ))}
                  {fyi ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">No Reply Needed</span> : null}
                </div>
              ) : null}
              <blockquote className={`mt-2 rounded-lg border-l-[3px] bg-muted/50 px-3 py-2 text-[13px] leading-snug ${urgent ? "border-danger" : fyi ? "border-muted-foreground/40 text-muted-foreground" : "border-accent"}`}>{row.text || "Guest message waiting."}</blockquote>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{row.sent ? row.sent : ""}</span>
                {row.tripUrl ? <a href={row.tripUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Open Trip in Turo</a> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Note>{note}</Note>
    </>
  );
}

function EarningsBars({ weeks }: { weeks: CommandSnapshot["weeks"] }) {
  const max = Math.max(1, ...weeks.map((week) => week.cents));
  return (
    <div className="flex h-32 items-end gap-1 sm:gap-2">
      {weeks.map((week) => (
        <div key={week.from} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className={`pulse-bar w-full rounded-md ${week.future ? "bg-accent" : "bg-muted-foreground/40"}`} style={{ height: `${Math.max(3, (week.cents / max) * 88)}px`, opacity: week.trips ? 1 : 0.3 }} />
          <span className="truncate text-[9.5px] text-muted-foreground">{new Date(week.from).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
        </div>
      ))}
    </div>
  );
}

function MiniTile({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <div className={"pulse-tile " + tone + " min-w-0 rounded-xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-card)]"}>
      <div className="truncate text-[10.5px] text-muted-foreground">{label}</div>
      <div className="truncate text-[18px] font-semibold leading-tight tabular-nums">{value}</div>
      <div className="truncate text-[10.5px] text-muted-foreground">{note}</div>
    </div>
  );
}

function Tolls({ snap, now }: { snap: CommandSnapshot; now: number }) {
  const tolls = snap.tolls;
  if (!tolls) return <Card><p className="py-4 text-[13px] text-muted-foreground">No toll figures yet. They appear once the toll file has been read on the scanning PC.</p></Card>;
  const waiting = tolls.notBilledRows.filter((row) => row.group === "running");
  const rest = tolls.notBilledRows.filter((row) => row.group !== "running");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniTile tone="blue" label="Billed This Week" value={String(tolls.billedWeekTrips)} note={cents(tolls.billedWeekCents)} />
        <MiniTile tone="green" label="Ready to Bill" value={String(tolls.toBill)} note={cents(tolls.toBillCents)} />
        <MiniTile tone="amber" label="Trip Still Ongoing" value={String(tolls.running)} note={"can't bill yet · " + cents(tolls.runningCents)} />
        <MiniTile tone="violet" label="Need a Look" value={String(tolls.looks)} note="before billing" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={"Billed · " + tolls.billedRows.length}>
          {tolls.billedRows.length ? (
            <ul className="max-h-[360px] divide-y divide-border overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin]">
              {tolls.billedRows.map((row, index) => (
                <li key={index} className="flex items-start justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{row.guest ?? "Guest"} <span className="font-normal text-muted-foreground">· {row.vehicle}</span></div>
                    <div className="text-[11px] text-muted-foreground">
                      Reservation #{row.tripId} · Invoice {row.invoiceNumber ? "#" + row.invoiceNumber : "not read yet"} · {row.billedAt}
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
        <Card title={"Not Yet Billed · " + tolls.notBilledRows.length}>
          {tolls.notBilledRows.length ? (
            <div className="max-h-[360px] space-y-3 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin]">
              {waiting.length ? (
                <div>
                  <div className="mb-1 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-warning">
                    <b>Trip still ongoing · {waiting.length}.</b> These tolls cannot be billed yet. Billing starts once each trip has ended, because tolls keep posting after it ends.
                  </div>
                  <ul className="divide-y divide-border">
                    {waiting.map((row, index) => (
                      <li key={index} className="py-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 truncate text-[13px] font-semibold">{row.guest ?? "Guest"} <span className="font-normal text-muted-foreground">· {row.vehicle} · #{row.tripId}</span></div>
                          <div className="shrink-0 text-[13px] tabular-nums">{cents(row.cents)}</div>
                        </div>
                        <div className="text-[11.5px] font-medium text-warning">{untilEnd(row.endsAt, now, snap.zone)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {rest.length ? (
                <ul className="divide-y divide-border">
                  {rest.map((row, index) => (
                    <li key={index} className="py-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 truncate text-[13px] font-semibold">{row.guest ?? "Guest"} <span className="font-normal text-muted-foreground">· {row.vehicle} · #{row.tripId}</span></div>
                        <div className="shrink-0 text-[13px] tabular-nums">{cents(row.cents)}</div>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">{row.why}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Every trip with tolls has been billed.</p>
          )}
        </Card>
      </div>
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
  const [fleetFilter, setFleetFilter] = React.useState<FleetFilter>("all");
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
  const unreadRows = snap ? snap.unread.filter((row) => row.sentAt === null || now - row.sentAt <= EXPIRE_MS) : [];
  const unread = unreadRows.filter((row) => row.tone !== "fyi").length;
  const urgentMessages = unreadRows.filter((row) => row.tone === "urgent").length;
  const urgentCount = snap ? snap.attention.filter((row) => row.tone === "red").length + urgentMessages : 0;
  const open = (id: TabId, view?: "active" | "pickups" | "returns") => {
    if (view) setRange(view);
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const q = snap ? snap.quality : null;
  const zone = snap ? snap.zone : "America/Denver";
  const fleetCount = snap ? (snap.fleet.length || snap.kpis.vehicles) : 0;
  const fleetBy = (state: FleetCard["state"]) => (snap ? snap.fleet.filter((car) => car.state === state).length : 0);
  const tripsAge = q ? ageMs(q.tripsAt, now) : null;
  const tripsNote = !q || !q.tripsAt
    ? "Trips have not been read from Turo yet. Open Turo on the scanning PC."
    : tripsAge !== null && tripsAge > 45 * 60000
      ? `Last read from Turo ${when(q.tripsAt, zone)}. To refresh, open Turo on the scanning PC.`
      : q.detailsPending > 0
        ? `${q.detailsPending} trip${q.detailsPending === 1 ? "" : "s"} still being read for details (prices, plates).`
        : undefined;
  const messagesNote = `Read from the Turo inbox${q && q.tripsAt ? " " + when(q.tripsAt, zone) : ""}. A guest shows here when they wrote last; Matthew's saved (canned) messages do not count as a reply. Labels come from the guest's words, so always read the message.`;
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
      <div className="mt-3"><WeatherChip /></div>
      <p className="mb-3 mt-2 text-[11.5px] text-muted-foreground sm:hidden">{live.detail}{!online ? " · you are offline" : ""}</p>
      {!online ? <p className="mb-3 hidden rounded-lg bg-warning/10 px-3 py-1.5 text-[12px] text-warning sm:block">You are offline. Showing what was last received.</p> : null}

      {/* the desktop tab bar; on a phone the same tabs sit at the bottom */}
      <nav className="mb-4 hidden gap-1 rounded-xl border border-border bg-card p-1 md:flex" aria-label="Sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${tab === item.id ? "bg-accent text-accent-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}>
            {item.label}
            {item.id === "messages" ? <Badge n={unread} urgent={urgentMessages > 0} /> : null}
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
                <h2 className="text-xl font-semibold tracking-tight">{greetingFor(snap, now)}</h2>
                <span className="text-[12px] text-muted-foreground">{snap.attention.length ? `${snap.attention.length} need${snap.attention.length === 1 ? "s" : ""} attention` : "Nothing needs attention"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                <Tile tone="blue" label="Total Vehicles" value={String(fleetCount)} note={fleetBy("unlisted") ? `${fleetBy("unlisted")} unlisted` : "all listed"} onOpen={() => open("fleet")}
                  hint={q && !q.fleetLive ? "Fleet list is HostOS's saved catalog, not confirmed from Turo. Open Turo's Vehicles page on the scanning PC." : undefined} />
                <Tile tone="violet" label="Active Trips" value={String(snap.kpis.activeTrips)} note="on the road now" onOpen={() => open("trips", "active")}
                  hint={q && q.activeNoPlate ? `${q.activeNoPlate} active trip has no plate read yet, so its car is unconfirmed.` : tripsNote} />
                <Tile tone="green" label="Upcoming Pickups" value={String(snap.kpis.pickups)} note="next 24 hours" onOpen={() => open("trips", "pickups")} hint={tripsNote} />
                <Tile tone="amber" label="Upcoming Returns" value={String(snap.kpis.returns)} note="next 24 hours" onOpen={() => open("trips", "returns")} hint={tripsNote} />
                <div className="col-span-2 lg:col-span-1"><Tile tone="green" label="Est. Earnings" value={money(snap.kpis.earningsNext30)} note="trips ending in 30 days"
                  hint={q && q.unpricedTrips ? `Minimum: ${q.unpricedTrips} trip${q.unpricedTrips === 1 ? " has" : "s have"} no price yet and ${q.unpricedTrips === 1 ? "is" : "are"} not counted. Estimates, not payouts.` : "Estimates from trip prices, not payouts."} /></div>
              </div>
              <div className="grid gap-3.5 lg:grid-cols-5">
                <Card title={`Needs Attention · ${snap.attention.length}`} aside={urgentCount ? <span className="pulse-urgent-chip rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">{urgentCount} urgent</span> : undefined} className="lg:col-span-3">
                  {snap.attention.length ? (
                    <ul className="max-h-[420px] divide-y divide-border overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin] sm:max-h-[470px]">
                      {snap.attention.slice(0, 100).map((row, index) => (
                        <li key={index} className={`flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between ${row.tone === "red" ? "pulse-row-red" : ""}`}>
                          <div className="min-w-0">
                            <div className={`text-[13px] font-semibold ${row.tone === "red" ? "text-danger" : row.tone === "amber" ? "text-warning" : "text-accent"}`}><TuroLink href={row.tripUrl}>{row.label}</TuroLink></div>
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
                  <Card title="Today’s Schedule" aside={`${snap.schedule.length} events`}><Schedule slots={snap.schedule} /></Card>
                </div>
              </div>
              <div className="grid gap-3.5 lg:grid-cols-2">
                <Card title="Fleet Right Now" aside={`${fleetCount} vehicles`}>
                  <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-5">
                    {([["On a Trip", fleetBy("ontrip")], ["Pickup Soon", fleetBy("soon")], ["Available", fleetBy("available")], ["Needs Attention", fleetBy("attention")], ["Unlisted", fleetBy("unlisted")]] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted/60 px-3 py-2"><div className="text-[18px] font-semibold tabular-nums">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
                    ))}
                  </div>
                  <Note>Counted from the Fleet tab, one state per car.{q && !q.fleetLive ? " Availability is not confirmed from Turo yet. Open Turo's calendar page on the scanning PC." : q && q.fleetAt ? ` Availability last read ${when(q.fleetAt, zone)}.` : ""}</Note>
                </Card>
                <Card title="Earnings Overview" aside="estimates · not payouts">
                  <div className="mb-2 text-[24px] font-semibold tabular-nums">{money(snap.kpis.earningsNext30)}<span className="ml-2 text-[12px] font-medium text-success">next 30 days · {snap.kpis.tripsNext30} trips</span></div>
                  <EarningsBars weeks={snap.weeks} />
                  <Note>Estimates from each trip&rsquo;s listed price, grouped by week.{q && q.unpricedTrips ? ` ${q.unpricedTrips} trip${q.unpricedTrips === 1 ? "" : "s"} without a price are left out, so the real figure is higher.` : ""}</Note>
                </Card>
              </div>
            </>
          ) : null}

          {tab === "trips" ? (
            <>
              <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                {([["active", "Active", snap.tripLists.active.length], ["pickups", "Pickups", snap.tripLists.pickups.filter((row) => row.pickupAt !== null && row.pickupAt <= now + hours24).length], ["returns", "Returns", snap.tripLists.returns.filter((row) => row.returnAt !== null && row.returnAt <= now + hours24).length]] as const).map(([id, label, count]) => (
                  <button key={id} type="button" onClick={() => setRange(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium ${range === id ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{label}<span className="text-[11px] opacity-80">{count}</span></button>
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
              <h2 className="text-xl font-semibold tracking-tight">Guests Waiting for a Reply · {unread}{unreadRows.length > unread ? <span className="ml-2 text-[13px] font-normal text-muted-foreground">+ {unreadRows.length - unread} no reply needed</span> : null}</h2>
              <p className="text-[12px] text-muted-foreground">Messages from the last 72 hours, urgent ones first. Older ones clear by themselves.</p>
              <Messages rows={unreadRows} note={messagesNote} />
            </>
          ) : null}

          {tab === "fleet" ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight">Fleet · {snap.fleet.length}</h2>
              <div className="grid gap-3 md:grid-cols-2"><TopCarCard snap={snap} /><MostBookedCard snap={snap} /></div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter vehicles">
                {FLEET_FILTERS.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={fleetFilter === item.id} title={item.hint} onClick={() => setFleetFilter(item.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${fleetFilter === item.id ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}>
                    {item.label} <span className="opacity-70">{filterFleet(snap.fleet, item.id).length}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11.5px] text-muted-foreground">{FLEET_FILTERS.find((item) => item.id === fleetFilter)?.hint} Tap a name to open it in Turo.</p>
              <FleetGrid cars={filterFleet(snap.fleet, fleetFilter)} filter={fleetFilter} />
              <Note>{q && !q.fleetLive ? "Availability is not confirmed from Turo yet, so Available and Free Now may be wrong. Open Turo's calendar page on the scanning PC." : q && q.fleetAt ? `Availability last read ${when(q.fleetAt, zone)}.` : null}{q && !q.listingsLive ? " Names and photos are from HostOS's saved catalog until the Vehicles page is read." : ""}</Note>
            </>
          ) : null}

          {tab === "tolls" ? (
            <>
              <h2 className="text-xl font-semibold tracking-tight">Tolls for This Week · {weekRange(snap.zone, now)}</h2>
              <p className="text-[12px] text-muted-foreground">Monday to Friday, Mountain Time. The week&rsquo;s tolls Matthew sends for billing and reimbursement.</p>
              <Tolls snap={snap} now={now} />
              <Note>{!snap.tolls ? null : `Tolls last updated ${when(snap.tolls.at, zone) ?? "at an unknown time"}, from the toll file read on the scanning PC. To refresh, open the Toll Manager there.`}{q && q.invoicesMissing ? ` ${q.invoicesMissing} of ${q.invoicesTotal} billed trips show "not read yet" for the invoice number: it is read when the Toll Manager is open on the scanning PC.` : ""}</Note>
            </>
          ) : null}
        </main>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-foreground">A read-only view. Nothing here can be changed or uploaded. Estimates are not payouts.</p>

      {/* the phone's tab bar, with room for the home indicator */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }} aria-label="Sections">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${tab === item.id ? "text-accent" : "text-muted-foreground"}`}>
              <span className="text-[18px] leading-none" aria-hidden>{item.icon}</span>
              {item.label}
              {item.id === "messages" && unread ? <span className={`pulse-badge absolute right-[22%] top-1 ${urgentMessages > 0 ? "urgent" : ""}`}>{unread}</span> : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
