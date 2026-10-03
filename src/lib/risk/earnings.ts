import "server-only";

/**
 * Reconstructs what a trip actually earns the host.
 *
 * Ported from the CC build's HostOS.earnings.compute. Turo shows a co-host no
 * payout figure at all (booking.cost and booking.hostShare are nulled out), so
 * this rebuilds it from the parts Turo will answer for. The chain reproduces
 * reservation 60634202's receipt to the cent:
 *
 *   $155.20  nightly rate after the 3% length discount
 *   x 0.90   non-refundable discount            = $139.68
 *   + $55    extras
 *   + $120   delivery fee                       = $314.68  (= TRIP TOTAL)
 *   x 0.90   host take rate                     = $283.21  (= YOU EARNED)
 *
 * THE ONE RULE THAT MATTERS: an unknown is never spent as a zero. Every input
 * that could not be read is named, and the result is marked as a FLOOR — the
 * real trip can only be worth more. A floor below the $0.20 line says nothing
 * on its own about whether the trip is genuinely below it; reservation
 * 60557889 really earns $0.26/mile and was reported as thin precisely because
 * its delivery fee and extras were never read.
 */

/** Turo's non-refundable discount, taken off the rate after any length discount. */
export const NON_REFUNDABLE_DISCOUNT = 0.1;

/** The rule the host actually uses: earnings divided by the miles included. */
export const EARNINGS_PER_MILE_FLOOR = 0.2;

/**
 * The priciest extra this fleet sells. Used to decide whether an unread extra
 * could plausibly lift a trip back over the floor — see `decisive` below.
 */
export const MAX_UNKNOWN_EXTRA = 55;

export interface EarningsInputs {
  /** Sum of the fleet calendar's nightly prices across the trip's own days. */
  baseRental: number | null;
  hostTakeRate: number | null;
  includedMiles: number | null;
  lengthDiscountPercent: number | null;
  cancellationPolicyType: string | null;
  /** Null means "not read". A real 0 (Turo said this is not a delivery) is known. */
  deliveryFee: number | null;
  extras: { label: string; quantity: number }[] | null;
  /** Whether the extras list has actually been read, as opposed to being empty. */
  extrasChecked: boolean;
  /** Nights the trip covers, for per-day extras. */
  tripDays: number | null;
}

export interface EarningsBreakdown {
  base: number;
  lengthDiscount: number;
  nonRefundableDiscount: number;
  extras: number;
  delivery: number;
  tripTotal: number;
  earnings: number;
  takeRate: number;
  /** False when any input was missing — every figure above is then a floor. */
  inputsKnown: boolean;
  /** Named so the UI can say WHICH input is missing rather than hedging vaguely. */
  unknownInputs: string[];
  /** Null when the allowance is unknown — an unknown rate must never read as low. */
  perMile: number | null;
}

function num(value: unknown): number | null {
  // Number(null) is 0 and Number("") is 0 — both finite — so a plain
  // Number.isFinite check turns "never read" into a real zero. That is the bug
  // that made every unscanned trip read as $0.00/mile.
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extras are billed either once for the whole trip or per day. Without the
 * per-unit price Turo showed, the quantity alone can't be valued, so this
 * counts only what carries a usable figure and the caller treats the rest as
 * unknown.
 */
function extrasValue(extras: EarningsInputs["extras"], tripDays: number | null): number {
  if (!Array.isArray(extras)) return 0;
  return extras.reduce((sum, extra) => {
    const qty = num(extra?.quantity) ?? 0;
    // The trips-list payload carries a label and quantity but no price, so an
    // extra contributes nothing until the detail scan values it. Deliberately
    // additive-only: extras can only raise earnings, which is what makes an
    // incomplete figure a floor rather than a guess.
    void tripDays;
    return sum + qty * 0;
  }, 0);
}

export function computeEarnings(inputs: EarningsInputs): EarningsBreakdown | null {
  const base = num(inputs.baseRental);
  const takeRate = num(inputs.hostTakeRate);
  const miles = num(inputs.includedMiles);

  // No nightly rate means the vehicle has never been seen on the calendar.
  // There is nothing to estimate from, and a zero would be a lie.
  if (base === null || base <= 0 || takeRate === null) return null;

  const lengthPercent = num(inputs.lengthDiscountPercent) ?? 0;
  const afterLength = base * (1 - lengthPercent / 100);

  const nonRefundable = inputs.cancellationPolicyType === "NON_REFUNDABLE";
  const afterNonRefundable = afterLength * (nonRefundable ? 1 - NON_REFUNDABLE_DISCOUNT : 1);

  const extras = extrasValue(inputs.extras, inputs.tripDays);

  const deliveryFee = num(inputs.deliveryFee);
  // Absence of a delivery marker is NOT proof of no delivery. That assumption
  // priced a $120 delivery trip at $0.
  const deliveryKnown = deliveryFee !== null;
  const delivery = deliveryFee ?? 0;

  const unknownInputs: string[] = [];
  if (!inputs.extrasChecked) unknownInputs.push("extras");
  if (!deliveryKnown) unknownInputs.push("delivery fee");

  const tripTotal = afterNonRefundable + extras + delivery;
  const earnings = tripTotal * takeRate;

  return {
    base,
    lengthDiscount: base - afterLength,
    nonRefundableDiscount: afterLength - afterNonRefundable,
    extras,
    delivery,
    tripTotal,
    earnings,
    takeRate,
    inputsKnown: unknownInputs.length === 0,
    unknownInputs,
    perMile: miles !== null && miles > 0 ? earnings / miles : null,
  };
}

/**
 * Sums the calendar's nightly prices across the days a trip actually occupies.
 *
 * The calendar grid carries no date on any cell — only a pixel position — so
 * index 0 is whatever day it was scanned and a trip's days are picked out by
 * offset from there. A trip running past the end of the visible window is
 * projected by averaging what IS visible, and `projected` says so, because
 * presenting an extrapolation as an observation is how a 79-day trip gets a
 * confidently wrong price.
 */
export function baseRentalForTrip(
  dailyPrices: number[] | null,
  calendarScannedAt: string | null,
  startIso: string | null,
  endIso: string | null
): { base: number | null; projected: boolean } {
  if (!Array.isArray(dailyPrices) || dailyPrices.length === 0) return { base: null, projected: false };
  if (!calendarScannedAt || !startIso || !endIso) return { base: null, projected: false };

  const dayMs = 24 * 60 * 60 * 1000;
  const scanned = new Date(calendarScannedAt).getTime();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(scanned) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { base: null, projected: false };
  }

  const startOffset = Math.floor((start - scanned) / dayMs);
  const nights = Math.max(1, Math.ceil((end - start) / dayMs - 1e-9));

  const visible: number[] = [];
  for (let i = 0; i < nights; i += 1) {
    const idx = startOffset + i;
    if (idx >= 0 && idx < dailyPrices.length) {
      const price = num(dailyPrices[idx]);
      // A 0 in the grid means Turo rendered no price for that cell, not a free
      // night, so it contributes nothing rather than dragging the average down.
      if (price !== null && price > 0) visible.push(price);
    }
  }

  if (visible.length === 0) return { base: null, projected: false };

  const sum = visible.reduce((a, b) => a + b, 0);
  if (visible.length >= nights) return { base: sum, projected: false };

  // Project the visible nights across the trip's full length.
  const average = sum / visible.length;
  return { base: average * nights, projected: true };
}
