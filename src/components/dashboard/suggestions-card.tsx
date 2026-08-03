import { Wand2 } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Badge } from "@/components/ui/badge";
import { aiSuggestions, type SuggestionPriority } from "@/lib/mock/dashboard";

const priorityVariant: Record<SuggestionPriority, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export function SuggestionsCard() {
  return (
    <DashboardCard icon={Wand2} title="iHost suggests" className="h-full">
      <div className="space-y-4">
        {aiSuggestions.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13.5px] font-medium leading-snug">{s.title}</p>
              <Badge variant={priorityVariant[s.priority]} className="shrink-0">
                {s.priority}
              </Badge>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {s.description}
            </p>
            <button className="mt-2.5 text-[12.5px] font-medium text-accent">
              {s.actionLabel} &rarr;
            </button>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
