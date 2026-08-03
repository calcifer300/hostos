import { Car, Star } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { cn } from "@/lib/utils";
import { fleetVehicles, type VehicleStatus } from "@/lib/mock/dashboard";

const statusMeta: Record<VehicleStatus, { label: string; dot: string; text: string }> = {
  on_trip: { label: "On trip", dot: "bg-accent", text: "text-accent" },
  available: { label: "Available", dot: "bg-success", text: "text-success" },
  cleaning: { label: "Cleaning", dot: "bg-warning", text: "text-warning" },
  maintenance: { label: "Maintenance", dot: "bg-danger", text: "text-danger" },
};

export function FleetStatusGrid() {
  return (
    <DashboardCard icon={Car} title="Fleet status">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fleetVehicles.map((v) => {
          const status = statusMeta[v.status];
          return (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{v.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{v.location}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {v.rating.toFixed(2)} &middot; {v.tripsThisMonth} trips
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                <span className={cn("text-[11px] font-medium", status.text)}>{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
