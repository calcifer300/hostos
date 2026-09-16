"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MODULES, type WorkspaceModule } from "@/lib/modules";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { setWorkspaceModules } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";

/**
 * Which verticals this workspace runs. Turning one on adds its section to
 * the sidebar and its widgets to the dashboard; nothing is deleted when it
 * is turned off — the data waits for the switch to come back.
 */
export function ModuleSettings({ enabled, canEdit }: { enabled: WorkspaceModule[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<WorkspaceModule[]>(enabled);

  function toggle(id: WorkspaceModule, on: boolean) {
    const next = on ? Array.from(new Set([...state, id])) : state.filter((m) => m !== id);
    if (next.length === 0) return void toast.error("Keep at least one module enabled.");
    const previous = state;
    setState(next);
    startTransition(async () => {
      const result = await setWorkspaceModules(next);
      if (!result.ok) {
        setState(previous);
        toast.error(result.error ?? "Couldn't update modules.");
        return;
      }
      toast.success(`${MODULES.find((m) => m.id === id)?.label} ${on ? "enabled" : "disabled"}`);
      router.refresh();
    });
  }

  return (
    <Card padding="md">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Modules</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        HostOS runs any kind of operation. Switch on the verticals this workspace needs; each adds its own pages, integrations and dashboard widgets.
      </p>
      <ul className="mt-4 space-y-2">
        {MODULES.map((m) => {
          const Icon = MODULE_ICONS[m.icon];
          const on = state.includes(m.id);
          return (
            <li key={m.id} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors", on ? "border-accent/40 bg-accent/5" : "border-border")}>
              <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", on ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13.5px] font-medium">
                  {m.title} <span className="font-normal text-muted-foreground">· {m.label}</span>
                  <Badge variant={m.maturity === "live" ? "success" : "accent"}>{m.maturity === "live" ? "Live" : m.maturity === "beta" ? "Beta" : "New"}</Badge>
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{m.description}</p>
              </div>
              <Switch checked={on} disabled={!canEdit || pending} onCheckedChange={(v) => toggle(m.id, v)} aria-label={`Toggle ${m.label}`} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
