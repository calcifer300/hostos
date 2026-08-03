import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  icon: Icon,
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  icon?: LucideIcon;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.75} />}
            {title && <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(title || action ? "px-5 pb-5" : "p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
