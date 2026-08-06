import Link from "next/link";
import { ListChecks } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import type { Suggestion, SuggestionPriority } from "@/lib/dashboard/queries";

const PRIORITY_META: Record<SuggestionPriority, { label: string; colorVar: string; dot: string }> = {
  high: { label: "High", colorVar: "--danger", dot: "bg-danger" },
  medium: { label: "Medium", colorVar: "--warning", dot: "bg-warning" },
  low: { label: "Low", colorVar: "--success", dot: "bg-success" },
};

/** Real breakdown of Butler's rule-based suggestions by priority — same list SuggestionsCard renders. */
export function TaskPriorityCard({ suggestions }: { suggestions: Suggestion[] }) {
  const counts: Record<SuggestionPriority, number> = { high: 0, medium: 0, low: 0 };
  for (const s of suggestions) counts[s.priority] += 1;

  const segments = (Object.keys(PRIORITY_META) as SuggestionPriority[]).map((priority) => ({
    label: PRIORITY_META[priority].label,
    value: counts[priority],
    colorVar: PRIORITY_META[priority].colorVar,
  }));

  return (
    <DashboardCard icon={ListChecks} title="Task priority" className="h-full">
      {suggestions.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Nothing open right now.</p>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <DonutChart segments={segments} centerValue={suggestions.length} centerLabel="Total" />
            <div className="flex-1 space-y-2">
              {(Object.keys(PRIORITY_META) as SuggestionPriority[]).map((priority) => (
                <div key={priority} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[priority].dot}`} />
                    {PRIORITY_META[priority].label}
                  </span>
                  <span className="font-medium tabular-nums">{counts[priority]}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/butler"
            className="mt-4 block rounded-lg border border-border py-2 text-center text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            Open Butler &rarr;
          </Link>
        </>
      )}
    </DashboardCard>
  );
}
