import Link from "next/link";
import { Car } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { FleetVehicle, VehicleStatus } from "@/lib/dashboard/queries";

const statusMeta: Record<VehicleStatus, { label: string; dot: string; text: string }> = {
  on_trip: { label: "On trip", dot: "bg-accent", text: "text-accent" },
  available: { label: "Available", dot: "bg-success", text: "text-success" },
  cleaning: { label: "Turnaround", dot: "bg-warning", text: "text-warning" },
  maintenance: { label: "Maintenance", dot: "bg-danger", text: "text-danger" },
};

export function FleetStatusGrid({
  vehicles,
  title = "Fleet status",
  emptyMessage = "No vehicles identified yet. Vehicles appear here once your synced Turo mail names them.",
}: {
  vehicles: FleetVehicle[];
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <DashboardCard icon={Car} title={title}>
      {vehicles.length === 0 ? (
        <CardEmptyState icon={Car} message={emptyMessage} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const status = statusMeta[v.status];
            return (
              <Link
                key={v.id}
                href={`/fleet/${encodeURIComponent(v.name)}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3.5 transition-colors hover:border-accent/40 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{v.name}</p>
                  {v.nextEventLabel ? (
                    <p className="mt-0.5 truncate text-[12px] font-medium text-accent">
                      {v.nextEventLabel}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {v.tripCount} {v.tripCount === 1 ? "reservation" : "reservations"}
                    </p>
                  )}
                  {v.lastActivity && (
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">
                      Last activity {formatRelativeTime(v.lastActivity)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                  <span className={cn("text-[11px] font-medium", status.text)}>{status.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
