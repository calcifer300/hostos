import type { OpStatus } from "@/lib/board/bulk-paste";

/**
 * What a trip needs from you, right now.
 *
 * Ported from Karl's turo-tracker `computeTimer`. The value of this engine is
 * that it distinguishes the two ways a trip goes wrong, which a single
 * "overdue" flag cannot:
 *
 *   - the guest was due to collect and hasn't been checked in  (check-in overdue)
 *   - the guest was due to return and hasn't                   (return overdue)
 *
 * They need opposite actions — chase the guest to collect, versus chase the
 * guest to bring the car back — and the second is the one that costs money.
 */

export type WindowKey =
  | "checkin_overdue"
  | "overdue"
  | "starting"
  | "ending"
  | "upcoming"
  | "active"
  | "done"
  | "canceled"
  | "unset";

export type Tone = "critical" | "warning" | "active" | "upcoming" | "done" | "neutral";

export interface TimerReading {
  /** "2h 14m", or "" when there is nothing to count. */
  text: string;
  /** What the number means: "Starts in", "Overdue by". */
  label: string;
  windowKey: WindowKey;
  tone: Tone;
  /**
   * Sort weight. Ascending puts the most urgent first: overdue is negative and
   * grows more negative the longer it runs, so the worst trip stays on top.
   */
  sortWeight: number;
}

const TWO_HOURS = 2 * 3600 * 1000;

/** Statuses where the guest has not collected the car yet. */
const NOT_STARTED = new Set<OpStatus>(["Not Checked-In", "Pending DL"]);

/** Statuses where the return side is settled and stops counting. */
const RESOLVED_RETURN = new Set<OpStatus>(["Extended", "Returned", "Checked-Out"]);

export interface TimerInput {
  startsAt: string | null;
  endsAt: string | null;
  status: OpStatus | null;
}

/** "3d 4h", "2h 14m", "45m" — coarser as the span grows, which is how people read it. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

const NOTHING: TimerReading = {
  text: "",
  label: "No times set",
  windowKey: "unset",
  tone: "neutral",
  // Sorts last: a trip with no times can't be urgent, but shouldn't vanish.
  sortWeight: Number.MAX_SAFE_INTEGER,
};

export function computeTimer(trip: TimerInput, now: number = Date.now()): TimerReading {
  const status = trip.status ?? "Not Checked-In";

  if (status === "Canceled") {
    return { text: "", label: "Canceled", windowKey: "canceled", tone: "neutral", sortWeight: 8e12 };
  }

  const start = trip.startsAt ? Date.parse(trip.startsAt) : NaN;
  const end = trip.endsAt ? Date.parse(trip.endsAt) : NaN;
  const hasStart = Number.isFinite(start);
  const hasEnd = Number.isFinite(end);

  // --- the guest has not collected the car ---------------------------------
  if (NOT_STARTED.has(status) && hasStart) {
    if (now < start) {
      const diff = start - now;
      const soon = diff <= TWO_HOURS;
      return {
        text: formatDuration(diff),
        label: status === "Pending DL" ? "Licence pending · starts in" : "Starts in",
        windowKey: soon ? "starting" : "upcoming",
        tone: soon ? "warning" : "upcoming",
        sortWeight: diff,
      };
    }

    // Pickup time passed and nobody has been checked in. This is as actionable
    // as a late return and used to be invisible — a single "overdue" flag keyed
    // off the END time never fires for a trip that never began.
    const over = now - start;
    return {
      text: formatDuration(over),
      label: "Check-in overdue by",
      windowKey: "checkin_overdue",
      tone: "critical",
      sortWeight: -over,
    };
  }

  // --- resolved returns stop counting --------------------------------------
  if (RESOLVED_RETURN.has(status)) {
    if (!hasEnd) {
      return { text: "", label: status, windowKey: "done", tone: "done", sortWeight: 9e12 };
    }
    const since = now - end;
    return {
      text: since > 0 ? `${formatDuration(since)} ago` : formatDuration(-since),
      label: status === "Extended" ? "Extended · was due" : status,
      windowKey: "done",
      tone: "done",
      sortWeight: 9e12,
    };
  }

  // --- the trip is running --------------------------------------------------
  if (hasEnd && now <= end) {
    const diff = end - now;
    const soon = diff <= TWO_HOURS;
    return {
      text: formatDuration(diff),
      label: "Ends in",
      windowKey: soon ? "ending" : "active",
      tone: soon ? "warning" : "active",
      sortWeight: diff,
    };
  }

  // --- past the return time -------------------------------------------------
  if (hasEnd && now > end) {
    const over = now - end;
    return {
      text: formatDuration(over),
      label: "Return overdue by",
      windowKey: "overdue",
      tone: "critical",
      // Below check-in overdue on the same scale, so the two interleave by how
      // late they actually are rather than by category.
      sortWeight: -over,
    };
  }

  // Started, but no return time — Turo's list gives one side only.
  if (hasStart && now >= start) {
    return {
      text: formatDuration(now - start),
      label: "Running for",
      windowKey: "active",
      tone: "active",
      sortWeight: 5e12,
    };
  }

  return NOTHING;
}

/** True when this reading is something a person has to act on now. */
export function needsAttention(reading: TimerReading): boolean {
  return reading.windowKey === "overdue" || reading.windowKey === "checkin_overdue";
}

export interface BoardCounts {
  total: number;
  checkinOverdue: number;
  returnOverdue: number;
  startingSoon: number;
  endingSoon: number;
  active: number;
  upcoming: number;
  done: number;
}

/** The KPI strip. One pass over the readings the board already computed. */
export function summarize(readings: TimerReading[]): BoardCounts {
  const counts: BoardCounts = {
    total: readings.length,
    checkinOverdue: 0,
    returnOverdue: 0,
    startingSoon: 0,
    endingSoon: 0,
    active: 0,
    upcoming: 0,
    done: 0,
  };

  for (const r of readings) {
    switch (r.windowKey) {
      case "checkin_overdue": counts.checkinOverdue++; break;
      case "overdue": counts.returnOverdue++; break;
      case "starting": counts.startingSoon++; break;
      case "ending": counts.endingSoon++; break;
      case "active": counts.active++; break;
      case "upcoming": counts.upcoming++; break;
      case "done": counts.done++; break;
      default: break;
    }
  }

  return counts;
}
