"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeTimer, summarize, type Tone } from "@/lib/board/countdown";
import { OP_STATUSES, type OpStatus } from "@/lib/board/bulk-paste";
import { wallDate, wallTime, zoneAbbr } from "@/lib/timezones";
import { setTripStatus } from "@/lib/actions/board";
import { TimezoneClocks } from "@/components/board/timezone-clocks";
import { BulkPasteDialog } from "@/components/board/bulk-paste-dialog";
import type { BoardTrip, BoardFleet } from "@/lib/board/queries";

/**
 * Every fleet's trips in one list, worst first.
 *
 * The countdowns are recomputed on the client every second from the same
 * engine the server used. That is deliberate rather than lazy: a server-
 * rendered "2h 14m" is wrong the moment it is painted, and a page that only
 * refreshes on a 30-second timer would show a co-host a stale figure for the
 * one number they are actually watching.
 */

const TONE_STYLES: Record<Tone, { dot: string; text: string; row: string }> = {
  critical: { dot: "bg-danger", text: "text-danger", row: "border-l-danger" },
  warning: { dot: "bg-warning", text: "text-warning", row: "border-l-warning" },
  active: { dot: "bg-accent", text: "text-accent", row: "border-l-accent" },
  upcoming: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", row: "border-l-transparent" },
  done: { dot: "bg-success/50", text: "text-muted-foreground", row: "border-l-transparent" },
  neutral: { dot: "bg-muted-foreground/30", text: "text-muted-foreground", row: "border-l-transparent" },
};

type WindowFilter = "all" | "attention" | "today" | "settled";

