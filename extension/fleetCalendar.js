// fleetCalendar.js
// Scrapes Turo's Fleet Calendar (turo.com/us/en/trips/calendar) for the real
// vehicle roster: one row per vehicle, keyed by license plate.
//
// WHY THIS EXISTS
// ---------------
// The `fleet` half of the HostOS sync payload came only from getAllFleetEntries()
// — i.e. CUSTOM_FLEET, vehicles typed in by hand through the popup. fleet.js is
// deliberately empty (a prior client's hardcoded roster used to leak into every
// host's vehicle table), so on a fleet nobody had hand-entered, HostOS held 5
// vehicles while its own trips referenced 45 distinct plates. Everything keyed
// off the vehicles table — the Fleet page, occupancy, "available now" — was
// working from a 5-car roster.
//
// The calendar is the only Turo surface that lists the whole fleet with plates
// attached, so it is the right source for the roster.
//
// Ported from the CC build's content/fleetScanner.js, which was verified live
// on 2026-08-24. Rewritten free of that project's HostOS.* namespace so it can
// load as a plain content script here. The DOM reasoning is unchanged and the
// original's hard-won notes are preserved below, because each one encodes a
// real failure:
//
//  - The grid is VIRTUALIZED. Only ~15 of 40+ vehicle rows exist in the DOM at
//    any moment, so a scan must MERGE by plate, never replace the stored set.
//    Replacing is the same bug class as the list-scan overwrite and is why the
//    original's "available" count drifted between scans.
//  - Day cells carry NO date attribute — only an inline left/top pixel offset.
//    Rows and columns are recovered by sorting the distinct offsets actually
//    seen, not by assuming fixed pixel constants.
//  - Column 0 is only "today" if the host hasn't paged the calendar backwards.
//    The leading column's day-of-month is checked before anything is trusted,
//    otherwise real prices get filed against the wrong days.
//  - Vehicle name and plate are the first two <span>s in the row's button, read
//    positionally. Turo's css-xxxxx class hashes regenerate on every deploy and
//    are never relied on.

const FLEET_CALENDAR_SELECTORS = {
    vehicleRow: "[data-testid='sticky-column-row']",
    dayCell: "[data-testid='fleet-calendar-day']",
    reservationMarker: "[data-testid='calendar-day-unavailability-reservation0']"
};

function fleetCalText(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
}

function fleetCalPx(value) {
    const match = String(value || "").match(/(-?\d+(?:\.\d+)?)px/);
    return match ? Number(match[1]) : null;
}

