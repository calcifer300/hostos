window.HostOS = window.HostOS || {};

// Watches Turo's own notification feed for new bookings, so a Premier plan is
// caught within a minute or so of the guest booking rather than whenever the
// reservation happens to surface through the normal scan path.
//
// Why this exists: without it, a new booking reaches the protection check only
// after its card RENDERS in Turo's virtualised Booked list (which may need the
// host to scroll), then gets picked up by a list scan, then waits its turn in
// a queue of 100+ reservations. That's ten-plus minutes at best and indefinite
// at worst. Matt's whole reason for wanting the alert is to cancel the trip
// before pickup, so the lag matters.
//
// The feed is the same endpoint that powers turo.com/us/en/inbox/notifications
// and gives a reservationId outright:
//   title:         "(MATTHEW's vehicle) - Booked trip"
//   message:       "Reginald's trip with your Nissan Sentra is booked..."
//   reservationId: 60696601
//   created:       1787684214275   (epoch ms)
// Other observed titles: "Prepare for checkout", "New message",
// "Guest checked out". Only bookings are acted on here.
//
// Undocumented and internal, like the reservation detail endpoint. It's a
// change signal only — never a backfill — so the list scanner remains the
// source of truth for the fleet as a whole.
HostOS.activityScanner = (() => {
  const ENDPOINT = "/api/feeds/activity?driverRoles=HOST&itemsPerPage=30";
  const SEEN_KEY = "hostosActivitySeen";
  // On the very first run there's no high-water mark. Rather than replaying
  // whatever the feed still holds — which could email Matt about bookings he
  // has long since dealt with — only the last day is considered.
  const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;
  let running = false;

  function isBooking(activity) {
    // The title is prefixed with the host's name ("(MATTHEW's vehicle) - "),
    // so match the event part rather than the whole string.
    return /\bbooked trip\b/i.test(activity.title || "");
  }

  // "Trip canceled" - observed live 2026-09-10 for reservation 61156935,
  // message "You canceled Kumar's trip with your Mazda CX-50…". The event
  // names the reservation outright, so a cancellation is recorded the moment
  // the feed is read, with no request and before any scan could re-alert on
  // it. American spelling in Turo's copy; both accepted.
  function isCancellation(activity) {
    return /\btrip cancel+ed\b/i.test(activity.title || "");
  }

  // "Guest checked out" - "Doug has marked their trip as complete." A guest
  // who checks out early ends the trip before its scheduled return, and the
  // post-trip sweep keys on the return date; this stamp lets it start on the
  // real end instead of the scheduled one.
  function isCheckout(activity) {
    return /\bguest checked out\b/i.test(activity.title || "");
  }

  // "New message" on a trip that has come back - the moment a guest writes
  // "I gave you 5 stars", which is what Matt waits for before rating them.
  // Clearing the post-trip stamp makes the next review sweep re-read the
  // thread within about a minute instead of at its 3-hour recheck.
  function isMessage(activity) {
    return /\bnew message\b/i.test(activity.title || "");
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      const response = await fetch(ENDPOINT, { credentials: "include", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const feed = await response.json();
      const activities = (feed && feed.activities) || [];
      if (!activities.length) return;

      const stored = await chrome.storage.local.get(SEEN_KEY);
      const since = (stored[SEEN_KEY] && stored[SEEN_KEY].lastCreated) || (Date.now() - FIRST_RUN_LOOKBACK_MS);
      const highWater = activities.reduce((max, item) => Math.max(max, Number(item.created) || 0), since);

      const recent = activities.filter((item) => Number(item.created) > since && item.reservationId);
      const fresh = recent.filter(isBooking);
      // Cancellations carry no lookup: the record either exists, and is
      // flagged, or it does not, and there is nothing to track. Written with
      // the same read-late rule as the bookings below.
      const cancelled = recent.filter(isCancellation).map((item) => String(item.reservationId));
      const checkedOut = recent.filter(isCheckout);
      const messaged = recent.filter(isMessage).map((item) => String(item.reservationId));
      if (cancelled.length || checkedOut.length || messaged.length) {
        const byId = new Map((await HostOS.storage.getTrips()).map((trip) => [String(trip.reservationId), trip]));
        let flagged = 0;
        cancelled.forEach((reservationId) => {
          const existing = byId.get(reservationId);
          if (!existing || HostOS.dates.isCancelled(existing)) return;
          byId.set(reservationId, HostOS.riskEngine.enrich({
            ...existing, cancelled: true, cancelledSignal: "feed: Trip canceled",
            cancelledSeenAt: new Date().toISOString()
          }));
          flagged += 1;
        });
        checkedOut.forEach((item) => {
          const reservationId = String(item.reservationId);
          const existing = byId.get(reservationId);
          if (!existing || existing.checkedOutAt) return;
          byId.set(reservationId, { ...existing, checkedOutAt: new Date(Number(item.created)).toISOString() });
          flagged += 1;
        });
        messaged.forEach((reservationId) => {
          const existing = byId.get(reservationId);
          if (!existing || existing.completed !== true || existing.hostReviewedAt || !existing.postTripCheckedAt) return;
          byId.set(reservationId, { ...existing, postTripCheckedAt: null });
          flagged += 1;
        });
        if (flagged) await HostOS.storage.saveTrips([...byId.values()], { silent: true });
        HostOS.logger.info("Cancellations, checkouts and messages read from the activity feed.",
          { cancellations: cancelled.length, checkouts: checkedOut.length, messages: messaged.length, flagged });
      }
      if (!fresh.length) {
        await chrome.storage.local.set({ [SEEN_KEY]: { lastCreated: highWater, checkedAt: new Date().toISOString() } });
        return;
      }

      // Every lookup happens BEFORE storage is read. Reading the trip list
      // first and writing it back after several seconds of network calls
      // would discard anything the list scanner saved in the meantime — the
      // same overwrite bug already fixed twice in this project.
      const found = [];
      for (const item of fresh) {
        const reservationId = String(item.reservationId);
        try {
          found.push({ reservationId, item, detail: await HostOS.protectionScanner.fetchDetail(reservationId) });
        } catch (error) {
          HostOS.logger.warn("Could not read a newly booked trip.", { reservationId, error: String(error) });
        }
      }

      if (found.length) {
        const byId = new Map((await HostOS.storage.getTrips()).map((trip) => [String(trip.reservationId), trip]));
        found.forEach(({ reservationId, item, detail }) => {
          const existing = byId.get(reservationId);
          if (existing) {
            // The list scanner owns this trip's dates and vehicle text; only
            // the plan is added here.
            byId.set(reservationId, HostOS.riskEngine.enrich({ ...existing, ...detail.protection }));
            return;
          }
          // No card has rendered for this booking yet. A minimal record is
          // enough for the Premier alert, which needs only the plan. Having
          // no dates makes it eligible for a detail scan (see
          // eligibleForDetailScan), which is what fills them in.
          byId.set(reservationId, HostOS.riskEngine.enrich({
            reservationId,
            guestName: (item.actor && item.actor.firstName) || null,
            vehicle: detail.vehicle.vehicle || "Vehicle",
            plate: detail.vehicle.plate,
            tripUrl: "https://turo.com/us/en/reservation/" + reservationId,
            pickupDate: null,
            returnDate: null,
            licenseVerified: null,
            estimatedMiles: null,
            pricePerMile: null,
            riskReasons: [],
            // When the guest actually booked, from the feed event itself -
            // not when this code happened to see it. The immediate Premier
            // alert is for bookings made just now; an event processed days
            // late is not one, however new the record is.
            bookedAt: Number(item.created) || null,
            discoveredVia: "activity-feed",
            scannedAt: new Date().toISOString(),
            ...detail.protection
          }));
        });
        // silent: this isn't a page scan, so it must not refresh the footer's
        // "scanned Xs ago", which is how the host judges list-scan freshness.
        await HostOS.storage.saveTrips([...byId.values()], { silent: true });
      }
      await chrome.storage.local.set({ [SEEN_KEY]: { lastCreated: highWater, checkedAt: new Date().toISOString() } });
      HostOS.logger.info("New bookings checked from the activity feed.", { bookings: fresh.length });
    } catch (error) {
      HostOS.logger.warn("Activity feed check failed.", error);
    } finally {
      running = false;
    }
  }

  return { run };
})();
