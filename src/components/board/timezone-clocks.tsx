"use client";

import * as React from "react";
import { zoneAbbr } from "@/lib/timezones";

/**
 * Live clocks for the zones this viewer's fleets are actually in.
 *
 * From Karl's cohost-manager, with one change: his bar was a fixed row of five
 * US zones for every user. A co-host covering Milwaukee and Tampa does not
 * need Hawaii on screen, and one covering Hawaii very much does — so the zones
 * come from the fleets and trips on the board.
 *
 * The point is not decoration. "Is 7am too early to call this guest" is a
 * question a VA answers dozens of times a day, and answering it by doing
 * arithmetic against their own clock is where mistakes come from.
 */

const subscribeToSeconds = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};

/**
 * The current second, as a number.
 *
 * useSyncExternalStore rather than useState + useEffect because the wall clock
 * IS an external store, and this is the case the API exists for. The naive
 * version — setState in an effect body to avoid a hydration mismatch — is a
 * cascading render, and the version without it shows "--:--" for a full second
 * on every load.
 *
 * The snapshot is a second count, not a Date: React may call getSnapshot
 * several times per render and compares by identity, so a fresh object every
 * call would loop forever.
 */
function useSecond(): number {
  return React.useSyncExternalStore(
    subscribeToSeconds,
    () => Math.floor(Date.now() / 1000),
    // The server has no clock worth showing — its timezone isn't the viewer's.
    // React uses this for the server render and for hydration, then swaps to
    // the real value, which is exactly the behaviour we want.
    () => 0
  );
}

export function TimezoneClocks({ zones }: { zones: string[] }) {
  const second = useSecond();
  const now = second === 0 ? null : new Date(second * 1000);

  if (zones.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {zones.map((zone) => (
        <div key={zone} className="flex items-baseline gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {zoneAbbr(zone)}
          </span>
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {now ? formatClock(now, zone) : "--:--"}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatClock(now: Date, zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return "--:--";
  }
}
