import { cn } from "@/lib/utils";

/**
 * The hostOS wordmark: lowercase "host" + accent-blue "OS", same weight,
 * no icon — matches the brand mark supplied for this pass. `withTagline`
 * adds the full "The Operating System for Modern Fleet Operations" line,
 * for places with room to breathe (login, sidebar footer) rather than the
 * tight nav rail.
 */
export function Logo({
  size = "md",
  withTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
}) {
  const wordmarkSize = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[13px]" : "text-[15px]";

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-bold tracking-tight text-foreground", wordmarkSize)}>
        host<span className="text-accent">OS</span>
      </span>
      {withTagline && (
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          The Operating System for Modern Fleet Operations
        </span>
      )}
    </div>
  );
}
