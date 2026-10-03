window.HostOS = window.HostOS || {};

// Earnings outlook: what the booked calendar is worth, by when it pays.
//
// Sums the per-trip figure the pricing sweep already stored
// (estimatedEarnings - net of the trip's own plan, discounts, extras and
// delivery at its rate), so the outlook and the Profit Risk card can never
// disagree about what one trip is worth. Attributed to the trip's END, since
// that is when Turo pays out. Loaded by the content scripts, the popup and
// the service worker alike, so it depends on HostOS.dates only.
//
// Every window says how many of its trips carry no figure yet - an unpriced
// trip is left out of the sum and named, never counted as zero.
HostOS.outlook = (() => {
  function startOfDay(time) {
    const date = new Date(time);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  // Monday to Sunday, the way Matt talks about a week.
  function weekWindow(now) {
    const today = startOfDay(now);
    const weekday = (new Date(today).getDay() + 6) % 7;
    const start = today - weekday * 864e5;
    return { start, end: start + 7 * 864e5 };
  }

  function monthWindow(now) {
    const date = new Date(now);
    const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
    return { start, end };
  }

  function summarise(trips, start, end) {
    let total = 0;
    let priced = 0;
    let unpriced = 0;
    (trips || []).forEach((trip) => {
      if (HostOS.dates.isCancelled(trip)) return;
      const ends = HostOS.dates.parseTime(trip.returnDate);
      if (ends === null || ends < start || (end !== null && ends >= end)) return;
      const figure = HostOS.parser.number(trip.estimatedEarnings);
      if (figure === null) { unpriced += 1; return; }
      total += figure;
      priced += 1;
    });
    return { total, priced, unpriced, trips: priced + unpriced };
  }

  // Three windows: this week, this month, and everything booked ahead that
  // has not ended yet.
  function compute(trips, now = Date.now()) {
    const week = weekWindow(now);
    const month = monthWindow(now);
    return {
      week: { label: "This week", ...summarise(trips, week.start, week.end) },
      month: { label: "This month", ...summarise(trips, month.start, month.end) },
      ahead: { label: "Booked ahead", ...summarise(trips, now, null) }
    };
  }

  function describe(window) {
    if (!window.trips) return "no trips";
    const parts = ["≈$" + Math.round(window.total).toLocaleString() + " net · " + window.trips + (window.trips === 1 ? " trip" : " trips")];
    if (window.unpriced) parts.push(window.unpriced + " not priced yet");
    return parts.join(" · ");
  }

  return { compute, describe, weekWindow, monthWindow };
})();
