"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { switchFleet } from "@/lib/actions/fleet";
import { cn } from "@/lib/utils";

export interface FleetOption {
  hostId: string;
  name: string;
  role: string;
}

/**
 * Picks which fleet the app is showing.
 *
 * Renders nothing for a single-fleet operator — which is every existing
 * install — so the shell looks exactly as it did before multi-fleet support.
 * A control that only ever has one option is noise.
 */
export function FleetSwitcher({
  fleets,
  currentHostId,
}: {
  fleets: FleetOption[];
  currentHostId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (fleets.length < 2) return null;

  const current = fleets.find((f) => f.hostId === currentHostId) ?? fleets[0];

  async function choose(hostId: string) {
    if (hostId === currentHostId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);

    const result = await switchFleet(hostId);

    setPending(false);
    setOpen(false);

    if (!result.ok) {
      setError(result.error ?? "Could not switch fleet.");
      return;
    }
    // Every page is fleet-scoped, so pull fresh server data rather than
    // patching state in place.
    router.refresh();
  }

  return (
    <div ref={ref} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1.5 rounded-md px-1 py-0.5 text-left text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <span className="truncate">{pending ? "Switching…" : current.name}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0" aria-hidden />
      </button>

      {error && <p className="mt-1 px-1 text-[11px] text-danger">{error}</p>}

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[var(--shadow-card)]"
        >
          {fleets.map((fleet) => (
            <li key={fleet.hostId}>
              <button
                type="button"
                role="option"
                aria-selected={fleet.hostId === currentHostId}
                onClick={() => choose(fleet.hostId)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-muted",
                  fleet.hostId === currentHostId ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Check
                  className={cn("h-3 w-3 shrink-0", fleet.hostId === currentHostId ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{fleet.name}</span>
                {fleet.role !== "member" && (
                  <span className="shrink-0 text-[10.5px] uppercase tracking-wide opacity-60">{fleet.role}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
