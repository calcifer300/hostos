// enrichment.js
// Reads risk signals HostOS has no other source for, straight from Turo's own
// JSON APIs rather than from rendered markup.
//
// Ported from the CC build's content/protectionScanner.js. Two signals matter
// here, and both were verified live in that project:
//
// 1. THE GUEST'S PROTECTION PLAN.
//    A guest on the Premier plan has a $0 out-of-pocket maximum, so the host
//    cannot bill them for damage and recovers nothing. This deliberately does
//    NOT come from the reservation page's "Earnings plan" section: that
//    section's "Damage responsibility: $2,750.00" is the HOST's own deductible,
//    verified against reservation 57760996 — a Premier booking that shows
//    $2,750 there while the guest held a $0 plan. The words "Premier",
//    "protection plan" and "out-of-pocket" appear nowhere on that page, so any
//    check reading it could never fire, for any trip, ever.
//
//    The real value is a structured enum on the same endpoint that powers the
//    car sharing agreement:
//      protectionLevel "SUPREME"  -> Premier, maxOutOfPocket.amount === 0
//      protectionLevel "DECLINED" -> guest declined cover, maxOutOfPocket null
//
// 2. THE GUEST'S TRACK RECORD.
//    The reservation payload carries no rating, so this is a second lookup
//    keyed on renter.id. Verified against reservation 57760996: the guest reads
//    1.0 star over a single trip, joined May 2026 — matching the page exactly.
//
// Both are plain same-origin fetches (~17KB, well under a second), so unlike
// the license sweep this needs NO background tab and no wait for Turo to
// render. That is why it can cover every known trip instead of only those
// inside a short window: a Premier booking is worth knowing about when it is
// made, not three days before pickup when cancelling is expensive.

const ENRICH_RESERVATION_ENDPOINT = "/api/reservation/detail?oppTermsAware=true&reservationId=";
const ENRICH_DRIVER_ENDPOINT = "/api/v2/driver/detail?driverId=";

// Turo's own pages issue these requests, but a queue of them in a tight loop
// would not look like ordinary browsing. Small batches, spaced out.
const ENRICH_BATCH_SIZE = 15;
const ENRICH_GAP_MS = 350;

