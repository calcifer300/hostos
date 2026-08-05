import Link from "next/link";
import { Sparkles } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { Badge } from "@/components/ui/badge";
import type { Suggestion, SuggestionPriority } from "@/lib/dashboard/queries";

const priorityVariant: Record<SuggestionPriority, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

/**
 * This is Butler's Overview preview — same rule-based Suggestion logic as
 * the full /butler page, not model-generated, so it still renders with no
 * AI provider configured.
 */
export function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <DashboardCard
      icon={Sparkles}
      title="Butler"
      action={
        <Link href="/butler" className="text-[12px] font-medium text-accent hover:opacity-80">
          Open Butler &rarr;
        </Link>
      }
      className="h-full"
    >
      {suggestions.length === 0 ? (
        <CardEmptyState message="Nothing needs your attention right now." />
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => (
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
              <p className="mt-2.5 text-[12.5px] font-medium text-accent">{s.actionLabel} &rarr;</p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
