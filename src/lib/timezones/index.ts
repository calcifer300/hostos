/**
 * Timezone detection for trip locations.
 *
 * Ported from Karl's turo-tracker (tzdata.js), which exists because a co-host
 * team covering Hawaii and Florida cannot read a trip list in one clock. The
 * lookup tables are his; the additions here are a third detection pass for
 * bare city names, and returning the reason so the UI can say *why* it is
 * unsure instead of only that it is.
 *
 * Deliberately NOT server-only: the board renders wall-clock times on the
 * client and the bulk-paste review screen detects zones before anything is
 * saved.
 */

export interface UsZone {
  id: string;
  label: string;
  abbr: string;
}

/** The zones offered in pickers. Value is an IANA zone id. */
export const US_ZONES: UsZone[] = [
  { id: "America/New_York", label: "Eastern (ET)", abbr: "ET" },
  { id: "America/Chicago", label: "Central (CT)", abbr: "CT" },
  { id: "America/Denver", label: "Mountain (MT)", abbr: "MT" },
  { id: "America/Phoenix", label: "Mountain — no DST (AZ)", abbr: "MT" },
  { id: "America/Los_Angeles", label: "Pacific (PT)", abbr: "PT" },
  { id: "America/Anchorage", label: "Alaska (AKT)", abbr: "AKT" },
  { id: "Pacific/Honolulu", label: "Hawaii (HST)", abbr: "HST" },
];

const ZONE_ABBR: Record<string, string> = Object.fromEntries(
  US_ZONES.map((z) => [z.id, z.abbr])
);

/** Short label for a zone id — "ET", "HST". Falls back to the id's city part. */
export function zoneAbbr(zone: string | null | undefined): string {
  if (!zone) return "—";
  return ZONE_ABBR[zone] ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

/**
 * Majority zone per US state.
 *
 * "Majority" is doing real work in that sentence — thirteen of these states
 * span more than one zone, and for those this value is a starting guess, not
 * an answer. See SPLIT_STATES.
 */
const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Denver",
  IL: "America/Chicago", IN: "America/New_York", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/New_York", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York",
  NM: "America/Denver", NY: "America/New_York", NC: "America/New_York",
  ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago",
  TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York",
  VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver", DC: "America/New_York",
  PR: "America/Puerto_Rico",
};

/** States that genuinely span zones — detection there is flagged, never asserted. */
const SPLIT_STATES = new Set([
  "FL", "MI", "IN", "KY", "TN", "TX", "ID", "OR", "NE", "SD", "ND", "KS", "AZ",
]);

/** Airport and hub codes Turo pickups actually use. */
const AIRPORT_TZ: Record<string, string> = {
  IAH: "America/Chicago", HOU: "America/Chicago", DFW: "America/Chicago",
  DAL: "America/Chicago", AUS: "America/Chicago", SAT: "America/Chicago",
  MSY: "America/Chicago", MSP: "America/Chicago", ORD: "America/Chicago",
  MDW: "America/Chicago", STL: "America/Chicago", MCI: "America/Chicago",
  MKE: "America/Chicago", MEM: "America/Chicago", BNA: "America/Chicago",
  OKC: "America/Chicago", TUL: "America/Chicago", OMA: "America/Chicago",

  PHX: "America/Phoenix",

  LAS: "America/Los_Angeles", RNO: "America/Los_Angeles",
  LAX: "America/Los_Angeles", SAN: "America/Los_Angeles",
  SFO: "America/Los_Angeles", OAK: "America/Los_Angeles",
  SJC: "America/Los_Angeles", SMF: "America/Los_Angeles",
  SEA: "America/Los_Angeles", PDX: "America/Los_Angeles",
  BUR: "America/Los_Angeles", ONT: "America/Los_Angeles", SNA: "America/Los_Angeles",
  LGB: "America/Los_Angeles",

  DEN: "America/Denver", SLC: "America/Denver", ABQ: "America/Denver",
  BOI: "America/Denver", COS: "America/Denver",

  JFK: "America/New_York", LGA: "America/New_York", EWR: "America/New_York",
  BOS: "America/New_York", PHL: "America/New_York", DCA: "America/New_York",
  IAD: "America/New_York", BWI: "America/New_York", ATL: "America/New_York",
  MIA: "America/New_York", FLL: "America/New_York", MCO: "America/New_York",
  TPA: "America/New_York", CLT: "America/New_York", RDU: "America/New_York",
  DTW: "America/New_York", CLE: "America/New_York", CMH: "America/New_York",
  PIT: "America/New_York", IND: "America/New_York", CVG: "America/New_York",
  PIE: "America/New_York",

  ANC: "America/Anchorage",
  HNL: "Pacific/Honolulu", OGG: "Pacific/Honolulu", KOA: "Pacific/Honolulu",
  LIH: "Pacific/Honolulu", ITO: "Pacific/Honolulu",
};

/**
 * Cities that appear in pickup addresses without a usable state suffix.
 *
 * Not in Karl's original. His parser fell back to Central for anything it
 * could not read, which is a coin flip presented as a fact — a Kahului pickup
 * silently landing in Central is five hours wrong, and a five-hour error on a
 * pickup countdown is the whole product failing quietly.
 */