// "Nissan Pathfinder 2024" / "2022 Volkswagen Tiguan" -> { make, model, year }.
// HostOS stores make/model/year as separate columns, but the calendar row gives
// one display string. A trailing or leading 4-digit year is pulled out first,
// then the first remaining word is the make and the rest is the model — which
// keeps two-word models ("Model 3", "Grand Cherokee") intact.
function splitVehicleName(name) {
    const cleaned = String(name || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return { make: null, model: null, year: null };

    let year = null;
    const withoutYear = cleaned
        .replace(/\b(19|20)\d{2}\b/, (match) => {
            if (year === null) year = match;
            return " ";
        })
        .replace(/\s+/g, " ")
        .trim();

    if (!withoutYear) return { make: null, model: null, year };

    const parts = withoutYear.split(" ");
    return {
        make: parts[0] || null,
        model: parts.length > 1 ? parts.slice(1).join(" ") : null,
        year: year
    };
}

// Every price column is identified only by its horizontal position, so the whole
// grid is meaningless unless column 0 really is today. The calendar has
// back/forward controls, and if the host has paged backwards then column 0 is
// some past date. The header cell reads e.g. "TUE 25", so the leading column's
// day-of-month is checked against today's before anything is trusted.
function fleetCalendarShowsToday() {
    const headers = [...document.querySelectorAll("*")].filter(
        (element) => !element.children.length && /^(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.test(fleetCalText(element))
    );
    if (!headers.length) return false;

    const first = headers
        .map((element) => ({ element, left: element.getBoundingClientRect().left }))
        .sort((a, b) => a.left - b.left)[0];

    const dayMatch = fleetCalText(first.element.parentElement).match(/(\d{1,2})\s*$/);
    return Boolean(dayMatch) && Number(dayMatch[1]) === new Date().getDate();
}

// Returns { PLATE: { plate, vehicleName, make, model, year, prices[],
// bookedDayFlags[], availableToday, availableTomorrow, scannedAt } } for the
// rows currently rendered, or null when this isn't the calendar page / the grid
// isn't ready / the calendar isn't showing today.
function scrapeFleetCalendar() {
    if (!/\/trips\/calendar/i.test(location.pathname)) {
        return { ok: false, reason: "not_calendar_page", vehicles: {} };
    }

    const rows = [...document.querySelectorAll(FLEET_CALENDAR_SELECTORS.vehicleRow)];
    const cells = [...document.querySelectorAll(FLEET_CALENDAR_SELECTORS.dayCell)];
    if (!rows.length || !cells.length) {
        return { ok: false, reason: "grid_not_ready", vehicles: {} };
    }
    if (!fleetCalendarShowsToday()) {
        return { ok: false, reason: "not_showing_today", vehicles: {} };
    }

    const lefts = new Set();
    const tops = new Set();

    const cellInfo = cells.map((cell) => {
        const wrapper = cell.parentElement;
        const left = fleetCalPx(wrapper && wrapper.style.left);
        const top = fleetCalPx(wrapper && wrapper.style.top);
        if (left !== null) lefts.add(left);
        if (top !== null) tops.add(top);

        // A day cell's only visible text is its price (e.g. "$52"); the
        // unavailability-line elements carry no text of their own.
        const priceMatch = fleetCalText(cell).match(/\$([\d,]+)/);
        return {
            left: left,
            top: top,
            booked: Boolean(cell.querySelector(FLEET_CALENDAR_SELECTORS.reservationMarker)),
            price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0
        };
    });

    const sortedLefts = [...lefts].sort((a, b) => a - b);
    const sortedTops = [...tops].sort((a, b) => a - b);
    if (sortedLefts.length < 2) {
        return { ok: false, reason: "too_few_columns", vehicles: {} };
    }

    // Vehicle row order in the frozen name column matches the sorted-top order
    // of its day cells (both lay out top-to-bottom in the same sequence), so the
    // i-th smallest top maps to the i-th listed vehicle.
    const vehicles = {};

    sortedTops.forEach((top, index) => {
        const row = rows[index];
        if (!row) return;

        const spans = row.querySelectorAll("button span");
        const vehicleName = spans[0] ? fleetCalText(spans[0]) : null;
        const rawPlate = spans[1] ? fleetCalText(spans[1]) : null;
        // Keyed by plate so a vehicle is never confused with a same-model
        // sibling — this fleet runs six "Nissan Pathfinder 2024"s. Uppercased to
        // match the casing /api/turo/sync stores plates in.
        if (!rawPlate) return;
        const plate = rawPlate.trim().toUpperCase();
        if (!plate) return;

        const rowCells = cellInfo.filter((cell) => cell.top === top);
        const byColumn = sortedLefts.map((left) => rowCells.find((cell) => cell.left === left) || null);
        const parsedName = splitVehicleName(vehicleName);

        vehicles[plate] = {
            plate: plate,
            vehicleName: vehicleName || null,
            make: parsedName.make,
            model: parsedName.model,
            year: parsedName.year,
            // Index 0 is today, 1 tomorrow, and so on across the visible window.
            // Parallel arrays so a trip's own days can be picked out by offset
            // from today without needing a date on each cell.
            prices: byColumn.map((cell) => (cell ? cell.price : 0)),
            bookedDayFlags: byColumn.map((cell) => Boolean(cell && cell.booked)),
            availableToday: !(byColumn[0] && byColumn[0].booked),
            availableTomorrow: !(byColumn[1] && byColumn[1].booked),
            bookedDays: byColumn.filter((cell) => cell && cell.booked).length,
            // Deliberately NOT surfaced to the user as a forecast window: it's
            // however many columns Turo happened to render (measured at 34, 27
            // and 26 on the same fleet — it moves with window width and zoom).
            visibleDays: byColumn.filter(Boolean).length,
            scannedAt: new Date().toISOString()
        };
    });

    const found = Object.keys(vehicles).length;
    return found
        ? { ok: true, vehicles: vehicles, visible: found }
        : { ok: false, reason: "no_rows_resolved", vehicles: {} };
}
