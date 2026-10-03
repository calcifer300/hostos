import { detectTimezone, todayInZone, instantFromWallTime } from "@/lib/timezones";

/**
 * Parses the text you get from selecting Turo's trip list and hitting copy.
 *
 * Ported from Karl's turo-tracker. Two of his parsers exist; this is the later
 * one, and it is better for a specific reason: it reads each block
 * POSITIONALLY — status, host, vehicle, location, then the rest — instead of
 * hunting the whole block with regexes for "the line that looks like a plate".
 * The earlier version guessed the plate as "the last short alphanumeric line",
 * which quietly picked up model years and state codes.
 *
 * THE LIMITATION IS TURO'S, NOT THIS PARSER'S. Turo's list shows exactly ONE
 * timestamp per trip: "Starting at 8:00 PM" gives you the start and nothing
 * else, "Ended at 4:00 AM" gives you the end, and "In progress" gives you
 * neither. The missing half cannot be recovered from the paste — so it is left
 * blank and flagged, rather than invented.
 */

export type OpStatus =
  | "Not Checked-In"
  | "Pending DL"
  | "Checked-In"
  | "Extended"
  | "Late"
  | "Not Checked-Out"
  | "Returned"
  | "Checked-Out"
  | "Canceled";

export const OP_STATUSES: OpStatus[] = [
  "Not Checked-In",
  "Pending DL",
  "Checked-In",
  "Extended",
  "Late",
  "Not Checked-Out",
  "Returned",
  "Checked-Out",
  "Canceled",
];

export interface TripDraft {
  reservationId: string;
  hostLabel: string;
  guest: string;
  vehicle: string;
  plate: string;
  location: string;
  timezone: string;
  timezoneUncertain: boolean;
  /** Absolute instant, or null when Turo's list didn't carry this side. */
  startsAt: string | null;
  endsAt: string | null;
  status: OpStatus;
  /** Extra lines Turo prints between the guest and the vehicle repeat. */
  tags: string[];
  /** Everything a person should check before importing this row. */
  warnings: string[];
  rawBlock: string;
}

const STATUS_LINE =
  /^(In progress|Return in progress|Swap pending|Ended at .+|Ending at .+|Starting at .+|Started at .+)$/i;
const HOST_LINE = /^\((.+?)(?:['’]s)?\s+vehicle\)$/i;
const TIME_LINE = /^(Ended|Ending|Starting|Started) at\s+(\d{1,2}:\d{2}\s*[AP]M)$/i;
const ID_LINE = /^(.*?)\s*#(\d+)\s*$/;

/** "8:00 PM" -> "20:00". Returns "" for anything it can't read. */
function to24Hour(value: string): string {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return "";

  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const meridiem = m[3].toUpperCase();

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export function parseBulkPaste(raw: string, dateOverride?: string): TripDraft[] {
  const rawLines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  /**
   * "Swap pending" sometimes appears on its own line directly BEFORE the real
   * status line for the same trip. Left in the stream it terminates the
   * previous block early and swallows the next trip's opening line, so it is
   * pulled out here and re-attached as a tag on the trip it belongs to.
   */
  const lines: string[] = [];
  const swapBefore = new Set<number>();
  for (let i = 0; i < rawLines.length; i++) {
    if (/^swap pending$/i.test(rawLines[i]) && i + 1 < rawLines.length && STATUS_LINE.test(rawLines[i + 1])) {
      swapBefore.add(lines.length);
      continue;
    }
    lines.push(rawLines[i]);
  }

  const blockStarts: number[] = [];
  lines.forEach((line, i) => {
    if (STATUS_LINE.test(line)) blockStarts.push(i);
  });

  const drafts: TripDraft[] = [];

  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b];
    const end = b + 1 < blockStarts.length ? blockStarts[b + 1] : lines.length;
    const block = lines.slice(start, end);
    const warnings: string[] = [];

    if (block.length < 6) warnings.push("Block looks truncated — check this one against Turo");

    const statusLine = block[0] ?? "";
    const hostLine = block[1] ?? "";
    const vehicleLine = block[2] ?? "";
    const locationLine = block[3] ?? "";

    const hostMatch = hostLine.match(HOST_LINE);
    const hostLabel = hostMatch ? hostMatch[1].trim() : "";
    if (!hostMatch) warnings.push("Couldn't read which host this belongs to");

    // "Name #12345", somewhere after the first four positional lines.
    const rest = block.slice(4);
    let idIndex = -1;
    for (let i = 0; i < rest.length; i++) {
      if (ID_LINE.test(rest[i])) {
        idIndex = i;
        break;
      }
    }

    let guest = "";
    let reservationId = "";
    if (idIndex >= 0) {
      const m = rest[idIndex].match(ID_LINE)!;
      guest = m[1].trim();
      reservationId = m[2].trim();
      // Turo repeats the display name either side of the #: "Juan Juan #601…".
      const parts = guest.split(/\s+/);
      if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
        guest = parts[0];
      }
    } else {
      warnings.push("No guest name or reservation # in this block");
    }

    // Turo closes each block by repeating the vehicle, then the plate.
    const plate = rest.length ? rest[rest.length - 1] : "";
    const vehicleRepeatIndex = rest.length - 2;

    const tags: string[] = [];
    if (idIndex >= 0) {
      for (let i = idIndex + 1; i < vehicleRepeatIndex; i++) {
        if (rest[i]) tags.push(rest[i]);
      }
    }
    if (/swap pending/i.test(statusLine) || swapBefore.has(start)) tags.push("Swap pending");

    const zone = detectTimezone(locationLine);
    if (!zone.confident) warnings.push(zone.reason);

    let status: OpStatus = "Not Checked-In";
    let startsAt: string | null = null;
    let endsAt: string | null = null;

    if (/^in progress$/i.test(statusLine) || /^return in progress$/i.test(statusLine)) {
      // The trip is running but Turo prints no time at all for these.
      status = "Checked-In";
    } else {
      const timeMatch = statusLine.match(TIME_LINE);
      if (timeMatch) {
        const verb = timeMatch[1].toLowerCase();
        const time24 = to24Hour(timeMatch[2]);
        // Today WHERE THE CAR IS. See todayInZone — dating a Honolulu list
        // from a Manila clock puts every trip a day out.
        const dateStr = dateOverride || todayInZone(zone.zone);
        const instant = time24 ? instantFromWallTime(dateStr, time24, zone.zone) : null;

        if (verb === "starting") {
          startsAt = instant;
          status = "Not Checked-In";
        } else if (verb === "started") {
          // Past tense: already begun, typically after a vehicle swap.
          startsAt = instant;
          status = "Checked-In";
        } else {
          // "ending" and "ended" both anchor the return side.
          endsAt = instant;
          status = "Not Checked-Out";
        }
      } else if (!/swap pending/i.test(statusLine)) {
        warnings.push("Couldn't read the status line");
      }
    }

    if (!startsAt && !endsAt) {
      warnings.push("Turo's list only carries one time per trip — fill in the other side after import");
    }

    drafts.push({
      reservationId,
      hostLabel,
      guest,
      vehicle: vehicleLine,
      plate,
      location: locationLine,
      timezone: zone.zone,
      timezoneUncertain: !zone.confident,
      startsAt,
      endsAt,
      status,
      tags,
      warnings,
      rawBlock: block.join("\n"),
    });
  }

  return drafts;
}
