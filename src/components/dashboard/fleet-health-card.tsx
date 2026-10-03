import { Gauge, Mail, CalendarCheck, CarFront, Clock } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import type { FleetHealth } from "@/lib/dashboard/queries";

export function FleetHealthCard({ health }: { health: FleetHealth }) {
  return (
    <DashboardCard icon={Gauge} title="Fleet health" className="h-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-semibold leading-none tracking-tight">
          {health.score}
        </span>
        <span className="text-[12.5px] font-medium text-muted-foreground">/ 100</span>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Calculated from your synced Gmail activity
      </p>

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Unread messages
          </span>
          <span className="font-medium">{health.unreadCount}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CarFront className="h-3.5 w-3.5" />
            Active reservations
          </span>
          <span className="font-medium">{health.activeReservations}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" />
            Pending trips
          </span>
          <span className="font-medium">{health.pendingTrips}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Response backlog
          </span>
          <span className="font-medium">{health.responseBacklog}</span>
        </div>
      </div>
    </DashboardCard>
  );
}
