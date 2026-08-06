"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, LogIn, LogOut, MessageCircle } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { CardEmptyState } from "@/components/dashboard/card-empty-state";
import { cn } from "@/lib/utils";
import type { OperationsDay } from "@/lib/dashboard/queries";

/**
 * Day-by-day fleet operations board — Today, Tomorrow, then calendar dates —
 * built once server-side from the same `vehicles` array every other card
 * reads (see buildOperationsTimeline in lib/dashboard/queries.ts), so this
 * never disagrees with Fleet Status or the pickups/returns cards. Replaces
 * the old flat, priority-sorted grid that read as shuffled rather than
 * chronological.
 */
export function VehicleOperationsTimeline({ days }: { days: OperationsDay[] }) {
  return (
    <DashboardCard icon={CalendarDays} title="Fleet operations timeline" className="h-full">
      {days.length === 0 ? (
        <CardEmptyState
          icon={CalendarDays}
          message="No pickups or returns on the books yet. Scheduled vehicles will line up here by day, automatically."
        />
      ) : (
        <div className="space-y-6">
          {days.map((day, dayIndex) => (
            <motion.div
              key={day.dateKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(dayIndex, 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-2.5 flex items-baseline gap-2">
                <h3 className="text-[13.5px] font-semibold tracking-tight">{day.label}</h3>
                <span className="text-[11.5px] text-muted-foreground">
                  {day.entries.length} {day.entries.length === 1 ? "vehicle" : "vehicles"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {day.entries.map((entry, i) => (
                  <motion.div
                    key={`${entry.id}-${entry.kind}`}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.03 }}
                  >
                    <Link
                      href={`/fleet/${encodeURIComponent(entry.vehicle)}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 transition-all hover:-translate-y-px hover:border-accent/40 hover:bg-muted/40 hover:shadow-sm"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          entry.kind === "pickup" ? "bg-accent/10" : "bg-success/10"
                        )}
                      >
                        {entry.kind === "pickup" ? (
                          <LogOut className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
                        ) : (
                          <LogIn className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{entry.vehicle}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {entry.kind === "pickup" ? "Pickup" : "Return"} &middot; {entry.time}
                        </p>
                      </div>
                      {entry.needsResponse && (
                        <span
                          title="Guest response needed"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/15"
                        >
                          <MessageCircle className="h-3 w-3 text-warning" strokeWidth={2} />
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
