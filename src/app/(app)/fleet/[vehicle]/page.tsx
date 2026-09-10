import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { auth } from "@/auth";
import { cleanSubject, getDashboardData } from "@/lib/dashboard/queries";
import { getCurrentHostId } from "@/lib/host/context";
import { getVehicleSpecs } from "@/lib/trips/queries";
import { getBackendHealth } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";
import { DetailUnavailable } from "@/components/shell/detail-unavailable";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
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

  if (!vehicle) {
    // The fleet list is empty whenever the read failed, so "not in the list"
    // is only genuinely a 404 when we know the read succeeded.
    if (getBackendHealth().state !== "ok") {
      return (
        <DetailUnavailable
          backHref="/fleet"
          backLabel="Fleet"
          title="Can't load this vehicle right now"
          description="HostOS can't reach its database, so this vehicle's details can't be read. Nothing has been lost — try again in a moment."
        />
      );
    }
    notFound();
  }

  const specs = await getVehicleSpecs(await getCurrentHostId(), vehicle.id);
  // vehicleId, not vehicle — the display name collides whenever two
  // vehicles share a make+model (e.g. two Mazda CX-50s), which silently
  // hid every reservation on the detail page for any fleet with duplicates.
  const reservations = data.reservations.filter((r) => r.vehicleId === vehicle.id);
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

      {specs ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Vehicle specs
          </p>
          <div className="grid grid-cols-2 gap-4 text-[12.5px] sm:grid-cols-3">
            {specs.vehicleType && (
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="mt-0.5">{specs.vehicleType}</p>
              </div>
            )}
            {specs.odometer !== null && (
              <div>
                <p className="text-muted-foreground">Odometer</p>
                <p className="mt-0.5 tabular-nums">{specs.odometer.toLocaleString()} mi</p>
              </div>
            )}
            {specs.tankSize && (
              <div>
                <p className="text-muted-foreground">Tank / battery</p>
                <p className="mt-0.5">{specs.tankSize} gal</p>
              </div>
            )}
            {specs.fuelType && (
              <div>
                <p className="text-muted-foreground">MPG (city/hwy)</p>
                <p className="mt-0.5">{specs.fuelType}</p>
              </div>
            )}
            {specs.vin && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-muted-foreground">VIN</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono tabular-nums">
                  {specs.vin}
                  <CopyButton value={specs.vin} label="VIN" />
                </p>
              </div>
            )}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground/70">
            From Colorado Cruisers&rsquo; Vehicle Summary export, not the live Companion sync.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-5">
          <p className="text-[12.5px] font-medium text-muted-foreground">Maintenance & documents</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground/80">
            Needs the HostOS Companion extension&rsquo;s vehicle records. Connect it from Connectors.
          </p>
        </div>
      )}
    </div>
  );
}
