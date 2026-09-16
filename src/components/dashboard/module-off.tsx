import Link from "next/link";
import { ArrowRight, Compass, Lock, Settings } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { Button } from "@/components/ui/button";
import { moduleById, type WorkspaceModule } from "@/lib/modules";
import { routes } from "@/lib/routes";

/**
 * What a vertical's page shows when this person can't open it: either the
 * workspace hasn't switched the vertical on ("off" — with the one place to
 * do so), or it has but this member wasn't given it ("unassigned" — with who
 * to ask). Server-safe; rendered *instead of* the page, before any query.
 */
export function ModuleOff({ module, reason = "off" }: { module: WorkspaceModule; reason?: "off" | "unassigned" }) {
  const def = moduleById(module);
  if (!def) return null;
  const Icon = MODULE_ICONS[def.icon];
  const unassigned = reason === "unassigned";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start rounded-2xl border border-dashed border-border bg-card/60 p-8">
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border" style={{ background: `color-mix(in oklab, ${def.hue} 16%, transparent)`, color: def.hue }}>
        {unassigned ? <Lock className="h-5 w-5" strokeWidth={1.75} /> : <Icon className="h-5 w-5" strokeWidth={1.75} />}
      </span>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: def.hue }}>
        {def.title} · {def.label}
      </p>
      <h1 className="mt-2 text-[24px] font-semibold tracking-tight">{unassigned ? `${def.title} isn't assigned to you in this workspace.` : `${def.title} is switched off for this workspace.`}</h1>
      <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
        {unassigned ? "An owner or admin decides which verticals each person can open — ask them to add this one under Settings → Team." : def.description}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {unassigned ? (
          <Button asChild variant="primary">
            <Link href={routes.start}>
              <Compass /> Choose a vertical you can open
            </Link>
          </Button>
        ) : (
          <Button asChild variant="primary">
            <Link href={routes.settings}>
              <Settings /> Turn on in Settings
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={routes.app}>
            Back to my dashboard <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
