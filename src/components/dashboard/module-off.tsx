import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { Button } from "@/components/ui/button";
import { moduleById, type WorkspaceModule } from "@/lib/modules";
import { routes } from "@/lib/routes";

/**
 * What a line-of-business dashboard shows when the workspace hasn't switched
 * that module on: what it is, and the one place to enable it. Server-safe.
 */
export function ModuleOff({ module }: { module: WorkspaceModule }) {
  const def = moduleById(module);
  if (!def) return null;
  const Icon = MODULE_ICONS[def.icon];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start rounded-2xl border border-dashed border-border bg-card/60 p-8">
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{def.label}</p>
      <h1 className="mt-2 text-[24px] font-semibold tracking-tight">This module is switched off for the workspace.</h1>
      <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted-foreground">{def.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="primary">
          <Link href={routes.settings}>
            <Settings /> Turn on in Settings
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={routes.app}>
            Back to Home <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
