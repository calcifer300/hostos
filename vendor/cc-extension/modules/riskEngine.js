window.HostOS = window.HostOS || {};

// Turo's non-refundable discount, taken off the rate after any length
// discount. Derived from reservation 60634202's receipt: $15.52 off $155.20 is
// exactly 10%. Only ever seen on that one receipt, so if an estimate is ever
// off on a non-refundable trip, check this first — the card shows the
// breakdown line by line precisely so it can be compared against a receipt.
HostOS.NON_REFUNDABLE_DISCOUNT = 0.10;

// The rule Matt actually uses: what he EARNS divided by the miles included.
//
// This replaces flagging on pricePerMile, which is Turo's *overage* rate — the
// penalty for driving past the allowance. The two are unrelated, and treating
// one as the other flagged reservation 60634202 (a healthy $0.35/mile trip) as
// a risk because its overage rate happened to be $0.19.
//
// Turo shows a co-host no payout figure at all, so this reconstructs it. Every
// input except the nightly rate comes back exact from Turo's own endpoints,
// and the chain reproduces that reservation's receipt to the cent:
//
//   $155.20  nightly rate after the 3% length discount
//   × 0.90   non-refundable discount          = $139.68
//   + $55    extras                           = $194.68
//   × 0.90   the trip's own plan (90 plan)    = $175.21
//   + $120   delivery fee × 0.90              = $108.00
//                                             = $283.21  (= YOU EARNED)
//
// Two rates, not one. The plan rate is the reservation's own
// (vehicleProtectionLevelDetail.key): the fleet moved from the 90 plan to the
// 70 plan and every earlier booking kept its 90, so the vehicle's current
// plan priced Isaiah and Lisa a fifth low and put them in the report as
// below $0.20 when they earn $0.22 and $0.25. Delivery fees pay the host at
// their own rate (hostDeliveryTakeRate, 0.9 on the 70 plan) whatever the
// plan. On that receipt both were 0.9, which is why one rate ever matched.
//
// baseRental is the one approximation: the fleet calendar's nightly prices for
// the trip's own days. It tracks the booked rate far better than a fresh quote
// would, since a current quote reflects today's asking price rather than what
// was locked in at booking.
HostOS.earnings = {
  compute(trip, baseRental) {
    const base = HostOS.parser.number(baseRental);
    const miles = HostOS.parser.number(trip.includedMiles);
    if (base === null || base <= 0) return null;
    // The trip's own plan. Unknown is priced at Turo's lowest plan and named
    // as an unread input, so the figure is a floor the risk rule will not
    // assert - never spent as the vehicle's current rate, which is what
    // understated every 90-plan booking.
    const planRate = HostOS.parser.number(trip.hostTakeRate);
    const planKnown = planRate !== null;
    const takeRate = planKnown ? planRate : HostOS.constants.MIN_HOST_TAKE_RATE;
    const deliveryRead = HostOS.parser.number(trip.deliveryTakeRate);
    const deliveryTakeRate = deliveryRead !== null ? deliveryRead : takeRate;

    const lengthPercent = HostOS.parser.number(trip.lengthDiscountPercent) || 0;
    const afterLength = base * (1 - lengthPercent / 100);
    const nonRefundable = trip.cancellationPolicyType === "NON_REFUNDABLE";
    const afterNonRefundable = afterLength * (nonRefundable ? 1 - HostOS.NON_REFUNDABLE_DISCOUNT : 1);

    const extras = HostOS.queueView ? HostOS.queueView.extrasValue(trip, HostOS.dates.tripDayCount(trip)) : 0;
    const extrasKnown = HostOS.queueView ? HostOS.queueView.extrasChecked(trip) : false;

    // Delivery is only genuinely $0 when the trip isn't a delivery. If it IS
    // one and the fee never came back from Turo, that is unknown - and an
    // unknown spent as a zero understates the trip by the whole fee, which is
    // how a healthy trip ends up under the $0.20 line.
    const deliveryFee = HostOS.parser.number(trip.deliveryFee);
    // null means "not read". A real $0 (Turo said this trip is not a delivery)
    // is a number and counts as known. Absence of a delivery marker is NOT
    // proof of no delivery - that assumption priced a $120 delivery trip at
    // $0 and is what Matt caught.
    const deliveryKnown = deliveryFee !== null;
    const delivery = deliveryFee === null ? 0 : deliveryFee;

    // Named, not just counted, so the card and the email can say WHICH input
    // is missing instead of hedging vaguely.
    const unknownInputs = [];
    if (!planKnown) unknownInputs.push("earnings plan");
    if (!extrasKnown) unknownInputs.push("extras");
    if (!deliveryKnown) unknownInputs.push("delivery fee");

    const tripTotal = afterNonRefundable + extras + delivery;
    const earnings = (afterNonRefundable + extras) * takeRate + delivery * deliveryTakeRate;

    return {
      base,
      lengthDiscount: base - afterLength,
      nonRefundableDiscount: afterLength - afterNonRefundable,
      extras,
      delivery,
      tripTotal,
      earnings,
      takeRate,
      deliveryTakeRate,
      planKnown,
      // With anything unknown, every figure above is a FLOOR: the real trip
      // can only be worth more, never less.
      // Where the delivery figure came from, so a card can never pass Matt's
      // standing rate off as something read from Turo.
      deliverySource: trip.deliveryFeeSource || null,
      inputsKnown: unknownInputs.length === 0,
      unknownInputs,
      // null rather than 0 when the mileage allowance is unknown — an unknown
      // rate must never read as "below $0.20" and flag a healthy trip.
      perMile: miles !== null && miles > 0 ? earnings / miles : null
    };
  }
};

