window.HostOS = window.HostOS || {};

// Post-trip sweep. For every trip that has come back, reads what Turo knows
// about how it went and whether Matt has rated the guest yet, and stores it on
// the trip so the Pending Reviews queue, the nightly report and the
// notifications all read one record.
//
// Two same-origin JSON requests per trip, both read live on 2026-09-10:
//
//   /api/reservation/detail            statusCode COMPLETED; tripEnd (real end,
//                                      populated once the trip is over);
//                                      odometerDetail (miles driven / excess);
//                                      reimbursementStatus; cleaningRecord;
//                                      renter.id; owner.id and cohosts[].id.
//   /api/driver/reviews_from_owners    every host's review of this guest, with
//     ?driverId=&page=1&pageSize=10    author, rating, date and text. The bare
//                                      ?driverId= form is a 400.
//   /api/v2/reservation/conversation   the trip's message thread, newest
//     ?reservationId=                  first: author, authorDriverRole
//                                      (GUEST / HOST / CO_HOST), text,
//                                      sentTime. Read for the guest saying
//                                      they have rated Matt - his rule is to
//                                      rate back only after that, and Turo's
//                                      double-blind reviews hide the guest's
//                                      rating until he does.
//
// "Has Matt rated this trip" is a review by anyone on the host team dated
// after the trip ended. Turo exposes no flag for it - needsFeedback was false
// on every trip checked, rated or not - and this is the only reading that
// noticed Kaushal's review the day it was written.
HostOS.reviewScanner = (() => {
  const DETAIL = "/api/reservation/detail?oppTermsAware=true&reservationId=";
  const REVIEWS = "/api/driver/reviews_from_owners?page=1&pageSize=10&driverId=";
  const CONVERSATION = "/api/v2/reservation/conversation?reservationId=";
  const BATCH_SIZE = 8;
  const GAP_MS = 500;
  // A trip stays interesting for the review window plus a margin, so a rating
  // given late is still recorded against it.
  const LOOKBACK_MS = (HostOS.constants.REVIEW_WINDOW_DAYS + 20) * 24 * 60 * 60 * 1000;
  // Re-read while unrated, so a rating Matt gives from the app is noticed the
  // same day; once rated there is nothing left to learn.
  const RECHECK_MS = 3 * 60 * 60 * 1000;
  let running = false;

  async function getJson(url) {
    const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("not-authenticated");
    return response.json();
  }

  const scalar = (value) => (value && typeof value === "object" && "scalar" in value)
    ? HostOS.parser.number(value.scalar) : HostOS.parser.number(value);
  const epochIso = (value) => {
    const millis = value && typeof value === "object" ? value.epochMillis : value;
    const time = HostOS.dates.parseTime(millis);
    return time === null ? null : new Date(time).toISOString();
  };

  // Pure, so it is testable against captured payloads. Returns the fields to
  // merge onto the trip, or null when the reservation is not completed.
  function summarise(detail, reviews, conversation, now = Date.now()) {
    const status = HostOS.parser.reservationStatus(detail);
    const found = { postTripCheckedAt: new Date(now).toISOString(), postTripVersion: HostOS.constants.POST_TRIP_VERSION };
    const driverId = detail && detail.renter && detail.renter.id;
    if (driverId) found.driverId = String(driverId);
    // A cancellation seen here is recorded the same way the plan sweep does it.
    const cancelledSignal = HostOS.parser.cancellationSignal(detail);
    if (cancelledSignal) {
      return { ...found, cancelled: true, cancelledSignal, cancelledSeenAt: found.postTripCheckedAt };
    }
    if (status !== "COMPLETED") return found;

    const odometer = (detail && detail.odometerDetail) || {};
    const reimbursement = detail && detail.reimbursementStatus;
    const cleaning = (detail && detail.cleaningRecord) || {};
    Object.assign(found, {
      completed: true,
      completedAt: epochIso(detail.tripEnd),
      milesDriven: scalar(odometer.distanceDriven),
      milesExcess: scalar(odometer.excessDistance),
      milesLimit: scalar(odometer.distanceLimit),
      reimbursementOpen: Boolean(reimbursement),
      reimbursementNote: (reimbursement && reimbursement.explanation) || null,
      cleaned: cleaning.cleaned === true ? true : null
    });

    // The host team: owner plus every co-host on the reservation. A review by
    // any of them after the trip ended is the rating for this trip.
    const team = new Set();
    if (detail.owner && detail.owner.id) team.add(String(detail.owner.id));
    (detail.cohosts || []).forEach((host) => { if (host && host.id) team.add(String(host.id)); });
    const ended = HostOS.dates.parseTime(found.completedAt);
    const list = (reviews && reviews.list) || [];
    let latest = null;
    list.forEach((review) => {
      const author = review.author && review.author.id;
      const at = HostOS.dates.parseTime(review.date && review.date.epochMillis);
      if (!author || !team.has(String(author)) || at === null) return;
      // A day of slack: a guest can check out early and the review can land
      // before the scheduled end.
      if (ended !== null && at < ended - 24 * 60 * 60 * 1000) return;
      if (!latest || at > latest.at) latest = { at, rating: review.overallRating };
    });
    found.hostReviewedAt = latest ? new Date(latest.at).toISOString() : null;
    found.hostReviewRating = latest && Number.isInteger(latest.rating) ? latest.rating : null;
    found.guestReviewFlags = HostOS.reviews.flagsFromReviews(list);
    found.guestReviewCount = list.length;

    // The guest saying they have rated Matt, in their own messages after the
    // trip (a day of slack for early checkouts). Null means they have not
    // said so - not that they have not rated.
    found.guestSaysRated = null;
    (Array.isArray(conversation) ? conversation : []).forEach((message) => {
      if (found.guestSaysRated || !message || message.authorDriverRole !== "GUEST") return;
      const at = HostOS.dates.parseTime(message.sentTime && message.sentTime.epochMillis);
      if (at === null || (ended !== null && at < ended - 24 * 60 * 60 * 1000)) return;
      const quote = HostOS.reviews.saysRated(message.text);
      if (quote) found.guestSaysRated = { at: new Date(at).toISOString(), quote };
    });
    return found;
  }

  function needsCheck(trip, now = Date.now()) {
    if (!trip.reservationId || !/^\d+$/.test(String(trip.reservationId))) return false;
    if (HostOS.dates.isCancelled(trip)) return false;
    const ended = HostOS.reviews.endedAt(trip);
    const returned = (ended !== null && ended <= now) || Boolean(trip.checkedOutAt);
    if (!returned) return false;
    if (ended !== null && now - ended > LOOKBACK_MS) return false;
    if (trip.postTripVersion !== HostOS.constants.POST_TRIP_VERSION) return true;
    const checked = HostOS.dates.parseTime(trip.postTripCheckedAt);
    if (checked === null) return true;
    // Rated: nothing more to learn. Otherwise look again every few hours.
    if (trip.hostReviewedAt) return false;
    return now - checked > RECHECK_MS;
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      const trips = await HostOS.storage.getTrips();
      const queue = trips.filter((trip) => needsCheck(trip))
        // Most recently ended first: that is the review Matt can still give.
        .sort((a, b) => (HostOS.reviews.endedAt(b) || 0) - (HostOS.reviews.endedAt(a) || 0))
        .slice(0, BATCH_SIZE);
      if (!queue.length) return;

      // Every request happens BEFORE storage is read - the same read-late rule
      // as the other sweeps, for the same reason.
      const results = new Map();
      let failures = 0;
      for (const trip of queue) {
        try {
          const detail = await getJson(DETAIL + encodeURIComponent(trip.reservationId));
          let reviews = null;
          let conversation = null;
          const driverId = detail && detail.renter && detail.renter.id;
          if (driverId && HostOS.parser.reservationStatus(detail) === "COMPLETED") {
            try {
              reviews = await getJson(REVIEWS + encodeURIComponent(driverId));
            } catch (reviewError) {
              // The trip's own facts are still worth keeping; the rating is
              // simply unknown until the next pass.
              HostOS.logger.warn("Guest reviews lookup failed.", { reservationId: trip.reservationId, error: String(reviewError) });
            }
            try {
              conversation = await getJson(CONVERSATION + encodeURIComponent(trip.reservationId));
            } catch (threadError) {
              HostOS.logger.warn("Trip thread lookup failed.", { reservationId: trip.reservationId, error: String(threadError) });
            }
          }
          results.set(String(trip.reservationId), summarise(detail, reviews, conversation));
          failures = 0;
        } catch (error) {
          failures += 1;
          HostOS.logger.warn("Post-trip lookup failed.", { reservationId: trip.reservationId, error: String(error) });
          if (/not-authenticated|HTTP 40/.test(String(error))) break;
        }
        await new Promise((resolve) => setTimeout(resolve, GAP_MS));
      }
      if (!results.size) return;

      const latest = await HostOS.storage.getTrips();
      const merged = latest.map((trip) => {
        const found = results.get(String(trip.reservationId));
        return found ? HostOS.riskEngine.enrich({ ...trip, ...found }) : trip;
      });
      await HostOS.storage.saveTrips(merged, { silent: true });
      HostOS.logger.info("Post-trip sweep.", { checked: results.size, failures });
    } catch (error) {
      HostOS.logger.warn("Post-trip sweep failed.", error);
    } finally {
      running = false;
    }
  }

  return { run, summarise, needsCheck };
})();
