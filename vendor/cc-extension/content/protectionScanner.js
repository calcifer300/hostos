window.HostOS = window.HostOS || {};

// Reads the GUEST's protection plan, which is the single thing Matt asked to
// be alerted about: a guest on the Premier plan has a $0 out-of-pocket
// maximum, so the host cannot bill them for damage and recovers nothing.
//
// This deliberately does NOT come from the reservation page's "Earnings plan"
// section. That section's "Damage responsibility: $2,750.00" is the HOST's
// own deductible under Matt's chosen earnings plan — verified against
// reservation 57760996, the Premier booking Matt lost money on, which shows
// $2,750 there despite the guest holding a $0 plan. The words "Premier",
// "protection plan" and "out-of-pocket" appear nowhere on that page. The
// previous zero-deductible check read that field and therefore could never
// fire, for any trip, ever.
//
// The real value comes from the same JSON endpoint that powers the car
// sharing agreement, as a structured enum rather than scraped text:
//   protectionLevel: "SUPREME"  -> Premier, maxOutOfPocket.amount === 0
//   protectionLevel: "DECLINED" -> guest declined cover, maxOutOfPocket null
//
// It's a plain same-origin fetch (~17KB, well under a second), so unlike the
// detail scan it needs no background tab and no wait for Turo to render. That
// is why protection can be checked for EVERY known trip instead of only those
// inside the 72-hour detail window — Matt needs to hear about a Premier
// booking when it's made, not three days before pickup when canceling is
// expensive.
HostOS.protectionScanner = (() => {
  const ENDPOINT = "/api/reservation/detail?oppTermsAware=true&reservationId=";
  // Turo's own page issues this request, but a queue of them in a tight loop
  // would not look like ordinary browsing. Small batches, spaced out.
  // Sized for the initial backfill: with ~120 known reservations, batches of
  // 5 every few minutes would take over an hour to cover the fleet once,
  // which is why cards sat on "not checked yet". At 15 per sweep this is a
  // little over ten minutes, while still spacing the requests out.
  const BATCH_SIZE = 15;
  const GAP_MS = 350;
  const RECHECK_MS = 6 * 60 * 60 * 1000;
  // This is an internal, undocumented endpoint. If Turo changes or removes
  // it, every lookup fails the same way — so consecutive failures are counted
  // and surfaced rather than silently leaving protection permanently unknown.
  let consecutiveFailures = 0;
  let running = false;

  // --- Guest extras, from the payload this sweep already fetches ----------
  //
  // Extras are real money - $55 on reservation 60634202 - and until now they
  // could only be read from the reservation PAGE, which needs a background
  // tab and so only ever happens inside the 72-hour detail window. Every trip
  // further out had its extras counted as ZERO, understating earnings and
  // pushing trips toward the $0.20 flag. That is the same false-positive
  // direction Matt has already reported twice.
  //
  // This payload is fetched for every trip anyway, so the extras are almost
  // certainly in it - but the field has never been mapped, and naming the
  // wrong one would put invented money in front of Matt. So nothing here
  // guesses a field name. It collects every array in the payload that LOOKS
  // like purchased extras, and the sweep refuses to use any of them until one
  // has reproduced a page-scraped total EXACTLY on a trip where both sources
  // are available. Until a path proves itself, extras stay unknown - never
  // zero, which is the whole bug.
  const NAME_KEYS = ["name", "label", "title", "displayName", "description", "extraType", "type"];
  const PRICE_KEYS = ["price", "amount", "cost", "total", "unitPrice", "chargeAmount", "subtotal"];
  const QUANTITY_KEYS = ["quantity", "count", "qty", "units"];
  const UNIT_KEYS = ["unit", "priceType", "chargeType", "frequency", "billingType", "rateType"];
  // A cap so a deeply nested or unexpectedly huge payload can never turn this
  // into a page freeze. The reservation payload is about 17KB.
  const MAX_WALK_NODES = 5000;

  function firstString(entry, keys) {
    for (const key of keys) {
      const value = entry[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }

  function firstNumber(entry, keys) {
    for (const key of keys) {
      const raw = entry[key];
      // Turo wraps money as { amount, currencyCode } in most places.
      const value = raw && typeof raw === "object" ? raw.amount : raw;
      const number = HostOS.parser.number(value);
      if (number !== null) return number;
    }
    return null;
  }

  // Shaped like queueView.extrasValue expects: name, price, quantity, unit.
  function readExtraLike(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const name = firstString(entry, NAME_KEYS);
    const price = firstNumber(entry, PRICE_KEYS);
    if (!name || price === null || price <= 0) return null;
    const quantity = firstNumber(entry, QUANTITY_KEYS);
    const unit = String(firstString(entry, UNIT_KEYS) || "").toLowerCase();
    return {
      name,
      price,
      quantity: quantity === null || quantity <= 0 ? 1 : quantity,
      // Per-day is the expensive mistake: treating a $55/trip extra as per-day
      // overstates a 10-day booking by $495. Anything not explicitly daily is
      // treated as per-trip, which is how all seven of this fleet are priced.
      unit: unit.includes("day") || unit.includes("daily") ? "day" : "trip"
    };
  }

  // Every array in the payload whose entries ALL look like purchased extras,
  // each tagged with the path it was found at so one can be proven and reused.
  function collectExtraCandidates(payload) {
    const found = [];
    let visited = 0;
    (function walk(node, path) {
      if (!node || typeof node !== "object") return;
      if (visited++ > MAX_WALK_NODES) return;
      if (Array.isArray(node)) {
        const parsed = node.map(readExtraLike);
        if (node.length && parsed.every(Boolean)) found.push({ path, extras: parsed });
        node.forEach((child, index) => walk(child, path + "[" + index + "]"));
        return;
      }
      Object.keys(node).forEach((key) => walk(node[key], path ? path + "." + key : key));
    })(payload, "");
    return found;
  }

  // A path is only trusted once it has reproduced a page-scraped extras total
  // to the cent. Trips with no extras cannot prove anything - a candidate that
  // finds nothing also totals zero - so only a nonzero known value counts.
  async function proveExtrasPath(trips, candidates) {
    const { hostosExtrasPath: stored } = await chrome.storage.local.get("hostosExtrasPath");
    if (stored && stored.path) return stored;
    for (const trip of trips) {
      const options = candidates.get(trip.reservationId);
      if (!options || !options.length) continue;
      if (!Array.isArray(trip.extras) || !trip.extras.length) continue;
      const days = HostOS.dates.tripDayCount(trip);
      const known = HostOS.queueView.extrasValue(trip, days);
      if (!(known > 0)) continue;
      // Total AND count must both agree. A total on its own could be matched by
      // coincidence somewhere else in a 17KB payload, and this path is stored
      // permanently and then trusted for every trip - a wrong one would put
      // invented money in front of Matt indefinitely. Count is deliberately
      // used instead of comparing names: Turo may well spell an extra
      // differently in JSON than on the page, and a name check that is too
      // strict would silently prevent the path from ever proving at all.
      //
      // Note this also protects against MISREADING a correct block: if the
      // quantity or the per-trip/per-day unit were interpreted wrongly, the
      // total would not match, so the path simply never proves and extras stay
      // honestly unknown rather than quietly wrong.
      const match = options.find((option) =>
        option.extras.length === trip.extras.length
        && Math.abs(HostOS.queueView.extrasValue({ extras: option.extras }, days) - known) < 0.005);
      if (!match) continue;
      const proven = { path: match.path, provenOn: trip.reservationId, value: known, provenAt: new Date().toISOString() };
      await chrome.storage.local.set({ hostosExtrasPath: proven });
      HostOS.logger.info("Extras path proven against the page scrape.", proven);
      return proven;
    }
    return null;
  }

  function isPremier(trip) {
    return trip.protectionLevel === "SUPREME"
      || (typeof trip.guestMaxOutOfPocket === "number" && trip.guestMaxOutOfPocket === 0);
  }

  // Returns the guest's plan plus the vehicle identity, kept separate so
  // callers can take only what they should. run() merges protection alone
  // onto trips the list scanner already owns; activityScanner also needs the
  // vehicle fields to stand up a record for a booking whose card has never
  // rendered. Note tripStart/tripEnd exist on this payload but are always
  // null — dates still come from the list/detail scan.
  async function fetchDetail(reservationId) {
    const response = await fetch(ENDPOINT + encodeURIComponent(reservationId), {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const detail = data.protectionLevelDetail || {};
    const amount = detail.maxOutOfPocket && detail.maxOutOfPocket.amount;
    const vehicle = data.vehicle || {};
    const registration = vehicle.registration || {};
    const protection = {
      protectionLevel: data.protectionLevel || null,
      protectionPlanName: detail.selectedShortText || detail.titleText || null,
      guestMaxOutOfPocket: typeof amount === "number" ? amount : null,
      protectionCheckedAt: new Date().toISOString()
    };
    // Set only when the payload says so. Never written as false: a payload
    // that carries no such marker has not said the trip is live, only that it
    // did not say otherwise, and a false here would overwrite what the page
    // heading found.
    const cancelledSignal = HostOS.parser.cancellationSignal(data);
    if (cancelledSignal) {
      protection.cancelled = true;
      protection.cancelledSignal = cancelledSignal;
      protection.cancelledSeenAt = new Date().toISOString();
    }
    return {
      protection,
      vehicle: {
        vehicle: [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || null,
        plate: registration.licensePlate || null
      },
      // Candidate extras blocks, kept OUT of what gets merged onto the trip -
      // this is search scaffolding, not trip data, and must never reach storage.
      extrasCandidates: collectExtraCandidates(data),
      // The guest's profile id, used to look up their rating separately.
      driverId: (data.renter && data.renter.id) || null,
      // Inputs for the earnings reconstruction. locationId is the precise join
      // to the vehicle's delivery-fee table — matching on the location's name
      // would break on any wording change.
      pricing: {
        vehicleId: (data.vehicle && data.vehicle.id) || null,
        // The plan THIS trip was booked under. The vehicle's current plan is
        // not it: the fleet moved from the 90 plan to the 70 plan and every
        // earlier booking kept its 90.
        planKey: (data.vehicleProtectionLevelDetail && data.vehicleProtectionLevelDetail.key) || null,
        planTakeRate: HostOS.parser.planTakeRate(data),
        includedMiles: HostOS.parser.number((data.booking || {}).mileageLimit),
        cancellationPolicyType: data.cancellationPolicyType || null,
        deliveryLocationId: (data.location && data.location.deliveryLocation && data.location.locationId)
          ? String(data.location.locationId)
          : null,
        // Explicitly false is Turo telling us this is not a delivery, which is
        // a real $0. A missing location object tells us nothing at all, and
        // must not be spent as a zero.
        deliveryLocation: data.location ? Boolean(data.location.deliveryLocation) : null
      }
    };
  }

  // Turo's take rate, the length discount for these exact dates, and the
  // per-location delivery fees — all from the public listing endpoint, which
  // needs no owner permissions. The reservation payload itself carries none of
  // this: booking.cost and booking.hostShare are nulled out for a co-host.
  function toTuroDate(value) {
    const time = HostOS.dates.parseTime(value);
    if (time === null) return null;
    const date = new Date(time);
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + "/" + date.getFullYear(),
      time: pad(date.getHours()) + ":" + pad(date.getMinutes())
    };
  }

  async function fetchVehiclePricing(vehicleId, pickupDate, returnDate) {
    const start = toTuroDate(pickupDate);
    const end = toTuroDate(returnDate);
    if (!vehicleId || !start || !end) return null;
    const query = "vehicleId=" + encodeURIComponent(vehicleId)
      + "&startDate=" + encodeURIComponent(start.date) + "&startTime=" + encodeURIComponent(start.time)
      + "&endDate=" + encodeURIComponent(end.date) + "&endTime=" + encodeURIComponent(end.time);
    const response = await fetch("/api/vehicle/detail?" + query, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const rate = data.dateRangeRate || {};
    const protection = data.currentVehicleProtection || {};
    const deliveryFees = {};
    (data.vehicleDeliveryLocations || []).forEach((entry) => {
      if (!entry || !entry.locationId) return;
      const fee = entry.promotionalFee && typeof entry.promotionalFee.amount === "number"
        ? entry.promotionalFee.amount
        : (entry.fee && entry.fee.amount);
      if (typeof fee === "number") deliveryFees[String(entry.locationId)] = fee;
    });
    return {
      // The vehicle's CURRENT plan - kept for reference only; the trip is
      // priced on its own plan (pricing.planTakeRate). Delivery fees pay the
      // host at their own rate whatever the plan: 0.9 on the 70 plan, read
      // live, and Matt's "you get 90 percent of this" about the $120 fee.
      vehicleCurrentTakeRate: HostOS.parser.number(protection.hostTakeRate),
      deliveryTakeRate: HostOS.parser.number(protection.hostDeliveryTakeRate),
      lengthDiscountPercent: HostOS.parser.number(rate.rentalPriceDiscountPercentage) || 0,
      deliveryFees,
      pricingCheckedAt: new Date().toISOString()
    };
  }

  // The guest's track record — the signal that was missing when Matt lost a
  // windshield to Johennie (1.0 star across a single trip, joined that same
  // year) on a Premier plan. The reservation payload has no rating on it, so
  // this is a second lookup keyed on renter.id.
  //
  // Fetched once per trip and then left alone: a guest's history barely moves
  // over the life of a booking, and it isn't worth a request per sweep.
  async function fetchGuest(driverId) {
    const response = await fetch("/api/v2/driver/detail?driverId=" + encodeURIComponent(driverId), {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const ratings = data.ratingsFromCarOwners || {};
    const since = data.memberSince || {};
    return {
      // null rather than 0 when nobody has rated them — "unrated" and "rated
      // zero" are very different things to show a host.
      guestRating: typeof ratings.overall === "number" ? ratings.overall : null,
      guestRatingCount: HostOS.parser.number(data.numberOfRatingsFromCarOwners) || 0,
      guestTripCount: HostOS.parser.number(data.numberOfRentalsFromCarOwners) || 0,
      guestMemberSince: since.year ? { month: since.month || null, year: since.year } : null,
      guestCheckedAt: new Date().toISOString()
    };
  }

  async function fetchProtection(reservationId) {
    return (await fetchDetail(reservationId)).protection;
  }

  // Worth a look if we've never checked it, or the check has gone stale, and
  // the trip hasn't already finished (a completed trip can't be canceled, so
  // its plan is no longer actionable).
  function needsCheck(trip) {
    if (!trip.reservationId || !/^\d+$/.test(String(trip.reservationId))) return false;
    if (HostOS.dates.hasReturned(trip)) return false;
    if (HostOS.dates.isCancelled(trip)) return false;
    if (!trip.protectionCheckedAt) return true;
    // Priced under an older earnings chain, so its stored figure cannot be
    // trusted however recently the plan itself was checked.
    if (trip.earningsVersion !== HostOS.constants.EARNINGS_VERSION) return true;
    const checked = HostOS.dates.parseTime(trip.protectionCheckedAt);
    return checked === null || Date.now() - checked > RECHECK_MS;
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      const trips = await HostOS.storage.getTrips();
      // Soonest first, so a trip about to start is resolved before one weeks
      // out — that's the one where a cancellation decision is most urgent.
      const queue = trips
        .filter(needsCheck)
        .sort((a, b) => {
          const aTime = HostOS.dates.parseTime(a.pickupDate) || Infinity;
          const bTime = HostOS.dates.parseTime(b.pickupDate) || Infinity;
          return aTime - bTime;
        })
        .slice(0, BATCH_SIZE);
      if (!queue.length) return;

      // Matt's standing delivery fee, used only where Turo exposes none. Read
      // once per sweep rather than per trip.
      const { hostosPricingConfig = {} } = await chrome.storage.local.get("hostosPricingConfig");
      const configured = HostOS.parser.number(hostosPricingConfig.standingDeliveryFee);
      const standingDelivery = configured === null ? HostOS.constants.STANDING_DELIVERY_FEE : configured;

      const results = new Map();
      // Kept separate from `results` on purpose: results gets spread onto the
      // trip and saved, and candidate blocks are search scaffolding that must
      // never be persisted.
      const candidates = new Map();
      for (const trip of queue) {
        try {
          const detail = await fetchDetail(trip.reservationId);
          let found = { ...detail.protection, ...detail.pricing };
          // The trip's own plan comes from the RESERVATION, so it is written
          // here, before the vehicle-pricing call that can fail. Left inside
          // that call, a failed pricing lookup kept whatever rate was stored
          // before - the vehicle's current 0.7 - on a 90-plan trip.
          found.hostTakeRate = detail.pricing.planTakeRate;
          found.hostTakeRateSource = detail.pricing.planKey;
          // Pricing inputs are re-read on the same cadence as the plan: the
          // length discount depends on the trip's dates, and delivery fees and
          // take rates are host settings that can change.
          try {
            const pricing = await fetchVehiclePricing(detail.pricing.vehicleId, trip.pickupDate, trip.returnDate);
            if (pricing) {
              const turoFee = detail.pricing.deliveryLocationId
                ? HostOS.parser.number(pricing.deliveryFees[detail.pricing.deliveryLocationId])
                : null;
              found = {
                ...found,
                vehicleCurrentTakeRate: pricing.vehicleCurrentTakeRate,
                deliveryTakeRate: pricing.deliveryTakeRate,
                lengthDiscountPercent: pricing.lengthDiscountPercent,
                // A reservation that IS a delivery but whose location is missing
                // from the vehicle's fee table used to fall back to 0 here -
                // silently pricing a delivery trip as though delivery were
                // free, understating it by the whole fee (about $120 at DIA)
                // and pushing it toward a false Profit Risk flag. Unknown is
                // now null, and null is carried through as unknown rather
                // than being spent as a zero. A trip with no delivery at all
                // really is 0, and that stays 0.
                // Turo's own per-location fee is the real number and wins wherever
                // it can be read - it reproduced Brent's receipt to the cent.
                // Matt's standing rate fills the gap, and says so.
                deliveryFee: turoFee !== null ? turoFee : standingDelivery,
                deliveryFeeSource: turoFee !== null ? "turo" : "standing",
                pricingCheckedAt: pricing.pricingCheckedAt
              };
            }
          } catch (pricingError) {
            // Losing the pricing must never cost us the protection plan, which
            // is the reason this sweep exists.
            HostOS.logger.warn("Vehicle pricing lookup failed.", { reservationId: trip.reservationId, error: String(pricingError) });
          }
          // Only the first time for a given trip — a guest's rating and trip
          // count barely move over the life of a booking, so re-fetching it
          // every sweep would double the request volume for nothing.
          if (detail.driverId && !trip.guestCheckedAt) {
            try {
              found = { ...found, ...(await fetchGuest(detail.driverId)) };
            } catch (guestError) {
              // A missing rating must never cost us the protection plan,
              // which is the reason this sweep exists.
              HostOS.logger.warn("Guest lookup failed.", { reservationId: trip.reservationId, error: String(guestError) });
            }
          }
          results.set(trip.reservationId, found);
          if (detail.extrasCandidates && detail.extrasCandidates.length) {
            candidates.set(trip.reservationId, detail.extrasCandidates);
          }
          consecutiveFailures = 0;
        } catch (error) {
          consecutiveFailures += 1;
          HostOS.logger.warn("Protection lookup failed.", { reservationId: trip.reservationId, error: String(error) });
        }
        await new Promise((resolve) => setTimeout(resolve, GAP_MS));
      }
      if (!results.size) {
        await chrome.storage.local.set({ hostosProtectionStatus: { failures: consecutiveFailures, updatedAt: new Date().toISOString() } });
        return;
      }

      // Re-read rather than reusing the copy from the top of this function:
      // the list scanner may have written to storage while these fetches were
      // in flight, and merging onto a stale snapshot would drop its work.
      // The earnings figure is computed HERE and stored on the trip, so the
      // panel, the Chrome notifications, the Premier alert and the nightly
      // report all read one number rather than each deriving their own. The
      // service worker in particular cannot run riskEngine at all.
      const { hostosFleetAvailability } = await chrome.storage.local.get("hostosFleetAvailability");
      const byPlate = HostOS.queueView.vehiclesByPlate(hostosFleetAvailability);

      const latest = await HostOS.storage.getTrips();
      // Cross-validated against the page scrape before it is allowed to move
      // any money. Returns null until a path has proven itself.
      const extrasPath = await proveExtrasPath(latest, candidates);
      const merged = latest.map((trip) => {
        const found = results.get(trip.reservationId);
        if (!found) return trip;
        const next = { ...trip, ...found };
        // The page scrape stays authoritative wherever it exists - it is the
        // verified source. The JSON only fills in trips the detail scan can
        // never reach, which is every trip more than 72 hours out.
        if (Array.isArray(next.extras)) {
          // Already known, so leave the values alone. Label the source only if
          // it has never been labelled: the previous version flipped "api" to
          // "page" on the very next sweep, which hid exactly what this field
          // exists to reveal. A detail scan is the only thing that reads the
          // reservation page, so its timestamp is the tell.
          if (!next.extrasSource) next.extrasSource = next.detailScannedAt ? "page" : "api";
        } else if (extrasPath) {
          const option = (candidates.get(trip.reservationId) || []).find((entry) => entry.path === extrasPath.path);
          if (option) {
            next.extras = option.extras;
            next.extrasSource = "api";
          }
        }
        const base = HostOS.queueView.baseRentalFor(next, byPlate.get(next.plate));
        const computed = base === null ? null : HostOS.earnings.compute(next, base);
        // The whole result is stored, not just the per-mile rate. The card
        // used to recompute earnings for display while the risk rule used the
        // stored rate — two paths over the same inputs, free to drift apart
        // the moment the calendar reprices. One computation, stored once,
        // displayed as-is.
        next.estimatedEarnings = computed ? computed.earnings : null;
        next.earningsPerMile = computed ? computed.perMile : null;
        next.earningsExtras = computed ? computed.extras : null;
        next.earningsDelivery = computed ? computed.delivery : null;
        // Which inputs were actually read from Turo, so the card and the 9 PM
        // email can say whether a figure is a real total or only a floor.
        next.earningsInputsKnown = computed ? computed.inputsKnown : false;
        next.earningsUnknownInputs = computed ? computed.unknownInputs : null;
        // Stamped so a later change to the chain can force a re-price rather
        // than waiting out the recheck window on every trip.
        next.earningsVersion = HostOS.constants.EARNINGS_VERSION;
        return HostOS.riskEngine.enrich(next);
      });
      // silent: a protection sweep isn't a page scan, so it must not refresh
      // the footer's "scanned Xs ago" freshness indicator.
      await HostOS.storage.saveTrips(merged, { silent: true });
      await chrome.storage.local.set({
        hostosProtectionStatus: { failures: consecutiveFailures, checked: results.size, updatedAt: new Date().toISOString() }
      });
      HostOS.logger.info("Protection plans checked.", {
        checked: results.size,
        premier: [...results.values()].filter((entry) => entry.protectionLevel === "SUPREME").length
      });
    } finally {
      running = false;
    }
  }

  return { run, isPremier, fetchDetail };
})();