function enrichNumber(value) {
    // Number(null) is 0 and Number("") is 0 — both finite, so a plain
    // Number.isFinite check turns "never checked" into a real zero. That is the
    // bug that made every unscanned trip read as $0.00/mile in the CC build.
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

async function enrichFetchJson(path) {
    const response = await fetch(path, {
        credentials: "include",
        headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
}

// The guest's plan, the vehicle identity Turo has on file, and the renter id
// needed for the rating lookup.
async function fetchReservationEnrichment(reservationId) {
    const data = await enrichFetchJson(ENRICH_RESERVATION_ENDPOINT + encodeURIComponent(reservationId));

    const detail = data.protectionLevelDetail || {};
    const amount = detail.maxOutOfPocket && detail.maxOutOfPocket.amount;
    const vehicle = data.vehicle || {};
    const registration = vehicle.registration || {};

    return {
        reservation: String(reservationId),
        protectionLevel: data.protectionLevel || null,
        protectionPlanName: detail.selectedShortText || detail.titleText || null,
        // A number, including a genuine 0 (which is exactly what Premier means).
        // Anything non-numeric stays null so "declined" never reads as "$0 cap".
        guestMaxOutOfPocket: typeof amount === "number" ? amount : null,
        // Turo's own registration record — more reliable than the plate text
        // scraped off a trip card, and present even for trips whose card has
        // never rendered.
        plate: registration.licensePlate || null,
        vehicleMake: vehicle.make || null,
        vehicleModel: vehicle.model || null,
        vehicleYear: vehicle.year != null ? String(vehicle.year) : null,
        driverId: (data.renter && data.renter.id) || null,

        // --- Inputs for the earnings reconstruction -----------------------
        // Turo shows a co-host no payout figure at all (booking.cost and
        // booking.hostShare are nulled out), so what the host actually earns
        // has to be rebuilt from these. See src/lib/risk/earnings.ts.
        vehicleId: (data.vehicle && data.vehicle.id) || null,
        includedMiles: enrichNumber((data.booking || {}).mileageLimit),
        cancellationPolicyType: data.cancellationPolicyType || null,
        // The overage rate — what a guest pays PER MILE BEYOND the allowance.
        // Carried for display only. It is NOT the trip's economics and must
        // never be flagged on: an earlier build did exactly that and reported
        // a healthy $0.35/mile trip as a risk because its overage happened to
        // be $0.19.
        pricePerMile: enrichNumber((data.booking || {}).excessFeePerDistance),
        // locationId is the precise join to the vehicle's delivery-fee table;
        // matching on the location's name would break on any wording change.
        deliveryLocationId:
            data.location && data.location.deliveryLocation && data.location.locationId
                ? String(data.location.locationId)
                : null,
        // Explicitly false is Turo telling us this is not a delivery, which is
        // a real $0. A missing location object tells us nothing at all and must
        // not be spent as a zero — that assumption priced a $120 delivery trip
        // at $0 and is what the host caught.
        isDelivery: data.location ? Boolean(data.location.deliveryLocation) : null
    };
}

/**
 * Turo's take rate, the length discount for these exact dates, and the
 * per-location delivery fees — from the public listing endpoint, which needs no
 * owner permissions. The reservation payload itself carries none of this.
 *
 * Returns null rather than zeros when it can't be read, so an unknown never
 * gets spent as a real value downstream.
 */
async function fetchVehiclePricing(vehicleId, startIso, endIso) {
    if (!vehicleId || !startIso || !endIso) return null;

    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (iso) => {
        const d = new Date(iso);
        if (!Number.isFinite(d.getTime())) return null;
        return {
            date: pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + "/" + d.getFullYear(),
            time: pad(d.getHours()) + ":" + pad(d.getMinutes())
        };
    };

    const start = fmt(startIso);
    const end = fmt(endIso);
    if (!start || !end) return null;

    const query =
        "vehicleId=" + encodeURIComponent(vehicleId) +
        "&startDate=" + encodeURIComponent(start.date) + "&startTime=" + encodeURIComponent(start.time) +
        "&endDate=" + encodeURIComponent(end.date) + "&endTime=" + encodeURIComponent(end.time);

    const data = await enrichFetchJson("/api/vehicle/detail?" + query);
    const rate = data.dateRangeRate || {};
    const protection = data.currentVehicleProtection || {};

    const deliveryFees = {};
    (data.vehicleDeliveryLocations || []).forEach((entry) => {
        if (!entry || !entry.locationId) return;
        const fee =
            entry.promotionalFee && typeof entry.promotionalFee.amount === "number"
                ? entry.promotionalFee.amount
                : entry.fee && entry.fee.amount;
        if (typeof fee === "number") deliveryFees[String(entry.locationId)] = fee;
    });

    return {
        hostTakeRate: enrichNumber(protection.hostTakeRate),
        lengthDiscountPercent: enrichNumber(rate.rentalPriceDiscountPercentage) || 0,
        deliveryFees: deliveryFees
    };
}

async function fetchGuestEnrichment(driverId) {
    const data = await enrichFetchJson(ENRICH_DRIVER_ENDPOINT + encodeURIComponent(driverId));

    const ratings = data.ratingsFromCarOwners || {};
    const since = data.memberSince || {};

    return {
        // null rather than 0 when nobody has rated them — "unrated" and "rated
        // zero" are very different things to put in front of a host.
        guestRating: typeof ratings.overall === "number" ? ratings.overall : null,
        guestRatingCount: enrichNumber(data.numberOfRatingsFromCarOwners) || 0,
        guestTripCount: enrichNumber(data.numberOfRentalsFromCarOwners) || 0,
        guestMemberSince: since.year ? String(since.year) : null
    };
}

// Runs the sweep for a list of reservation ids. `withGuest` ids additionally
// get the rating lookup — the caller decides, because a guest's history barely
// moves over the life of a booking and isn't worth re-fetching every sweep.
//
// Always resolves. One reservation Turo refuses must not cost the whole batch,
// which is the same lesson the CC build learned when a single unopenable
// receipt starved its entire detail queue.
async function scrapeReservationEnrichment(reservationIds, withGuestIds, tripWindows) {
    const ids = Array.isArray(reservationIds) ? reservationIds.slice(0, ENRICH_BATCH_SIZE) : [];
    const guestWanted = new Set(Array.isArray(withGuestIds) ? withGuestIds.map(String) : []);
    const windows = tripWindows || {};

    const results = [];
    let failures = 0;

    for (const id of ids) {
        try {
            const entry = await fetchReservationEnrichment(id);

            if (entry.driverId && guestWanted.has(String(id))) {
                try {
                    Object.assign(entry, await fetchGuestEnrichment(entry.driverId));
                } catch (guestErr) {
                    // A failed rating lookup must never cost us the protection
                    // plan, which is the reason this sweep exists at all.
                    console.warn("[HostOS] Guest lookup failed for reservation", id, guestErr);
                }
            }

            // Needs the trip's own dates, which live on the HostOS side — the
            // reservation payload carries tripStart/tripEnd but both are always
            // null. Failing here costs the earnings estimate only, never the
            // protection plan.
            const w = windows[String(id)];
            if (entry.vehicleId && w && w.start && w.end) {
                try {
                    const pricing = await fetchVehiclePricing(entry.vehicleId, w.start, w.end);
                    if (pricing) {
                        entry.hostTakeRate = pricing.hostTakeRate;
                        entry.lengthDiscountPercent = pricing.lengthDiscountPercent;
                        // Resolve the fee for THIS trip's delivery location. A
                        // trip Turo says is not a delivery gets a real 0; one we
                        // could not resolve stays null, because an unknown spent
                        // as a zero understates the trip by the whole fee.
                        if (entry.isDelivery === false) {
                            entry.deliveryFee = 0;
                        } else if (entry.deliveryLocationId) {
                            const fee = pricing.deliveryFees[entry.deliveryLocationId];
                            entry.deliveryFee = typeof fee === "number" ? fee : null;
                        } else {
                            entry.deliveryFee = null;
                        }
                    }
                } catch (priceErr) {
                    console.warn("[HostOS] Pricing lookup failed for reservation", id, priceErr);
                }
                await new Promise((resolve) => setTimeout(resolve, ENRICH_GAP_MS));
            }

            // driverId is KEPT. It was dropped here as an "internal identifier
            // with no use on the HostOS side", which was wrong: it is the only
            // link to the guest s Turo profile, and a low rating is used as a
            // prompt to go read their review history — "if low can go in and
            // see if they have a history of smoking in cars". Without it the
            // rating is a dead end.
            //
            // vehicleId and deliveryLocationId genuinely have no use downstream;
            // they exist only to resolve pricing above.
            delete entry.vehicleId;
            delete entry.deliveryLocationId;
            results.push(entry);
        } catch (err) {
            failures += 1;
            console.warn("[HostOS] Enrichment lookup failed for reservation", id, err);
        }

        await new Promise((resolve) => setTimeout(resolve, ENRICH_GAP_MS));
    }

    return {
        ok: results.length > 0,
        results: results,
        requested: ids.length,
        failures: failures
    };
}
