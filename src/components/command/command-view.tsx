import Link from "next/link";
import { AlertTriangle, CalendarClock, CarFront, CircleCheck, Plug, Receipt, Wallet } from "lucide-react";
import { routes } from "@/lib/routes";
import { freshness, type CommandSnapshot, type FleetCard, type ScheduleSlot } from "@/lib/command/snapshot";
import type { StoredSnapshot } from "@/lib/command/queries";

const money = (value: number) => "$" + Math.round(value).toLocaleString("en-US");
const cents = (value: number) => "$" + (value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATE_LABEL: Record<FleetCard["state"], string> = {
  ontrip: "On a Trip", soon: "Pickup Soon", attention: "Needs Attention", available: "Available", unlisted: "Unlisted",
};
const STATE_TONE: Record<FleetCard["state"], string> = {
  ontrip: "bg-primary/10 text-primary", soon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  attention: "bg-warning/10 text-warning", available: "bg-success/10 text-success", unlisted: "bg-muted text-muted-foreground",
};
const TONE_TEXT: Record<string, string> = { red: "text-destructive", amber: "text-warning", cyan: "text-primary", green: "text-success" };

function Panel({ title, aside, children, className = "" }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {aside ? <span className="text-[12px] text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, note, wide = false }: { label: string; value: string; note: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-card)] sm:px-4 sm:py-3.5 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight tabular-nums sm:text-[26px]">{value}</div>
      <div className="text-[11.5px] text-muted-foreground">{note}</div>
    </div>
  );
}

function SetupPrompt() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <Plug className="mx-auto mb-3 h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <h1 className="text-lg font-semibold tracking-tight">The Command Center Is Waiting for Your PC</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        The HostOS extension reads Turo in your browser and sends a copy here. Copy this workspace&rsquo;s pairing key from{" "}
        <Link href={routes.connectors} className="font-medium text-primary underline-offset-2 hover:underline">Connectors</Link>, then in the extension open
        Settings, paste it under <b>hostoscollective.com</b> and press <b>Save and Send Now</b>.
      </p>
    </div>
  );
}

