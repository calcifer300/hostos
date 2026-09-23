// availability.js
// Figures out which fleet vehicles have NO trip covering "today" or
// "tomorrow", by reconstructing each vehicle's actual booked date range
// from its trip cards — not just counting exact-day check-in/check-out
// matches.
//
// Why ranges instead of exact-day matches: a car checked in three days ago
// and returning three days from now won't have a check-in or check-out
// card today, but it's obviously not "available." So for each plate we
// pair up its Starting (checkin) card with its later Ending (checkout)
// card into a [start, end] range, and treat "Started" / "In progress"
// cards as proof the vehicle is currently out (open-ended if we don't
// also see its return date on the page).

// Turns a "M/D" string (as produced by resolveDateLabel in formatter.js)
// into a comparable UTC timestamp for a given year.
function dateKeyToTimestamp(mD, year) {
    const parts = mD.split("/");
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    return Date.UTC(year, month - 1, day);
}

function getPacificYear() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric"
    }).formatToParts(new Date());
    return parseInt(parts.find(p => p.type === "year").value, 10);
}

// events: [{ plate, dateStr, action, skipReason }] — one entry per trip
// card that had a readable plate, regardless of whether it was a
// checkin/checkout/skip. Returns { PLATE: [{start, end}, ...] } with
// start/end as inclusive UTC timestamps (end may be Infinity for an
// open-ended, still-in-progress trip).
function buildBookedRanges(events) {
    const byPlate = {};

    events.forEach(e => {
        if (!e.plate) return;
        if (!byPlate[e.plate]) byPlate[e.plate] = [];
        byPlate[e.plate].push(e);
    });

    const ranges = {};

    Object.keys(byPlate).forEach(plate => {
        const plateEvents = byPlate[plate].slice().sort((a, b) => a.ts - b.ts);

        let openStart = null;
        const plateRanges = [];

        plateEvents.forEach(e => {
            const isStartLike =
                e.action === "checkin" ||
                (e.action === "skip" && /^(Started|In progress)/i.test(e.skipReason || ""));
            const isEndLike = e.action === "checkout";

            if (isStartLike && openStart === null) {
                openStart = e.ts;
            }

            if (isEndLike) {
                // If we never saw a start-like event for this plate before
                // this checkout, the trip started before it fell into the
                // scraped window (e.g. picked up several days ago). That's
                // still proof the vehicle is currently out — treat it as
                // booked all the way up through this checkout date, not
                // just on the checkout's own day.
                const start = openStart !== null ? openStart : -Infinity;
                plateRanges.push({ start: start, end: e.ts });
                openStart = null;
            }
        });

        // A start with no matching end visible on the page yet — the
        // return date just isn't in the current scrape. Treat it as
        // still-booked indefinitely so it doesn't wrongly show as available.
        if (openStart !== null) {
            plateRanges.push({ start: openStart, end: Infinity });
        }

        ranges[plate] = plateRanges;
    });

    return ranges;
}

function isBookedAt(plateRanges, ts) {
    return (plateRanges || []).some(r => ts >= r.start && ts <= r.end);
}

// fleetEntries: [{ plate, ...fleetData }] — every known vehicle.
// events: raw trip events (see buildBookedRanges).
// todayStr / tomorrowStr: "M/D" strings.
// Returns fleet entries that are free on AT LEAST ONE of the two days,
// each annotated with availableToday / availableTomorrow booleans so the
// caller can show which window actually applies (a car booked tomorrow
// noon is still worth flagging as free right now).
function computeAvailability(fleetEntries, events, todayStr, tomorrowStr) {
    const year = getPacificYear();

    const enriched = events
        .filter(e => e.plate)
        .map(e => Object.assign({}, e, { ts: dateKeyToTimestamp(e.dateStr, year) }));

    const ranges = buildBookedRanges(enriched);

    const todayTs = dateKeyToTimestamp(todayStr, year);
    const tomorrowTs = dateKeyToTimestamp(tomorrowStr, year);

    return (fleetEntries || [])
        .map(entry => {
            const plateRanges = ranges[entry.plate];
            const availableToday = !isBookedAt(plateRanges, todayTs);
            const availableTomorrow = !isBookedAt(plateRanges, tomorrowTs);
            return Object.assign({}, entry, { availableToday, availableTomorrow });
        })
        .filter(entry => entry.availableToday || entry.availableTomorrow);
}