HostOS.riskEngine = {
  // Earnings Risk fires on either of two independent signals: the per-mile
  // overage rate is below $0.20 (bad trip economics), or the guest bought
  // the zero-deductible ("Premier") protection plan (the host has no
  // recourse to recoup damage — the specific scenario a host wants to
  // catch so they can consider canceling before pickup).
  enrich(trip) {
    // A trip that hasn't been detail-scanned yet has pricePerMile null, and
    // Number(null) is 0 — finite, and below the $0.20 threshold. That made
    // every unscanned trip look like a profit risk reading "$0.00/mile".
    // A rate of exactly 0 is treated as "not known" for the same reason:
    // Turo always publishes a real overage rate, so 0 means the scan hasn't
    // captured it rather than that the trip genuinely earns nothing per mile.
    // The $0.20 test runs on EARNINGS per included mile, not on the overage
    // rate. earningsPerMile is written by the pricing sweep; when it hasn't
    // been computed yet the trip is simply not flagged, because a missing
    // number must never read as a low one. The old behaviour — flagging on
    // pricePerMile — reported healthy trips as risks and was what Matt caught.
    const earningsPerMile = HostOS.parser.number(trip.earningsPerMile);
    // Every input must have been READ, not assumed. An earnings figure built
    // on an unread input is a floor, and a floor below $0.20 says nothing
    // about whether the trip is actually below $0.20 - reservation 60557889
    // really earns $0.26/mile and was reported as thin because its delivery
    // fee and extras were never read. A trip we could not price is surfaced
    // separately in the report instead of being asserted as a risk.
    const floor = HostOS.constants.EARNINGS_PER_MILE_FLOOR;
    const inputsKnown = trip.earningsInputsKnown === true;
    const below = earningsPerMile !== null && earningsPerMile < floor;

    // Requiring every input to be READ before flagging anything was too strict:
    // extras are only read inside the 72-hour detail window, so nothing outside
    // it could ever be flagged and the queue sat empty for two days. Silence is
    // its own failure - the whole point is catching a bad trip early enough to
    // cancel it.
    //
    // The right test is not "is everything known" but "could what we do not
    // know change the answer". Extras only ADD to earnings, so the computed
    // figure is a FLOOR, and a floor below the line is decisive whenever no
    // plausible extra could lift the trip over it. Work out the shortfall in
    // dollars and compare it against the priciest extra this fleet sells.
    const miles = HostOS.parser.number(trip.includedMiles);
    const takeRate = HostOS.parser.number(trip.hostTakeRate);
    let decisive = inputsKnown;
    // The shortfall test below assumes the only unknowns are extras, which
    // can add at most one item's worth. An unknown PLAN can add half again
    // (60 plan to 90 plan), so a floor built on it is never decisive.
    const planUnknown = (trip.earningsUnknownInputs || []).includes("earnings plan");
    if (!decisive && !planUnknown && below && miles !== null && miles > 0 && takeRate !== null) {
      const shortfall = (floor - earningsPerMile) * miles;
      decisive = shortfall > HostOS.constants.MAX_UNKNOWN_EXTRA * takeRate;
    }
    const belowRateThreshold = below && decisive;
    // Below the line, but an unread extra could still clear it. Not asserted as
    // a risk, and not dropped either - surfaced separately so an empty queue is
    // never mistaken for a clean one.
    const earningsUndecided = below && !decisive;
    const pricePerMile = HostOS.parser.number(trip.pricePerMile);

    // The guest's protection plan, from the structured protectionLevel field
    // (see content/protectionScanner.js). "SUPREME" is Turo's internal key
    // for Premier, whose out-of-pocket maximum is $0 — the host cannot bill
    // the guest for damage and recovers nothing.
    //
    // This replaces the old `zeroDeductibleProtection` check, which read the
    // reservation page's "Damage responsibility" figure. That figure is the
    // HOST's deductible, not the guest's plan: reservation 57760996 shows
    // $2,750 there while the guest held a $0 Premier plan. The old check
    // could never fire for any trip.
    const premierProtection = trip.protectionLevel === "SUPREME"
      || (typeof trip.guestMaxOutOfPocket === "number" && trip.guestMaxOutOfPocket === 0);
    const earningsRisk = belowRateThreshold || premierProtection;

    const riskReasons = [];
    // pricePerMile is the OVERAGE rate — what the guest pays for each mile
    // beyond the trip's included allowance, not a rate that earns the host
    // anything on ordinary miles. A low figure is the risk: once past the
    // allowance the guest can pile on mileage, and the wear it causes isn't
    // covered by what they're charged for it.
    if (belowRateThreshold) {
      // This exact string is what the 9 PM email prints, so it has to carry
      // its own caveat - Matt reads the email, not the card. A figure built
      // on an input we never read is a floor, and saying so is the difference
      // between a number he can act on and one that burns his trust.
      const unknown = Array.isArray(trip.earningsUnknownInputs) ? trip.earningsUnknownInputs : [];
      riskReasons.push("Earns only $" + earningsPerMile.toFixed(2) + "/mile of the allowance (below $0.20)"
        + (inputsKnown ? "" : " - " + (unknown.join(" and ") || "an input") + " not read from Turo, but the"
          + " shortfall is too large for any extra this fleet sells to close"));
    }
    if (premierProtection) {
      riskReasons.push("Guest bought the " + (trip.protectionPlanName || "Premier")
        + " plan — $0 out-of-pocket, so damage cannot be billed to them");
    }

    const license = HostOS.licenseMonitor.evaluate(trip);
    return {
      ...trip,
      earningsRisk,
      // earningsRisk is the OR of two unrelated signals - below $0.20 and the
      // guest's Premier plan - so it cannot answer "is this a profit risk".
      // The detail-scan exemption needs the profit half on its own: a Premier
      // trip is a protection risk, already emailed the moment it is booked
      // from the JSON sweep, and opening its page tells us nothing more.
      earningsBelowFloor: belowRateThreshold,
      earningsUndecided,
      premierProtection,
      riskReasons,
      licenseRequiresAttention: license.requiresAttention,
      licenseSeverity: license.severity
    };
  }
};
