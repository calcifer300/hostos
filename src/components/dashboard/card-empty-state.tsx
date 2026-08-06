import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/** Consistent "nothing here yet" empty state for data-backed dashboard cards. */
export function CardEmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-6 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="max-w-[32ch] text-[13px] leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}
