import { CheckCircle2, MessageCircle } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { Badge } from "@/components/ui/badge";
import type { AttentionMessage, MessageUrgency } from "@/lib/dashboard/queries";

const urgencyVariant: Record<MessageUrgency, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const urgencyLabel: Record<MessageUrgency, string> = {
  high: "Urgent",
  medium: "Soon",
  low: "Low",
};

export function MessagesCard({ messages }: { messages: AttentionMessage[] }) {
  return (
    <DashboardCard
      icon={MessageCircle}
      title="Messages needing you"
      action={<Badge variant="neutral">{messages.length}</Badge>}
      className="h-full"
    >
      {messages.length === 0 ? (
        <CardEmptyState icon={CheckCircle2} message="No unread guest messages. You're caught up." />
      ) : (
        <div className="space-y-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className="-mx-1.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13.5px] font-medium">
                  {m.guestName} <span className="text-muted-foreground">&middot;</span> {m.vehicle}
                </p>
                <Badge variant={urgencyVariant[m.urgency]} className="shrink-0">
                  {urgencyLabel[m.urgency]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{m.preview}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{m.receivedAgo}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
