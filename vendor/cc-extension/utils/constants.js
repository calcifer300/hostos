window.HostOS = window.HostOS || {};

HostOS.constants = {
  STORAGE_KEY: "hostosTrips",
  LAST_SCAN_KEY: "hostosLastScan",
  LAST_SCAN_COUNT_KEY: "hostosLastScanCount",
  SCAN_DEBOUNCE_MS: 700,
  FALLBACK_SCAN_MS: 5 * 60 * 1000,
  // Bump this whenever a fix changes what a detail scan reads or how it's
  // interpreted (e.g. the date-section parsing fix). A trip's cached scan
  // is only treated as "recently checked" (skip re-scanning) if it was
  // captured under the CURRENT version — otherwise a fix would leave stale,
  // possibly-wrong data sitting untouched for up to DETAIL_RESCAN_MS,
  // correcting only when someone happens to visit that trip directly.
  // v5 renamed the misread damage-responsibility field (see PROJECT_STATUS).
  // v6 reads the page heading, so a cancelled reservation is recognised.
  DETAIL_SCAN_VERSION: 6,
  // A cancelled reservation stays in storage, flagged, for this long. Kept
  // rather than deleted so nothing can rediscover it and alert again; dropped
  // eventually so storage does not carry every cancellation forever.
  CANCELLED_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,
  // How long after the BOOKING a no-dates record still counts as brand new
  // for the immediate Premier alert. The activity feed stamps the booking's
  // own time; a "Booked trip" event processed days late (reservation 61109808,
  // booked, then cancelled, then found) is not a new booking and must wait for
  // a detail scan like anything else. A day is generous enough that a laptop
  // closed overnight still alerts on a late-evening booking the next morning.
  BRAND_NEW_BOOKING_MS: 24 * 60 * 60 * 1000,
  // The same idea for the EARNINGS math, which is computed once by the
  // pricing sweep and stored on the trip - the panel, the notifications, the
  // Premier alert and the 9 PM report all read that stored number and none of
  // them recompute it. So a fix to the earnings chain does not reach Matt
  // until each trip happens to fall out of its 6-hour recheck window, which
  // can easily be after tonight's report has already gone out. Bump this and
  // every trip is re-priced on the next sweep instead.
  // v1: billed days round UP (Turo charges a part day as a full day), which
  // was understating short trips by a whole night.
  // v2: a below-$0.20 flag now requires every earnings input to have been
  // read from Turo. Matt reported reservation 60557889 - a real $0.26/mile
  // trip - as flagged, the third wrong number in a week.
  // v3: a below-$0.20 floor is now flagged when no extra this fleet sells
  // could close the shortfall, instead of requiring every input to be read -
  // which had left the Profit Risk queue empty for two days.
  // v4: earningsBelowFloor is stored separately from earningsRisk, so the
  // detail-scan exemption can follow the profit signal alone.
  // v5: no change to the math. Bumped so every stored trip is re-swept once
  // and the reservation API's cancellation marker is read on each - cancelled
  // reservations had been sitting in storage indistinguishable from live ones.
  // v6: the take rate is the RESERVATION's plan, not the vehicle's current
  // one, and delivery fees pay at their own rate. 90-plan bookings had been
  // priced at the fleet's new 70 plan and reported as below $0.20 (Isaiah,
  // Lisa, 2026-09-11 report).
  EARNINGS_VERSION: 6,
  // Turo's lowest host plan. Used only as a FLOOR when a reservation's plan
  // could not be read - the figure is then named as unread and never asserted.
  MIN_HOST_TAKE_RATE: 0.6,
  // The rule Matt set. Lived as a bare 0.20 in riskEngine and would have had
  // to be repeated in the service worker for the digest, which is exactly how
  // this project has drifted before.
  EARNINGS_PER_MILE_FLOOR: 0.20,
  // Matt, 2026-09-01: "I charge a $120 delivery fee on every trip. Since you
  // get 90 percent of this and helps me keep a minimum on every trip to cover
  // parking and cleaning fees." He sets his own prices, so where Turo does not
  // expose a fee his figure is the authority - this is a stated business fact,
  // not an invented default. Turo's own per-location fee still wins wherever it
  // can be read, and anything sourced from here is labelled as his standing
  // rate rather than passed off as something read from Turo. Editable in the
  // options page.
  STANDING_DELIVERY_FEE: 120,
  // The most expensive extra Colorado Cruisers offers - the prepaid EV
  // recharge - from the fleet's own price list (camp chair $15, stroller $40,
  // air mattress $40, EV recharge $55, booster seat $20, child seat $40-45,
  // pet fee $40). Used ONLY as a ceiling: extras can only ADD to earnings, so
  // a trip whose shortfall is bigger than this cannot be rescued by one, and
  // its verdict holds whatever the extras turn out to be. Raise it if a
  // pricier extra is ever added, or if guests routinely buy several.
  MAX_UNKNOWN_EXTRA: 55,
  // Turo's window for a host to rate a guest after the trip ends. Policy, not
  // data: no endpoint read on 2026-09-10 reports a deadline, and the activity
  // feed emits no review reminder. Ten days per Turo's help centre (via the
  // AI overview John forwarded). The card says "Turo's 10-day window" so it
  // never reads as a figure taken from the trip.
  REVIEW_WINDOW_DAYS: 10,
  // Bump when the post-trip sweep reads something new, so every completed
  // trip is re-read once instead of waiting out its recheck.
  // v2: review-text flags only from reviews rated 4 stars or below, with a
  // negation guard - a 5-star review flagged DIRTY on "messed up his plans".
  POST_TRIP_VERSION: 2,
  LICENSE_REMINDER_MESSAGE: "Hi! Just a friendly reminder to complete your verification in the Trip Details section of the Turo app before pickup. Please upload your driver's license and a selfie of yourself holding your driver's license. Once your verification is complete, we'll be able to release the vehicle. Thank you!"
};