const CITY_TZ: Record<string, string> = {
  honolulu: "Pacific/Honolulu", kahului: "Pacific/Honolulu", kona: "Pacific/Honolulu",
  anchorage: "America/Anchorage",
  phoenix: "America/Phoenix", mesa: "America/Phoenix", scottsdale: "America/Phoenix",
  tempe: "America/Phoenix", tucson: "America/Phoenix",
  denver: "America/Denver", "salt lake city": "America/Denver", albuquerque: "America/Denver",
  "los angeles": "America/Los_Angeles", cerritos: "America/Los_Angeles",
  "el segundo": "America/Los_Angeles", "san diego": "America/Los_Angeles",
  "long beach": "America/Los_Angeles", "las vegas": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles", seattle: "America/Los_Angeles",
  portland: "America/Los_Angeles",
  houston: "America/Chicago", milwaukee: "America/Chicago", chicago: "America/Chicago",
  dallas: "America/Chicago", austin: "America/Chicago", "san antonio": "America/Chicago",
  "new orleans": "America/Chicago", minneapolis: "America/Chicago",
  tampa: "America/New_York", clearwater: "America/New_York", miami: "America/New_York",
  orlando: "America/New_York", atlanta: "America/New_York", boston: "America/New_York",
  "new york": "America/New_York", philadelphia: "America/New_York",
};

export interface ZoneDetection {
  zone: string;
  /** False means this is a guess a person should confirm. */
  confident: boolean;
  /** Why, in words the board can show verbatim. */
  reason: string;
}

const FALLBACK: ZoneDetection = {
  zone: "America/Chicago",
  confident: false,
  reason: "Couldn't read a location — set the zone by hand",
};

/**
 * Detect the IANA zone for a raw Turo location string.
 *
 * Three passes, most specific first: airport code, then state suffix, then a
 * city name anywhere in the string. `confident: false` is returned for split
 * states and for the city pass, because both can be wrong in ways only the
 * person who booked the trip would notice.
 */
export function detectTimezone(raw: string | null | undefined): ZoneDetection {
  if (!raw || !raw.trim()) return FALLBACK;
  const text = raw.trim();

  // "IAH – Houston, TX", "OGG - Kahului, HI". Turo writes these with an en
  // dash; hand-typed ones use a hyphen.
  const airport = text.match(/\b([A-Z]{3})\s*[–—-]\s*/);
  if (airport && AIRPORT_TZ[airport[1]]) {
    return { zone: AIRPORT_TZ[airport[1]], confident: true, reason: `Airport ${airport[1]}` };
  }

  // ", TX" or ", TX 77032" at the end of a street address.
  const state = text.match(/,\s*([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (state && STATE_TZ[state[1]]) {
    const st = state[1];
    const split = SPLIT_STATES.has(st);
    return {
      zone: STATE_TZ[st],
      confident: !split,
      reason: split ? `${st} spans two zones — confirm this one` : `State ${st}`,
    };
  }

  const lower = text.toLowerCase();
  for (const [city, zone] of Object.entries(CITY_TZ)) {
    if (lower.includes(city)) {
      return { zone, confident: false, reason: `Matched “${city}” — confirm` };
    }
  }

  return FALLBACK;
}

/** True when this state's zone can't be settled from the address alone. */
export function isSplitState(state: string): boolean {
  return SPLIT_STATES.has(state.toUpperCase());
}

/**
 * The lookup key for a saved address→zone correction.
 *
 * Lowercased and whitespace-collapsed so "112 W Boden St,  Milwaukee, WI" and
 * "112 w boden st, milwaukee, wi" are the same key — the same address arrives
 * spelled differently depending on who pasted it.
 */
export function addressKey(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim();
}

/** An instant rendered in a specific zone: "7:30 PM". */
export function wallTime(iso: string | Date | null | undefined, zone: string): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    // An invalid zone id must not take down a row that otherwise renders.
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }
}

/** An instant rendered as a short date in a zone: "Tue Sep 9". */
export function wallDate(iso: string | Date | null | undefined, zone: string): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
  }
}

/**
 * Turn a wall-clock date and time in a given zone into an absolute instant.
 *
 * The naive approach — `new Date("2026-09-09T19:30:00")` — parses in the
 * SERVER's zone, so a 7:30 PM Honolulu pickup imported from a machine in
 * Denver lands four hours early and every countdown built on it is wrong.
 * This asks Intl what the zone's offset actually is at that date, which also
 * gets DST boundaries right, then applies it.
 */
export function instantFromWallTime(
  dateStr: string,
  timeStr: string,
  zone: string
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match || !time) return null;

  const [, y, mo, d] = match;
  const hh = Number(time[1]);
  const mm = Number(time[2]);
  if (hh > 23 || mm > 59) return null;

  // Start from the wall time read as UTC, then correct by the zone's offset at
  // that moment. One correction pass is enough except within the hour a DST
  // change lands in, so the result is re-checked and corrected once more.
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), hh, mm);
  let guess = asUtc - offsetAt(asUtc, zone);
  guess = asUtc - offsetAt(guess, zone);

  const out = new Date(guess);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** A zone's UTC offset in milliseconds at a given instant, DST included. */
function offsetAt(utcMs: number, zone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    // Intl renders hour 24 for midnight under hour12:false in some engines.
    const hour = get("hour") % 24;

    const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
    return asIfUtc - utcMs;
  } catch {
    return 0;
  }
}

/**
 * Today's date in a given zone, as YYYY-MM-DD.
 *
 * Karl's parser reached for Luxon here. The pasted list only ever carries a
 * time ("Starting at 9:00 AM") and never a date, so the date has to come from
 * somewhere — and it has to be today *where the car is*, not where the person
 * pasting is sitting. A VA in Manila importing a Honolulu list at 3pm their
 * time is on the previous day in Hawaii, and dating those trips from their own
 * clock puts every one of them 24 hours out.
 */
export function todayInZone(zone: string, now: Date = new Date()): string {
  try {
    // en-CA renders as YYYY-MM-DD, which is the format we want anyway.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
