import Link from "next/link";
import { Car } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import type { FleetVehicle, VehicleStatus } from "@/lib/dashboard/queries";

const STATUS_META: Record<VehicleStatus, { label: string; colorVar: string; dot: string }> = {
  on_trip: { label: "On trip", colorVar: "--accent", dot: "bg-accent" },
  available: { label: "Available", colorVar: "--success", dot: "bg-success" },
  cleaning: { label: "Turnaround", colorVar: "--warning", dot: "bg-warning" },
  maintenance: { label: "Maintenance", colorVar: "--danger", dot: "bg-danger" },
};

/** Real breakdown of `vehicles` by status — the same array every other fleet widget reads. */
export function FleetOverviewCard({ vehicles }: { vehicles: FleetVehicle[] }) {
  const counts: Record<VehicleStatus, number> = { on_trip: 0, available: 0, cleaning: 0, maintenance: 0 };
  for (const v of vehicles) counts[v.status] += 1;

  const segments = (Object.keys(STATUS_META) as VehicleStatus[]).map((status) => ({
    label: STATUS_META[status].label,
    value: counts[status],
    colorVar: STATUS_META[status].colorVar,
  }));

  return (
    <DashboardCard icon={Car} title="Fleet overview" className="h-full">
      {vehicles.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">No vehicles synced yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <DonutChart segments={segments} centerValue={vehicles.length} centerLabel="Total" />
            <div className="flex-1 space-y-2">
              {(Object.keys(STATUS_META) as VehicleStatus[]).map((status) => (
                <div key={status} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} />
                    {STATUS_META[status].label}
                  </span>
                  <span className="font-medium tabular-nums">{counts[status]}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/fleet"
            className="mt-4 block rounded-lg border border-border py-2 text-center text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            View fleet &rarr;
          </Link>
        </>
      )}
    </DashboardCard>
  );
}
