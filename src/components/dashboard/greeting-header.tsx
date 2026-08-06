"use client";

import * as React from "react";

function getGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingHeader({ firstName }: { firstName?: string | null }) {
  const [now, setNow] = React.useState<Date | null>(null);

  // Same hydration guard as ThemeToggle: the greeting/date depend on the
  // client's clock, so render null until mount to avoid a server/client
  // text mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setNow(new Date()), []);

  const greeting = now ? getGreeting(now.getHours()) : "Good morning";
  const dateLabel = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{dateLabel || " "}</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight sm:text-[38px]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Everything is under control.</p>
      </div>
      <div className="flex items-center gap-1.5 self-start rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground sm:self-auto">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        Fleet operating normally
      </div>
    </div>
  );
}