export function BoardClient({
  trips: initialTrips,
  fleets,
  canEdit,
}: {
  trips: BoardTrip[];
  fleets: BoardFleet[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [fleetFilter, setFleetFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [windowFilter, setWindowFilter] = React.useState<WindowFilter>("all");
  const [search, setSearch] = React.useState("");
  const [pasteOpen, setPasteOpen] = React.useState(false);

  // Drives the per-second recompute below. Storing the tick rather than the
  // readings keeps this to one state write a second regardless of trip count.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Optimistic status edits, so a dropdown doesn't wait on a round trip.
  const [pending, setPending] = React.useState<Record<string, OpStatus>>({});
  const [error, setError] = React.useState<string | null>(null);

  const live = React.useMemo(
    () =>
      initialTrips
        .map((trip) => {
          const status = pending[trip.id] ?? trip.status;
          return { ...trip, status, timer: computeTimer({ ...trip, status }, now) };
        })
        .sort((a, b) => a.timer.sortWeight - b.timer.sortWeight),
    [initialTrips, pending, now]
  );

  const counts = React.useMemo(() => summarize(live.map((t) => t.timer)), [live]);

  const zones = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of live) set.add(t.timezone);
    for (const f of fleets) set.add(f.timezone);
    return [...set].sort();
  }, [live, fleets]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return live.filter((t) => {
      if (fleetFilter !== "all" && t.hostId !== fleetFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      if (windowFilter === "attention") {
        if (t.timer.windowKey !== "overdue" && t.timer.windowKey !== "checkin_overdue") return false;
      } else if (windowFilter === "today") {
        const key = t.timer.windowKey;
        if (key !== "starting" && key !== "ending" && key !== "active" && key !== "overdue" && key !== "checkin_overdue") {
          return false;
        }
      } else if (windowFilter === "settled") {
        if (t.timer.windowKey !== "done" && t.timer.windowKey !== "canceled") return false;
      }

      if (q) {
        const haystack = [t.guestName, t.vehicle, t.plate, t.location, t.fleetName, t.hostLabel, t.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [live, fleetFilter, statusFilter, windowFilter, search]);

  async function changeStatus(trip: BoardTrip, status: OpStatus) {
    setPending((p) => ({ ...p, [trip.id]: status }));
    setError(null);

    const res = await setTripStatus(trip.hostId, trip.id, status);
    if (!res.ok) {
      setPending((p) => {
        const next = { ...p };
        delete next[trip.id];
        return next;
      });
      setError(res.error ?? "Couldn't save that status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Board</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            {fleets.length === 1
              ? "Every trip on your fleet, sorted by what needs you first."
              : `Every trip across ${fleets.length} fleets, sorted by what needs you first.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <TimezoneClocks zones={zones} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Paste from Turo
            </button>
          )}
        </div>
      </header>

      <KpiStrip
        counts={counts}
        active={windowFilter}
        onSelect={(next) => setWindowFilter(next)}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Guest, plate, vehicle, reservation…"
          aria-label="Search trips"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-accent/60"
        />

        {fleets.length > 1 && (
          <Select value={fleetFilter} onChange={setFleetFilter} label="Fleet">
            <option value="all">All fleets</option>
            {fleets.map((f) => (
              <option key={f.hostId} value={f.hostId}>{f.name}</option>
            ))}
          </Select>
        )}

        <Select value={statusFilter} onChange={setStatusFilter} label="Status">
          <option value="all">All statuses</option>
          {OP_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState hasAnyTrips={live.length > 0} canEdit={canEdit} onPaste={() => setPasteOpen(true)} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            {visible.map((trip) => (
              <TripRow
                key={`${trip.hostId}:${trip.id}`}
                trip={trip}
                showFleet={fleets.length > 1}
                canEdit={canEdit}
                onStatus={changeStatus}
              />
            ))}
          </ul>
        )}
      </div>

      {pasteOpen && (
        <BulkPasteDialog
          fleets={fleets}
          onClose={() => setPasteOpen(false)}
          onImported={() => {
            setPasteOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ KPIs */

function KpiStrip({
  counts,
  active,
  onSelect,
}: {
  counts: ReturnType<typeof summarize>;
  active: WindowFilter;
  onSelect: (next: WindowFilter) => void;
}) {
  /**
   * The two overdues are separate tiles because they need opposite actions —
   * chase the guest to collect, versus chase them to bring the car back — and
   * the second is the one that costs money. Karl's engine distinguishes them;
   * collapsing them here would throw that away at the last step.
   */
  const tiles: { key: WindowFilter; label: string; value: number; tone: Tone }[] = [
    { key: "attention", label: "Needs you now", value: counts.checkinOverdue + counts.returnOverdue, tone: "critical" },
    { key: "today", label: "In play", value: counts.startingSoon + counts.endingSoon + counts.active, tone: "warning" },
    { key: "all", label: "All trips", value: counts.total, tone: "neutral" },
    { key: "settled", label: "Settled", value: counts.done, tone: "done" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const isActive = active === tile.key;
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelect(tile.key)}
            aria-pressed={isActive}
            className={cn(
              "rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors",
              isActive ? "border-accent/60" : "border-border hover:border-accent/30"
            )}
          >
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tile.label}
            </p>
            <p
              className={cn(
                "mt-1 text-[26px] font-semibold tabular-nums leading-none",
                tile.value > 0 && tile.tone === "critical" && "text-danger"
              )}
            >
              {tile.value}
            </p>
            {tile.key === "attention" && tile.value > 0 && (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                {counts.checkinOverdue} not collected · {counts.returnOverdue} not returned
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function TripRow({
  trip,
  showFleet,
  canEdit,
  onStatus,
}: {
  trip: BoardTrip;
  showFleet: boolean;
  canEdit: boolean;
  onStatus: (trip: BoardTrip, status: OpStatus) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const tone = TONE_STYLES[trip.timer.tone];
  const anchor = trip.endsAt ?? trip.startsAt;

  return (
    <li className={cn("border-l-2 p-4 transition-colors", tone.row)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {/* The countdown leads, because it is what the row is for. */}
        <div className="w-[168px] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {trip.timer.label}
            </span>
          </div>
          <p className={cn("mt-0.5 font-mono text-[19px] font-medium tabular-nums leading-tight", tone.text)}>
            {trip.timer.text || "—"}
          </p>
        </div>

        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-medium tracking-tight">
              {trip.guestName || "Unnamed guest"}
            </span>
            <span className="text-[13px] text-muted-foreground">{trip.vehicle}</span>
            {trip.plate && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {trip.plate}
              </span>
            )}
            {trip.source === "manual" && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Pasted
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {showFleet && <span className="font-medium">{trip.hostLabel || trip.fleetName}</span>}

            {anchor && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {wallDate(anchor, trip.timezone)} · {wallTime(anchor, trip.timezone)}{" "}
                <span className="opacity-70">{zoneAbbr(trip.timezone)}</span>
              </span>
            )}

            {trip.location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate max-w-[240px]">{trip.location}</span>
              </span>
            )}

            {trip.timezoneUncertain && (
              <span className="inline-flex items-center gap-1 text-warning" title="This zone was guessed from the address — confirm it">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Zone unconfirmed
              </span>
            )}
          </div>

          {trip.notes && <p className="mt-1 text-[12px] text-muted-foreground">{trip.notes}</p>}
        </div>

        <div className="shrink-0">
          {canEdit ? (
            <div className="flex items-center gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <select
                value={trip.status}
                aria-label={`Status for ${trip.guestName ?? trip.id}`}
                onChange={async (e) => {
                  setSaving(true);
                  await onStatus(trip, e.target.value as OpStatus);
                  setSaving(false);
                }}
                className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[12.5px] outline-none transition-colors focus:border-accent/60"
              >
                {OP_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-[12.5px] text-muted-foreground">{trip.status}</span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- states */

function EmptyState({
  hasAnyTrips,
  canEdit,
  onPaste,
}: {
  hasAnyTrips: boolean;
  canEdit: boolean;
  onPaste: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <p className="text-[14px] font-medium">
        {hasAnyTrips ? "Nothing matches those filters" : "No trips on the board yet"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {hasAnyTrips
          ? "Clear a filter to see the rest."
          : "Trips arrive automatically once the Companion extension syncs. You can also paste Turo's trip list straight in."}
      </p>
      {!hasAnyTrips && canEdit && (
        <button
          type="button"
          onClick={onPaste}
          className="mt-4 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Paste from Turo
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-2.5 py-2 text-[12.5px] outline-none transition-colors focus:border-accent/60"
    >
      {children}
    </select>
  );
}
