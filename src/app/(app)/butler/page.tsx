import { Info, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { AUTOMATIONS, CATEGORY_LABELS, type AutomationCategory } from "@/lib/automations/definitions";
import { getAutomationSettings } from "@/lib/automations/queries";
import { AutomationRow } from "@/components/automations/automation-row";
import { ButlerTaskList } from "@/components/dashboard/butler-task-list";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";

const CATEGORY_ORDER: AutomationCategory[] = ["messaging", "operations", "monitoring"];

/**
 * Butler is HostOS's operations intelligence, not a chat assistant —
 * recommendations here are deterministic (src/lib/dashboard/queries.ts's
 * rule-based Suggestion logic), same as the automation catalog below.
 * Nothing on this page calls an AI provider; the AI Briefing card on
 * Overview remains the one place that does.
 */
export default async function ButlerPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  // Automations belong to the fleet, not to whoever is signed in (migration
  // 0013), so this no longer renders an empty catalog for a signed-out or
  // Companion-only operator.
  const [settings, canEdit] = await Promise.all([
    getAutomationSettings(await getCurrentHostId()),
    canEditCurrentFleet(),
  ]);
  const enabledCount = AUTOMATIONS.filter((a) => settings[a.id]).length;
  const suggestions = (await getDashboardData(email)).suggestions;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Sparkles className="h-[18px] w-[18px] text-accent" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">HostOS</p>
          <h1 className="text-[24px] font-semibold tracking-tight">Butler</h1>
        </div>
      </div>

      <div className="mb-6 flex gap-3 rounded-xl border border-border bg-background/40 px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="text-[13.5px] font-medium">Operations intelligence, not chat</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            Everything below is computed from rules over your synced data — no AI model involved.
            Recommendations become one-click workflows as executors are built; automation rules
            currently record your intent without acting on it yet.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended
        </h2>
        <ButlerTaskList suggestions={suggestions} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Automation rules
          </h2>
          <span className="text-[11.5px] text-muted-foreground">
            {enabledCount} of {AUTOMATIONS.length} enabled
          </span>
        </div>

        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const rules = AUTOMATIONS.filter((a) => a.category === category);
            if (rules.length === 0) return null;

            return (
              <div key={category}>
                <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground/80">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                  {rules.map((automation) => (
                    <AutomationRow
                      key={automation.id}
                      automation={automation}
                      initialEnabled={Boolean(settings[automation.id])}
                      readOnly={!canEdit}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
