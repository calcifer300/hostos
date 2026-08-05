import { Activity, Star, DollarSign, CalendarCheck, MessageSquare, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import type { ActivityEntry, ActivityKind } from "@/lib/dashboard/queries";

const kindIcon: Record<ActivityKind, LucideIcon> = {
  booking: CalendarCheck,
  message: MessageSquare,
  payment: DollarSign,
  review: Star,
  maintenance: Wrench,
};

export function ActivityCard({ activity }: { activity: ActivityEntry[] }) {
  return (
    <DashboardCard icon={Activity} title="Recent activity" className="h-full">
      {activity.length === 0 ? (
        <CardEmptyState message="Nothing synced yet. Sync Gmail from the Inbox to populate your activity feed." />
      ) : (
        <div className="space-y-4">
          {activity.map((entry, i) => {
            const Icon = kindIcon[entry.kind];
            const isLast = i === activity.length - 1;
            return (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-[13.5px] leading-snug">{entry.description}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{entry.timeAgo}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
