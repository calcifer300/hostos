"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Check, Eye, EyeOff, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { moduleById } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { renderWidget, type WidgetData } from "@/components/dashboard/widgets";
import { useBackendHealthy } from "@/components/shell/backend-status-context";
import { saveLayout } from "@/lib/actions/dashboard";
import { dashboardFor, resolveLayout, SIZE_CLASS, WIDGETS, type DashboardScope, type LayoutEntry } from "@/lib/dashboard/widgets";
import type { SetupStatus } from "@/lib/onboarding/status";
import type { WorkspaceModule } from "@/lib/modules";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Where a line-of-business dashboard sends people for the detailed views. */
const SCOPE_LINKS: Record<Exclude<DashboardScope, "home">, { href: string; label: string }[]> = {
  fleet: [
    { href: routes.board, label: "Board" },
    { href: routes.operations, label: "Operations" },
    { href: routes.vehicles, label: "Vehicles" },
    { href: routes.messages, label: "Messages" },
    { href: routes.risk, label: "Risk" },
  ],
  restaurants: [
    { href: routes.upcGenerator, label: "UPC generator" },
    { href: routes.tasks, label: "Tasks" },
  ],
  commerce: [
    { href: routes.connectors, label: "Connectors" },
    { href: routes.tasks, label: "Tasks" },
  ],
  services: [
    { href: routes.servicesDispatch, label: "Dispatch" },
    { href: routes.servicesSchedule, label: "Schedule" },
    { href: routes.servicesCustomers, label: "Customers" },
    { href: routes.servicesEstimates, label: "Estimates" },
    { href: routes.servicesKnowledge, label: "SOPs" },
  ],
  web: [
    { href: routes.tasks, label: "Tasks" },
    { href: routes.notifications, label: "Notifications" },
  ],
  cafe: [
    { href: routes.tasks, label: "Tasks" },
    { href: routes.notifications, label: "Notifications" },
  ],
  salon: [
    { href: routes.tasks, label: "Tasks" },
    { href: routes.notifications, label: "Notifications" },
  ],
  custom: [
    { href: routes.tasks, label: "Tasks" },
    { href: routes.butler, label: "AI Butler" },
  ],
};

function DashboardHeader({ scope }: { scope: Exclude<DashboardScope, "home"> }) {
  const def = dashboardFor(scope);
  const mod = moduleById(scope);
  const Icon = MODULE_ICONS[mod?.icon ?? "Blocks"];
  const healthy = useBackendHealthy();
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {/* The eyebrow wears the vertical's own colour — the same one as its chooser card and sidebar group. */}
        <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: mod?.hue ?? "var(--accent)" }}>
          <motion.span initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 22 }} className="flex h-6 w-6 items-center justify-center rounded-md border border-border" style={{ background: `color-mix(in oklab, ${mod?.hue ?? "var(--accent)"} 16%, transparent)` }}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </motion.span>
          {mod?.title ?? def.eyebrow}
          {/* The chip is the kind of business ("Restaurant operations"); the title already names the platform. */}
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-medium normal-case tracking-normal text-muted-foreground">{mod ? def.eyebrow : def.platform}</span>
        </p>
        {/* the last word is the aside, the landing page's headline voice: "Fleet *dashboard*" */}
        <h1 className="headline mt-2 text-[30px] sm:text-[34px]">{def.title.split(" ").slice(0, -1).join(" ")} <em>{def.title.split(" ").at(-1)}</em></h1>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground">{healthy ? def.description : "Some data couldn't be loaded just now — showing what we have."}</p>
      </div>
      <nav aria-label="Quick links" className="flex flex-wrap gap-1.5">
        {SCOPE_LINKS[scope].map((l) => (
          <Link
            key={l.href + l.label}
            href={l.href}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-[color,border-color,transform] duration-200 ease-[var(--ease-out-expo)] hover:border-accent/40 hover:text-foreground active:scale-[0.97]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function CustomizeRow({ entry, onToggle }: { entry: LayoutEntry; onToggle: () => void }) {
  const controls = useDragControls();
  const def = WIDGETS.find((w) => w.id === entry.id);
  if (!def) return null;
  return (
    <Reorder.Item value={entry} dragListener={false} dragControls={controls} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-card)]">
      <button type="button" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-medium", !entry.visible && "text-muted-foreground")}>{def.title}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{def.description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={entry.visible}
        className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 active:scale-95", entry.visible ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}
        aria-label={entry.visible ? "Hide widget" : "Show widget"}
      >
        {entry.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </Reorder.Item>
  );
}

/**
 * One configurable dashboard. `scope` picks the catalogue and the saved
 * arrangement; Home gets the greeting and setup checklist, a line-of-business
 * dashboard gets its own header and quick links.
 */
export function DashboardGrid({
  scope,
  firstName,
  setup,
  modules,
  initialLayout,
  data,
  signedIn,
}: {
  scope: DashboardScope;
  firstName: string | null;
  setup: SetupStatus;
  modules: WorkspaceModule[];
  initialLayout: LayoutEntry[] | null;
  data: WidgetData;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [layout, setLayout] = React.useState<LayoutEntry[]>(() => resolveLayout(initialLayout, modules, scope));
  const [customizing, setCustomizing] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // After a save + router.refresh() the server sends the new layout; adopt it
  // during render (React's "adjusting state when a prop changes" pattern).
  const [seenInitial, setSeenInitial] = React.useState(initialLayout);
  if (seenInitial !== initialLayout) {
    setSeenInitial(initialLayout);
    setLayout(resolveLayout(initialLayout, modules, scope));
  }

  function save() {
    startTransition(async () => {
      const result = await saveLayout(scope, layout);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't save.");
      toast.success("Dashboard saved");
      setCustomizing(false);
      router.refresh();
    });
  }

  function reset() {
    setLayout(resolveLayout(null, modules, scope));
  }

  const visible = layout.filter((e) => e.visible);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {scope === "home" ? <GreetingHeader firstName={firstName} /> : <DashboardHeader scope={scope} />}
        {signedIn && (
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {customizing ? (
                <motion.div key="editing" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <RotateCcw /> Reset
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setLayout(resolveLayout(initialLayout, modules, scope)); setCustomizing(false); }}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={save} loading={pending}>
                    <Check /> Save layout
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => setCustomizing(true)}>
                    <SlidersHorizontal /> Customize
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {scope === "home" && <SetupChecklist status={setup} />}

      <AnimatePresence initial={false}>
        {customizing && (
          <motion.div
            key="customize"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <p className="mb-3 text-[13px] font-medium">Drag to reorder, tap the eye to show or hide. Saved per person, per workspace, per dashboard.</p>
              <Reorder.Group axis="y" values={layout} onReorder={setLayout} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {layout.map((entry) => (
                  <CustomizeRow key={entry.id} entry={entry} onToggle={() => setLayout((l) => l.map((e) => (e.id === entry.id ? { ...e, visible: !e.visible } : e)))} />
                ))}
              </Reorder.Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className="grid grid-cols-1 gap-6 lg:grid-cols-6">
        <AnimatePresence initial={true}>
          {visible.map((entry, i) => {
            const def = WIDGETS.find((w) => w.id === entry.id);
            if (!def) return null;
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.05, 0.4) }}
                className={cn("min-w-0", SIZE_CLASS[def.size])}
              >
                {renderWidget(entry.id, data)}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
