window.HostOS = window.HostOS || {};

HostOS.dates = {
  // Turo's Booked list renders a trip TWICE once both ends are in range —
  // once under its pickup date reading "Starting at 3:30 PM", and again under
  // its return date reading "Ending at 4:00 PM". Confirmed live: 149 cards
  // for 89 reservations, 60 of them appearing twice. Because mergeTrip walks
  // the cards in DOM order, the later "Ending" card overwrites tripStatus, so
  // an ordinary UPCOMING trip ends up stored as tripStatus "ending".
  //
  // That makes tripStatus useless as a signal for whether a trip is running:
  // it really means "the last card seen for this trip was its end". Every
  // judgement below is therefore made from the dates themselves, which the
  // two cards between them fill in completely and correctly.
  //
  // parseTime returns null for a missing date rather than a number, because
  // new Date(null).getTime() is 0 — a finite value that silently reads as
  // "January 1970" and passes any Number.isFinite check.
  parseTime(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time > 0 ? time : null;
  },

  // Turo doesn't let a guest upload their license until within 24 hours of
  // pickup, so anything earlier is a false alarm. A past pickup isn't
  // actionable either — the trip already happened one way or another — so
  // the window is strictly upcoming: from right now up to 24 hours out,
  // nothing before and nothing after.
  isWithinLicenseUploadWindow(value) {
    const time = HostOS.dates.parseTime(value);
    if (time === null) return false;
    const msUntilPickup = time - Date.now();
    return msUntilPickup >= 0 && msUntilPickup <= 24 * 60 * 60 * 1000;
  },

  // Earnings Risk exists so a host can cancel a bad-economics trip before
  // it happens — once pickup has occurred, canceling isn't an option
  // anymore, so a trip that's already active (or whose pickup has simply
  // passed) shouldn't be shown there even if the underlying rate is still
  // technically below $0.20/mile.
  // A cancelled reservation is not a trip any more, whatever its dates say.
  // Nothing in the extension knew this until 2026-09-10: reservation 61109808
  // was cancelled by Matt on 9/8 and the extension emailed URGENT about its
  // Premier plan on 9/10 - twice - because a cancelled reservation kept its
  // record, its plan and its future dates, and looked exactly like a live one.
  // Written by the detail scan (the page heading reads "Cancelled trip") and
  // by the reservation API (see HostOS.parser.cancellationSignal). Only ever
  // set to true; a scan that cannot tell says nothing rather than false.
  isCancelled(trip) {
    return Boolean(trip) && trip.cancelled === true;
  },

  hasNotStarted(trip) {
    // Every caller uses this to mean "still ahead of us and still actionable"
    // - the panel's queues, the notifications, the Premier alert, the report.
    // A cancelled trip is none of those, so gating it here once means no
    // consumer can forget to.
    if (HostOS.dates.isCancelled(trip)) return false;
    const pickup = HostOS.dates.parseTime(trip.pickupDate);
    // An unknown pickup can't be claimed as upcoming. This is the normal
    // state for a trip that started before the list's window, which shows
    // only its "Ending at" card and so yields no pickup date at all.
    if (pickup === null) return false;
    return pickup > Date.now();
  },

  // Picked up and not yet returned.
  isActive(trip) {
    const now = Date.now();
    const ret = HostOS.dates.parseTime(trip.returnDate);
    if (ret === null || ret <= now) return false;
    const pickup = HostOS.dates.parseTime(trip.pickupDate);
    // No known pickup but a return still ahead means the trip started before
    // the visible window — it's out on rent right now.
    return pickup === null || pickup <= now;
  },

  // Turo pays a host out when a trip completes, so the daily roll-up credits
  // a trip's whole value to the calendar date it ends on.
  isToday(value) {
    const time = HostOS.dates.parseTime(value);
    if (time === null) return false;
    const date = new Date(time);
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  },

  // Whether a return time has already passed, so the UI can say "ended"
  // rather than "ends" for a trip that came back earlier today.
  hasReturned(trip) {
    const ret = HostOS.dates.parseTime(trip.returnDate);
    return ret !== null && ret <= Date.now();
  },

  // Billable days from pickup to return. Turo charges a partial day as a
  // FULL day, so this rounds up, not to nearest.
  //
  // Confirmed against reservation 60634202: Thu 4:30 PM to Sun 7:30 PM is
  // 3 days 3 hours, and the receipt Matt sent charges "4 days @ $40.00/day".
  // Its 800-mile allowance says the same thing independently - the listing
  // gives 200 miles/day, and 800 / 200 = 4. Math.round returned 3 there,
  // understating that trip by a whole night: $120 base instead of $160, so
  // $251.78 earned instead of $283.21 - 11% low. Understating earnings is
  // what pushes a healthy trip under the $0.20/mile line, which is the exact
  // false positive Matt reported.
  //
  // Measured in clock time rather than elapsed milliseconds: a trip running
  // across the end of DST gains a real hour, which would otherwise turn an
  // exact 3-day booking into 3.04 days and bill it as 4.
  tripDayCount(trip) {
    const start = HostOS.dates.parseTime(trip.pickupDate);
    const end = HostOS.dates.parseTime(trip.returnDate);
    if (start === null || end === null || end <= start) return null;
    const dstShift = (new Date(end).getTimezoneOffset() - new Date(start).getTimezoneOffset()) * 60 * 1000;
    const days = (end - start - dstShift) / (24 * 60 * 60 * 1000);
    // A hair under a whole day is that whole day, not the next one up.
    return Math.max(1, Math.ceil(days - 1e-9));
  }
};
