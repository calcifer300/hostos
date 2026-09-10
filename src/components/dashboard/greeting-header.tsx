"use client";

import * as React from "react";
import { useBackendHealthy } from "@/components/shell/backend-status-context";

// Must match HOST_TIMEZONE in lib/dashboard/queries.ts — that's what
// isToday()/companionScheduleEntries() use to decide what "today" means
// for every pickup/return/overdue calculation. This used to compute the
// greeting/date from the *viewer's own machine* clock/timezone instead,
// so anyone operating HostOS from outside Denver could see a header date
// that disagreed with which reservations the rest of the page called
// "today" — exactly the kind of mismatch that looks like "the sync is
// wrong" when it's actually just two different timezones talking past
// each other.
const HOST_TIMEZONE = "America/Denver";

function getGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function denverHour(date: Date): number {
  const hourStr = date.toLocaleString("en-US", { timeZone: HOST_TIMEZONE, hour: "2-digit", hour12: false });
  return parseInt(hourStr, 10) % 24;
}

export function GreetingHeader({ firstName }: { firstName?: string | null }) {
  const [now, setNow] = React.useState<Date | null>(null);
  // "Everything is under control" and "Fleet operating normally" were both
  // hardcoded. Neither is a claim this header can make while the numbers
  // underneath it are zeroes standing in for data we couldn't read.
  const healthy = useBackendHealthy();

  // Same hydration guard as ThemeToggle: the greeting/date depend on the
  // clock, so render null until mount to avoid a server/client text
  // mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setNow(new Date()), []);

  const greeting = now ? getGreeting(denverHour(now)) : "Good morning";
  const dateLabel = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: HOST_TIMEZONE })
    : "";

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{dateLabel || " "}</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight sm:text-[38px]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {healthy ? "Everything is under control." : "Some fleet data couldn't be loaded just now."}
        </p>
      </div>
      <div className="flex items-center gap-1.5 self-start rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground sm:self-auto">
        <span className="relative flex h-1.5 w-1.5">
          {healthy && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${healthy ? "bg-success" : "bg-warning"}`}
          />
        </span>
        {healthy ? "Fleet operating normally" : "Fleet status unavailable"}
      </div>
    </div>
  );
}
