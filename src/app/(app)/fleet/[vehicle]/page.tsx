import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { auth } from "@/auth";
import { cleanSubject, getDashboardData } from "@/lib/dashboard/queries";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicle: string }>;
}) {
  const { vehicle: encodedVehicle } = await params;
  const vehicleName = decodeURIComponent(encodedVehicle);

  const session = await auth();
  const email = session?.user?.email ?? null;

  const data = await getDashboardData(email);
  const vehicle = data.vehicles.find((v) => v.name === vehicleName);
  if (!vehicle) notFound();

  const reservations = data.reservations.filter((r) => r.vehicle === vehicleName);
  const events = data.events
    .filter((e) => e.vehicle === vehicleName)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/fleet"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Fleet
      </Link>

      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">{vehicle.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-[14px] text-muted-foreground">
          <Star className="h-3.5 w-3.5" />
          {vehicle.tripCount} {vehicle.tripCount === 1 ? "reservation" : "reservations"}
          {vehicle.lastActivity && ` · Last activity ${formatRelativeTime(vehicle.lastActivity)}`}
        </p>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Trips
        </h2>
        {reservations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-[13.5px] text-muted-foreground shadow-[var(--shadow-card)]">
            No reservations linked to this vehicle yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold tracking-tight">
                    {r.guestName ?? "Unknown guest"}
                  </p>
                  <Badge variant={statusVariant[r.status]} className="shrink-0 capitalize">
                    {r.status}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Booked</p>
                    <p className="mt-0.5 tabular-nums">{formatDate(r.bookedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Starts</p>
                    <p className="mt-0.5 tabular-nums">{formatDate(r.startsAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ends</p>
                    <p className="mt-0.5 tabular-nums">{formatDate(r.endsAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Timeline
        </h2>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-[13.5px] text-muted-foreground shadow-[var(--shadow-card)]">
            No activity synced for this vehicle yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            {events.map((e, i) => (
              <div
                key={e.id}
                className={
                  "flex items-start justify-between gap-3 px-5 py-3.5" +
                  (i > 0 ? " border-t border-border" : "")
                }
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {cleanSubject(e.subject) || "(no subject)"}
                  </p>
                  <p className="mt-0.5 text-[12px] capitalize text-muted-foreground">
                    {e.kind}
                    {e.guestName ? ` · ${e.guestName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                  {formatRelativeTime(e.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border p-5">
        <p className="text-[12.5px] font-medium text-muted-foreground">Maintenance & documents</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground/80">
          Needs the HostOS Companion extension&rsquo;s vehicle records. Connect it from Connectors.
        </p>
      </div>
    </div>
  );
}
