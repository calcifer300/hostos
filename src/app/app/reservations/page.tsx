import { CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { cleanSubject, getDashboardData } from "@/lib/dashboard/queries";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { TuroReservation } from "@/types/turo";

const statusVariant: Record<TuroReservation["status"], "accent" | "success" | "neutral" | "danger"> = {
  active: "accent",
  upcoming: "success",
  completed: "neutral",
  cancelled: "danger",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ReservationsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const { reservations } = await getDashboardData(email);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Reservations</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Trips from the HostOS Companion extension when paired, or reconstructed from synced Gmail
          otherwise.
        </p>
      </div>

      {reservations.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <CalendarClock className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No reservations yet</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Pair the HostOS Companion extension or connect Google from Connectors — trips will show
            up here once either source has synced.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight">
                    {r.guestName ?? "Unknown guest"}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {r.vehicle ?? "Vehicle not identified"}
                  </p>
                </div>
                <Badge variant={statusVariant[r.status]} className="shrink-0 capitalize">
                  {r.status}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Booked
                  </p>
                  <p className="mt-0.5 text-[13px] tabular-nums">{formatDate(r.bookedAt)}</p>
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Starts
                  </p>
                  <p className="mt-0.5 text-[13px] tabular-nums">{formatDate(r.startsAt)}</p>
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ends
                  </p>
                  <p className="mt-0.5 text-[13px] tabular-nums">{formatDate(r.endsAt)}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.events.length} linked {r.events.length === 1 ? "email" : "emails"}
                </p>
                <ul className="space-y-1.5">
                  {r.events.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="shrink-0 capitalize text-muted-foreground">{e.kind}</span>
                      <span className="truncate">{cleanSubject(e.subject) || "(no subject)"}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground/70">
                        {formatRelativeTime(e.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