function Schedule({ slots }: { slots: ScheduleSlot[] }) {
  const next = slots.find((slot) => !slot.done);
  if (!slots.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">No pickups or returns today.</p>;
  return (
    <ul className="space-y-1">
      {slots.map((slot, index) => {
        const label = slot.done ? (slot.type === "Pickup" ? "Picked Up" : "Returned") : slot.type;
        return (
          <li key={index} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 ${slot === next ? "bg-primary/10" : ""} ${slot.done ? "opacity-60" : ""}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${slot.done ? "bg-muted-foreground" : slot.type === "Return" ? "bg-success" : "bg-violet-500"}`} />
            <span className="w-[68px] shrink-0 text-[13px] font-semibold tabular-nums">{slot.time}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{label}</span>
            <span className="min-w-0 basis-full truncate pl-[22px] text-[13px] sm:basis-0 sm:flex-1 sm:pl-0">
              <b className="font-semibold">{slot.vehicle ?? slot.plate ?? "Vehicle"}</b>
              <span className="text-muted-foreground"> · {[slot.guest, slot.plate].filter(Boolean).join(" · ")}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FleetGrid({ cars }: { cars: FleetCard[] }) {
  if (!cars.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">No vehicles read yet.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cars.map((car, index) => (
        <article key={`${car.plate ?? car.name}-${index}`} className={`flex gap-3 rounded-xl border border-border p-2.5 ${car.state === "unlisted" ? "opacity-70" : ""}`}>
          {car.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[56px] w-[80px] shrink-0 rounded-lg bg-muted object-cover sm:h-[62px] sm:w-[92px]" />
          ) : (
            <div className="grid h-[56px] w-[80px] shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground sm:h-[62px] sm:w-[92px]"><CarFront className="h-5 w-5" strokeWidth={1.5} aria-hidden /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <b className="truncate text-[13px] font-semibold">{car.name}</b>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATE_TONE[car.state]}`}>{STATE_LABEL[car.state]}</span>
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

function Earnings({ weeks }: { weeks: CommandSnapshot["weeks"] }) {
  const max = Math.max(1, ...weeks.map((week) => week.cents));
  return (
    <div className="flex h-36 items-end gap-1 sm:gap-2">
      {weeks.map((week) => (
        <div key={week.from} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="hidden text-[10.5px] tabular-nums text-muted-foreground sm:block">{week.cents ? money(week.cents / 100) : ""}</span>
          <div className={`w-full rounded-md ${week.future ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ height: `${Math.max(3, (week.cents / max) * 96)}px`, opacity: week.trips ? 1 : 0.3 }} />
          <span className="truncate text-[9.5px] text-muted-foreground sm:text-[10.5px]">{new Date(week.from).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
        </div>
      ))}
    </div>
  );
}

export function CommandView({ stored, now }: { stored: StoredSnapshot | null; now: number }) {
  if (!stored) return <SetupPrompt />;
  const snap = stored.snapshot;
  const age = freshness(snap.builtAt || Date.parse(stored.receivedAt), now);
  const parts = snap.greeting.split(", ");
  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-4 pb-12 sm:space-y-5">
      <header className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {parts[1] ? <>{parts[0]}, <span className="text-primary">{parts[1]}</span></> : snap.greeting}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {snap.attention.length ? `${snap.attention.length} ${snap.attention.length === 1 ? "item needs" : "items need"} your attention.` : "Nothing needs you right now."}
            {snap.brand ? ` · ${snap.brand}` : ""}
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] ${age.stale ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-card text-muted-foreground"}`}>
          {age.stale ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden />}
          Synced {age.label}
          {age.stale ? " · the PC that scans Turo may be off" : ""}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Total Vehicles" value={String(snap.kpis.vehicles)} note={snap.fleetSummary.unlisted ? `${snap.fleetSummary.unlisted} unlisted` : "all listed"} />
        <Tile label="Active Trips" value={String(snap.kpis.activeTrips)} note="on the road now" />
        <Tile label="Upcoming Pickups" value={String(snap.kpis.pickups)} note="next 24 hours" />
        <Tile label="Upcoming Returns" value={String(snap.kpis.returns)} note="next 24 hours" />
        <Tile label="Est. Earnings" value={money(snap.kpis.earningsNext30)} note="trips ending in 30 days" wide />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title={`Trips Requiring Attention · ${snap.attention.length}`} className="lg:col-span-3">
          {snap.attention.length ? (
            <ul className="divide-y divide-border">
              {snap.attention.slice(0, 30).map((row, index) => (
                <li key={index} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold ${TONE_TEXT[row.tone] ?? ""}`}>{row.label}</div>
                    <div className="text-[12px] text-muted-foreground sm:truncate">{[row.vehicle, row.tripId ? `Trip #${row.tripId}` : null].filter(Boolean).join(" · ")}</div>
                    {row.detail ? <div className="text-[12px] text-muted-foreground">{row.detail}</div> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[12px] sm:block sm:text-right">
                    <div className="font-medium">{row.guest ?? "Guest"}</div>
                    {row.tripUrl ? <a href={row.tripUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open Trip</a> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><CircleCheck className="h-4 w-4 text-success" aria-hidden /> All clear.</p>
          )}
        </Panel>

        <div className="space-y-5 lg:col-span-2">
          <Panel title="Today’s Schedule" aside={<span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{snap.schedule.length} events</span>}>
            <Schedule slots={snap.schedule} />
          </Panel>
          <Panel title="Earnings Overview" aside="estimates · not payouts">
            <div className="mb-2 text-[26px] font-semibold tracking-tight tabular-nums">
              {money(snap.kpis.earningsNext30)}
              <span className="ml-2 text-[12px] font-medium text-success">next 30 days · {snap.kpis.tripsNext30} trips</span>
            </div>
            <Earnings weeks={snap.weeks} />
            {snap.unpriced.length ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                {snap.unpriced.length} {snap.unpriced.length === 1 ? "trip is" : "trips are"} not priced yet; open Turo’s Calendar on the PC to price them.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      {snap.tolls ? (
        <Panel
          title="Toll Reimbursements"
          aside={snap.tolls.at ? `as of ${new Date(snap.tolls.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : undefined}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Trips to Bill" value={String(snap.tolls.toBill)} note={cents(snap.tolls.toBillCents)} />
            <Tile label="Billed This Week" value={String(snap.tolls.billedWeekTrips)} note={cents(snap.tolls.billedWeekCents)} />
            <Tile label="Waiting on Trips" value={String(snap.tolls.running)} note={`${cents(snap.tolls.runningCents)} so far`} />
            <Tile label="Need a Look" value={String(snap.tolls.looks)} note="before billing" />
          </div>
          {snap.tolls.weekRows.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5 pr-3">Guest</th><th className="hidden pr-3 sm:table-cell">Vehicle</th><th className="pr-3">Billed</th><th className="pr-3 text-right">Amount</th><th>Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {snap.tolls.weekRows.map((row, index) => (
                    <tr key={index}>
                      <td className="py-1.5 pr-3 font-medium">{row.guest ?? "Guest"}</td>
                      <td className="hidden pr-3 text-muted-foreground sm:table-cell">{row.vehicle}</td>
                      <td className="pr-3">{row.submitted}</td>
                      <td className="pr-3 text-right tabular-nums">{cents(row.cents)}</td>
                      <td className={row.state === "paid" ? "font-semibold text-success" : "font-semibold text-warning"}>{row.state === "paid" ? "Paid" : "Not yet paid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel
        title="Fleet Overview"
        aside={<span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" aria-hidden />{snap.fleetSummary.onTrip} on a trip · {snap.fleetSummary.available} available · {snap.fleetSummary.needsAttention} need attention</span>}
      >
        <FleetGrid cars={snap.fleet} />
      </Panel>
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Receipt className="h-3.5 w-3.5" aria-hidden /> A read-only copy sent by the HostOS extension. Actions that touch Turo are done on the PC.
      </p>
    </div>
  );
}
