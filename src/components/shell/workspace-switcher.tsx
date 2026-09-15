"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchFleet } from "@/lib/actions/fleet";
import { moduleById, type WorkspaceModule } from "@/lib/modules";
import { cn } from "@/lib/utils";

export interface WorkspaceOption {
  hostId: string;
  name: string;
  role: string;
}

/**
 * Picks which workspace the app is showing. Every workspace member sees the
 * control; with one workspace it reads as a label with the role beneath it,
 * which is what a single-fleet operator expects to see there.
 */
export function WorkspaceSwitcher({
  workspaces,
  currentHostId,
  collapsed = false,
  focus = null,
}: {
  workspaces: WorkspaceOption[];
  currentHostId: string;
  collapsed?: boolean;
  /** The vertical in focus, shown under the name so "which business am I in" is never in doubt. */
  focus?: WorkspaceModule | null;
}) {
  const vertical = focus ? moduleById(focus) : undefined;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const current = workspaces.find((w) => w.hostId === currentHostId) ?? workspaces[0] ?? null;

  function choose(hostId: string) {
    if (hostId === currentHostId) return;
    startTransition(async () => {
      const result = await switchFleet(hostId);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't switch workspace.");
        return;
      }
      router.refresh();
    });
  }

  const initials = (current?.name ?? "W")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const trigger = (
    <button
      type="button"
      disabled={pending}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-muted/60 disabled:opacity-60",
        collapsed && "justify-center"
      )}
      aria-label="Switch workspace"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-semibold text-white">
        {initials}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{pending ? "Switching…" : current?.name ?? "Workspace"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              <span className="capitalize">{current?.role ?? "member"}</span>
              {vertical && (
                <>
                  <span className="mx-1 text-muted-foreground/60">·</span>
                  <span style={{ color: vertical.hue }}>{vertical.title}</span>
                </>
              )}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  );

  if (workspaces.length < 2) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.hostId} onSelect={() => choose(w.hostId)}>
            <Check className={cn("h-3.5 w-3.5", w.hostId === currentHostId ? "opacity-100" : "opacity-0")} />
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{w.role}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Building2 />
          New workspaces are created on invitation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
