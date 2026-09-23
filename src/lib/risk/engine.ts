import "server-only";
import {
  EARNINGS_PER_MILE_FLOOR,
  MAX_UNKNOWN_EXTRA,
  type EarningsBreakdown,
} from "@/lib/risk/earnings";

/**
 * The two rules this fleet actually operates on, ported from the CC build's
 * HostOS.riskEngine. Both came from the host directly:
 *
 *  1. Verify a guest's license before pickup — but guests cannot upload until
 *     within 24h of pickup, so flagging earlier is a false alarm.
 *  2. Flag trips that earn below $0.20 per included mile, and trips where the
 *     guest bought the zero-deductible ("Premier") plan — both are "consider
 *     cancelling before pickup" cases.
 */

export type RiskSeverity = "critical" | "high";

export interface RiskTripInput {
  id: string;
  guestName: string | null;
  vehicle: string;
  plate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  action: string | null;
  licenseConfirmed: boolean | null;
  protectionLevel: string | null;
  protectionPlanName: string | null;
  guestMaxOutOfPocket: number | null;
  guestRating: number | null;
  guestRatingCount: number | null;
  guestTripCount: number | null;
  includedMiles: number | null;
  /** The OVERAGE rate. Display only — see below. */
  pricePerMile: number | null;
  hostTakeRate: number | null;
  earnings: EarningsBreakdown | null;
}

export interface RiskAssessment {
  /** Below the floor AND no unread input could plausibly lift it back over. */
  earningsBelowFloor: boolean;
  /** Below the floor, but an unread extra might still clear it. Not asserted. */
  earningsUndecided: boolean;
  /** $0 out-of-pocket: damage cannot be billed to the guest. */
  premierProtection: boolean;
  /** Either signal. Cannot answer "is this a profit risk" on its own. */
  earningsRisk: boolean;
  riskReasons: string[];
  licenseRequiresAttention: boolean;
  licenseSeverity: RiskSeverity;
}

const LICENSE_UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Guests cannot upload a license until within 24h of pickup, so an unverified
 * license is only actionable inside that window. Flagging earlier trains people
 * to ignore the queue.
 */
export function isWithinLicenseUploadWindow(startsAt: string | null, now = Date.now()): boolean {
  if (!startsAt) return false;
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return false;
  const untilStart = start - now;
  // Strictly upcoming: a pickup that already passed is not actionable.
  return untilStart >= 0 && untilStart <= LICENSE_UPLOAD_WINDOW_MS;
}

/** True when the guest's plan leaves the host unable to bill them for damage. */
export function isPremier(trip: Pick<RiskTripInput, "protectionLevel" | "guestMaxOutOfPocket">): boolean {
  // Keyed on the $0 cap as well as the enum, so this survives Turo renaming it.
  // Observed live: PREMIUM is the mid-tier "Standard" plan at a $500 cap, NOT
  // Premier — testing the string alone would flag the wrong trips.
  return trip.protectionLevel === "SUPREME" || trip.guestMaxOutOfPocket === 0;
}

export function assessTrip(trip: RiskTripInput, now = Date.now()): RiskAssessment {
  const earningsPerMile = trip.earnings?.perMile ?? null;
  const inputsKnown = trip.earnings?.inputsKnown === true;
  const below = earningsPerMile !== null && earningsPerMile < EARNINGS_PER_MILE_FLOOR;

  // Requiring every input to be READ before flagging anything was too strict:
  // extras are only read inside the 72-hour detail window, so nothing outside
  // it could ever be flagged and the queue sat empty for days. Silence is its
  // own failure — the point is catching a bad trip early enough to cancel it.
  //
  // The right test is not "is everything known" but "could what we don't know
  // change the answer". Extras only ADD, so the computed figure is a floor, and
  // a floor below the line is decisive whenever no plausible extra could lift
  // it over. Work the shortfall out in dollars and compare it against the
  // priciest extra this fleet sells.
  let decisive = inputsKnown;
  if (!decisive && below && trip.includedMiles && trip.includedMiles > 0 && trip.hostTakeRate !== null) {
    const shortfall = (EARNINGS_PER_MILE_FLOOR - (earningsPerMile as number)) * trip.includedMiles;
    decisive = shortfall > MAX_UNKNOWN_EXTRA * trip.hostTakeRate;
  }

  const earningsBelowFloor = below && decisive;
  // Below the line but an unread extra could still clear it. Not asserted as a
  // risk, and not dropped either — surfaced separately so an empty queue is
  // never mistaken for a clean one.
  const earningsUndecided = below && !decisive;

  const premierProtection = isPremier(trip);
  const earningsRisk = earningsBelowFloor || premierProtection;

  const riskReasons: string[] = [];

  if (earningsBelowFloor) {
    const unknown = trip.earnings?.unknownInputs ?? [];
    riskReasons.push(
      `Earns only $${(earningsPerMile as number).toFixed(2)}/mile of the allowance (below $${EARNINGS_PER_MILE_FLOOR.toFixed(2)})` +
        (inputsKnown
          ? ""
          : ` — ${unknown.join(" and ") || "an input"} not read from Turo, but the shortfall is too large for any extra this fleet sells to close`)
    );
  }

  if (premierProtection) {
    riskReasons.push(
      `Guest bought the ${trip.protectionPlanName || "Premier"} plan — $0 out-of-pocket, so damage cannot be billed to them`
    );
  }

  // A guest's track record sharpens the Premier case: a first-timer or a badly
  // rated guest on a $0-liability plan is the combination worth acting on.
  if (premierProtection && trip.guestRating !== null && trip.guestRating <= 3) {
    riskReasons.push(
      `Guest is rated ${trip.guestRating.toFixed(1)}★ across ${trip.guestRatingCount ?? 0} ${
        trip.guestRatingCount === 1 ? "trip" : "trips"
      }`
    );
  } else if (premierProtection && trip.guestRating === null && (trip.guestTripCount ?? 0) === 0) {
    // Deliberately distinct from a low score: unrated is unknown, not bad.
    riskReasons.push("Guest has no completed trips or ratings yet");
  }

  const dueSoon = isWithinLicenseUploadWindow(trip.startsAt, now);

  return {
    earningsBelowFloor,
    earningsUndecided,
    premierProtection,
    earningsRisk,
    riskReasons,
    // null means "not checked yet", never "not confirmed" — only an explicit
    // false is an unverified license.
    licenseRequiresAttention: trip.licenseConfirmed === false && dueSoon,
    licenseSeverity: dueSoon ? "critical" : "high",
  };
}
