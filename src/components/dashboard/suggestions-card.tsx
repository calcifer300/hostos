import Link from "next/link";
import { Sparkles } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ButlerTaskList } from "@/components/dashboard/butler-task-list";
import type { Suggestion } from "@/lib/dashboard/queries";

const OVERVIEW_PREVIEW_COUNT = 4;

/**
 * This is Butler's Overview preview — same rule-based Suggestion logic as
 * the full /butler page (now dominated by src/lib/butler/priority.ts's
 * message-driven tasks), not model-generated, so it still renders with no
 * AI provider configured. Capped and ungrouped here since it's a preview,
 * not the full triage view — see /butler for the grouped version.
 */
export function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  const remaining = suggestions.length - OVERVIEW_PREVIEW_COUNT;

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
      <ButlerTaskList suggestions={suggestions.slice(0, OVERVIEW_PREVIEW_COUNT)} compact groupByPriority={false} />
      {remaining > 0 && (
        <Link
          href="/butler"
          className="mt-3 block rounded-lg border border-dashed border-border py-2 text-center text-[12px] font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
        >
          +{remaining} more in Butler
        </Link>
      )}
    </DashboardCard>
  );
}
