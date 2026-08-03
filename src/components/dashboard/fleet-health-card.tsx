import { Gauge, TrendingUp, Wrench, AlertCircle, Clock } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { fleetHealth } from "@/lib/mock/dashboard";

export function FleetHealthCard() {
  const h = fleetHealth;

  return (
    <DashboardCard icon={Gauge} title="Fleet health" className="h-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-semibold leading-none tracking-tight">{h.score}</span>
        <span className="flex items-center gap-0.5 text-[12.5px] font-medium text-success">
          <TrendingUp className="h-3 w-3" />+{h.scoreDelta}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">Overall fleet score this week</p>

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Avg. reply time
          </span>
          <span className="font-medium">{h.avgResponseMinutes} min</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Needs attention
          </span>
          <span className="font-medium">{h.needsAttention} vehicles</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Upcoming maintenance
          </span>
          <span className="font-medium">{h.upcomingMaintenance} vehicle</span>
        </div>
      </div>
    </DashboardCard>
  );
}
