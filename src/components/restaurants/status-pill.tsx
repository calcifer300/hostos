import { cn } from "@/lib/utils";
import type { RestaurantStatus } from "@/lib/restaurants/types";

const META: Record<RestaurantStatus, { label: string; dot: string; text: string; bg: string }> = {
  open: { label: "Open", dot: "bg-success", text: "text-success", bg: "bg-success-bg" },
  paused: { label: "Paused", dot: "bg-warning", text: "text-warning", bg: "bg-warning-bg" },
  closed: { label: "Closed", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
  deactivated: { label: "Deactivated", dot: "bg-danger", text: "text-danger", bg: "bg-danger-bg" },
  unknown: { label: "Unknown", dot: "bg-muted-foreground/50", text: "text-muted-foreground", bg: "bg-muted" },
};

export function StatusPill({ status, className }: { status: RestaurantStatus; className?: string }) {
  const m = META[status] ?? META.unknown;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", m.bg, m.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, status === "open" && "animate-pulse")} />
      {m.label}
    </span>
  );
}

export const STATUS_LABELS = Object.fromEntries(Object.entries(META).map(([k, v]) => [k, v.label])) as Record<RestaurantStatus, string>;
