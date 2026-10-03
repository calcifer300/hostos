import { CalendarClock, LogIn, LogOut, MessageSquare, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/lib/dashboard/queries";

const kindMeta: Record<TimelineEvent["kind"], { icon: LucideIcon; dot: string }> = {
  pickup: { icon: LogOut, dot: "bg-accent" },
  return: { icon: LogIn, dot: "bg-success" },
  message: { icon: MessageSquare, dot: "bg-warning" },
  maintenance: { icon: Wrench, dot: "bg-muted-foreground" },
};

export function CalendarTimelineCard({ timeline }: { timeline: TimelineEvent[] }) {
  return (
    <DashboardCard icon={CalendarClock} title="Today's timeline">
      {timeline.length === 0 ? (
        <CardEmptyState icon={CalendarClock} message="No pickups, returns, or messages dated today in your synced mail." />
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-1">
          {timeline.map((event, i) => {
            const meta = kindMeta[event.kind];
            const Icon = meta.icon;
            const isLast = i === timeline.length - 1;
            return (
              <div key={event.id} className="relative flex min-w-[168px] flex-1 flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                  <span className="text-[12.5px] font-medium tabular-nums text-muted-foreground">
                    {event.time}
                  </span>
                </div>
                {!isLast && (
                  <div className="absolute left-[3px] top-[22px] hidden h-px w-full bg-border sm:block" />
                )}
                <div className="rounded-lg border border-border bg-background/40 p-3">
                  <Icon className="mb-2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  <p className="text-[13px] font-medium leading-snug">{event.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                    {event.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
