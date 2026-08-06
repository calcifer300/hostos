import { BarChart3, Car, CalendarCheck, Mail } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";
import type { TuroEventKind } from "@/types/turo";

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px]">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const data = await getDashboardData(email);

  // Fleet health, reservations, and vehicle counts all come from the
  // HostOS Companion extension too, not just Gmail — gating this whole
  // page on a Google session hid real, already-synced Companion data from
  // a Companion-only host. Only the per-event-kind breakdown below stays
  // Gmail-only, since Companion doesn't send that shape of data.
  if (!data.hasSyncedData) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            How your fleet is actually running.
          </p>
        </div>
        <ConnectGoogleNotice
          icon={BarChart3}
          title="Connect a data source for insights"
          description="Insights are computed from your synced Companion trips or Gmail activity. Pair the HostOS Companion extension or connect Google from Connectors to see real numbers here."
        />
      </div>
    );
  }

  const eventCounts = data.events.reduce<Partial<Record<TuroEventKind, number>>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});
  const maxEventCount = Math.max(1, ...Object.values(eventCounts));

  const reservationCounts = data.reservations.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { active: 0, upcoming: 0, completed: 0, cancelled: 0 }
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          How your fleet is actually running, from synced Companion and Gmail activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Fleet health" value={data.fleetHealth.score} sub="out of 100" />
        <StatTile
          label="Response backlog"
          value={data.fleetHealth.responseBacklog}
          sub="unread over 2h"
        />
        <StatTile label="Vehicles tracked" value={data.vehicles.length} sub="from synced data" />
        <StatTile
          label="Total reservations"
          value={data.reservations.length}
          sub={`${reservationCounts.active} active`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <CalendarCheck className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.75} />
            <h2 className="text-[13.5px] font-semibold tracking-tight">Reservations by status</h2>
          </div>
          <div className="space-y-3">
            {(Object.entries(reservationCounts) as [string, number][]).map(([status, count]) => (
              <Bar
                key={status}
                label={status}
                count={count}
                max={Math.max(1, ...Object.values(reservationCounts))}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.75} />
            <h2 className="text-[13.5px] font-semibold tracking-tight">Activity by type</h2>
          </div>
          {Object.keys(eventCounts).length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing synced yet.</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(eventCounts) as [TuroEventKind, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => (
                  <Bar key={kind} label={kind} count={count} max={maxEventCount} />
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border p-5">
        <div className="flex items-center gap-2">
          <Car className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.75} />
          <p className="text-[12.5px] font-medium text-muted-foreground">Revenue and utilization</p>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground/80">
          Needs pricing and per-trip earnings from the HostOS Companion extension — Gmail doesn&rsquo;t
          carry that data. Connect it from Connectors to unlock this.
        </p>
      </div>
    </div>
  );
}
