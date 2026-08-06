import type { LucideIcon } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { Badge } from "@/components/ui/badge";
import type { ScheduleEntry } from "@/lib/dashboard/queries";

export function ScheduleCard({
  icon,
  title,
  entries,
  notReadyLabel,
  emptyMessage,
}: {
  icon: LucideIcon;
  title: string;
  entries: ScheduleEntry[];
  notReadyLabel: string;
  emptyMessage: string;
}) {
  return (
    <DashboardCard
      icon={icon}
      title={title}
      action={<Badge variant="neutral">{entries.length}</Badge>}
      className="h-full"
    >
      {entries.length === 0 ? (
        <CardEmptyState icon={icon} message={emptyMessage} />
      ) : (
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-lg px-1.5 py-2 -mx-1.5 transition-colors hover:bg-muted/60"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12.5px] font-medium text-accent">
              {entry.guestName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{entry.guestName}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {entry.vehicle} &middot; {entry.location}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-medium tabular-nums">{entry.time}</p>
              {entry.needsResponse ? (
                <p className="text-[11px] font-medium text-danger">Guest waiting</p>
              ) : (
                !entry.ready && <p className="text-[11px] font-medium text-warning">{notReadyLabel}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </DashboardCard>
  );
}
