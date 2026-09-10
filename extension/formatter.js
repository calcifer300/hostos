// formatter.js
// Produces the exact Trello card text Igor expects, from a parsed trip +
// its matched fleet record.
//
// Check-in example:
//   7/2:
//   White Volkswagen Passat 2012
//   6TTN071 1479
//
//   Starting at 10:00 AM
//
//   New photos
//
// Check-out example:
//   7/2:
//   Black Mazda CX-5 2016
//   9SVV537 3579
//
//   Ending at 3:30 PM
//
//   Check out
//   Wash
//   Photos

const MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
];

// Current date in California time, as "M/D" — used for "Today" sections
// and as a fallback when a date can't be parsed.
function getTodayDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "numeric",
        day: "numeric"
    }).formatToParts(new Date());

    const month = parts.find(p => p.type === "month").value;
    const day = parts.find(p => p.type === "day").value;

    return `${month}/${day}`;
}

// Pacific "today" shifted by N days (for "Yesterday" / "Tomorrow" headers),
// formatted as "M/D".
function shiftPacificDate(deltaDays) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(new Date());

    const year = parseInt(parts.find(p => p.type === "year").value, 10);
    const month = parseInt(parts.find(p => p.type === "month").value, 10);
    const day = parseInt(parts.find(p => p.type === "day").value, 10);

    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + deltaDays);

    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// Turns the date section label scraped from the page (e.g. "Today",
// "Thursday, July 2, 2026") into "M/D". This is the ACTUAL date the trip
// is scheduled on — not just "whatever day it is right now."
function resolveDateLabel(dateLabel) {
    if (!dateLabel) return getTodayDate();

    const label = dateLabel.trim();

    if (/^Today$/i.test(label)) return getTodayDate();
    if (/^Yesterday$/i.test(label)) return shiftPacificDate(-1);
    if (/^Tomorrow$/i.test(label)) return shiftPacificDate(1);

    // "Thursday, July 2, 2026"
    const m = label.match(/^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
    if (m) {
        const monthIndex = MONTH_NAMES.indexOf(m[1].toLowerCase());
        if (monthIndex >= 0) {
            return `${monthIndex + 1}/${parseInt(m[2], 10)}`;
        }
    }

    // Unrecognized label format — fall back to today rather than guessing wrong.
    return getTodayDate();
}

// Matches the real Trello card convention used on the board: one single
// line, no line breaks — "7/8: Dark Gray Audi Q5 2014 9MCH670 6790 NO TRIP
// - NEW PHOTOS". A missing lockbox is written literally as "*lockbox code
// TBA*" rather than omitted. The status tag reflects which day(s) are
// actually free, since a car free today but booked from tomorrow noon
// still needs to read differently than one that's wide open.
function formatAvailableCard(vehicle, todayStr) {
    const vehicleLine = `${vehicle.color || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.year || ""}`
        .replace(/\s+/g, " ")
        .trim();

    const lockboxPart = vehicle.lockbox ? vehicle.lockbox : "*lockbox code TBA*";

    let statusTag;
    if (vehicle.availableToday && vehicle.availableTomorrow) {
        statusTag = "NO TRIP - NEW PHOTOS";
    } else if (vehicle.availableToday) {
        statusTag = "NO TRIP TODAY - NEW PHOTOS";
    } else {
        statusTag = "NO TRIP TOMORROW - NEW PHOTOS";
    }

    return `${todayStr}: ${vehicleLine} ${vehicle.plate || ""} ${lockboxPart} ${statusTag}`
        .replace(/\s+/g, " ")
        .trim();
}

// Russian translations for Vlad (the on-the-ground, one-man team) — kept
// in the SAME KNOWN_EXTRAS vocabulary as parser.js/content.js use, so a
// new extra label added there just needs one line added here too, rather
// than a separate list to keep in sync.
const EXTRAS_RU = {
    "child safety seat": "детское автокресло",
    "pet fee": "плата за животное",
    "pet": "животное",
    "additional driver": "дополнительный водитель",
    "unlimited mileage": "безлимитный пробег",
    "unlimited miles": "безлимитный пробег",
    "prepaid refueling": "предоплаченная заправка",
    "prepaid refuel": "предоплаченная заправка",
    "delivery": "доставка",
    "ski rack": "багажник для лыж",
    "bike rack": "багажник для велосипеда",
    "roadside assistance": "помощь на дороге",
    "gps": "GPS-навигатор"
};

function translateExtraLabel(label) {
    return EXTRAS_RU[(label || "").trim().toLowerCase()] || null;
}

// Turns a trip's parsed extras into a single display line, e.g.
// "Extras: Child safety seat, Pet fee" or "Extras: Child safety seat x2".
// When translate is true, each extra gets its Russian translation appended
// in parentheses right after the English label — e.g. "Child safety seat
// (детское автокресло) x2" — so Vlad can read it either way at a glance.
// Returns null if there are no extras to show.
function formatExtrasLine(extras, translate) {
    if (!extras || !extras.length) return null;
    const parts = extras.map(e => {
        const ru = translate ? translateExtraLabel(e.label) : null;
        const label = ru ? `${e.label} (${ru})` : e.label;
        return e.quantity > 1 ? `${label} x${e.quantity}` : label;
    });
    return `Extras: ${parts.join(", ")}`;
}

// One-line summary for the "Extras Requested" section — works whether or
// not the plate matched a known fleet vehicle, and whether the trip is a
// checkin, checkout, or already in progress. Deliberately NOT translated —
// this section is the batch-review list, kept in plain English; the
// Russian translation is only added to the primary check-in/check-out
// cards below, where Vlad is actually reading it on the ground.
function formatExtraSummaryLine(parsed, fleet, dateStr) {
    const vehicleLine = fleet
        ? `${fleet.color || ""} ${fleet.make || ""} ${fleet.model || ""} ${fleet.year || ""}`.replace(/\s+/g, " ").trim()
        : `${parsed.vehicleMake || ""} ${parsed.vehicleModel || ""} ${parsed.vehicleYear || ""}`.replace(/\s+/g, " ").trim() || "Unknown vehicle";

    const plate = parsed.plate || "UNKNOWN";
    const lockbox = fleet && fleet.lockbox ? ` ${fleet.lockbox}` : "";
    const guest = parsed.guest ? `${parsed.guest}${parsed.reservation ? " #" + parsed.reservation : ""}` : "";
    const extrasLine = formatExtrasLine(parsed.extras) || "";

    return [`${dateStr}: ${vehicleLine} ${plate}${lockbox}`, guest, extrasLine].filter(Boolean).join(" \u2014 ");
}

// Parses a 12-hour clock string like "10:00 AM" / "3:30 PM" (as scraped
// from a trip card's "Starting at ..." line) into 24-hour { hour, minute }.
// Returns null if unparseable (e.g. a missing/garbled time), so callers
// can skip rather than guess.
function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;

    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const isPM = /PM/i.test(m[3]);

    if (hour === 12) hour = 0;
    if (isPM) hour += 12;

    return { hour, minute };
}

// Converts a "M/D" dateStr + a "h:mm AM/PM" time into the actual UTC
// timestamp of that moment in Pacific time. A fixed UTC offset would be
// wrong for half the year (PST vs PDT), so this uses Intl to find the real
// Pacific offset in effect at that date rather than hardcoding -7/-8.
// Returns null if the time string can't be parsed.
function pacificDateTimeToTimestamp(dateStr, timeStr, year) {
    const time = parseTimeString(timeStr);
    if (!time) return null;

    const dateParts = (dateStr || "").split("/");
    const month = parseInt(dateParts[0], 10);
    const day = parseInt(dateParts[1], 10);
    if (!month || !day) return null;

    // Treat the wall-clock numbers as if they were UTC, then measure how
    // far Pacific time actually is from UTC at that moment and correct.
    const guessUtc = Date.UTC(year, month - 1, day, time.hour, time.minute);

    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });

    const formatted = dtf.formatToParts(new Date(guessUtc)).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    const asUtc = Date.UTC(
        parseInt(formatted.year, 10),
        parseInt(formatted.month, 10) - 1,
        parseInt(formatted.day, 10),
        parseInt(formatted.hour, 10),
        parseInt(formatted.minute, 10),
        parseInt(formatted.second, 10)
    );

    const offset = asUtc - guessUtc;
    return guessUtc - offset;
}

// Compacts a "10:00 AM" / "3:30 PM" time string into "10AM" / "3:30PM" —
// no colon for on-the-hour times, no space before AM/PM, always uppercase.
// Used for the terse single-line Priority Turnaround cards so the field
// crew can read a time at a glance instead of parsing "HH:MM AM/PM".
function compactTimeLabel(timeStr) {
    const time = parseTimeString(timeStr);
    if (!time) return (timeStr || "?").replace(/\s+/g, "").toUpperCase();

    let hour = time.hour % 12;
    if (hour === 0) hour = 12;
    const isPM = time.hour >= 12;
    const minutePart = time.minute === 0 ? "" : `:${String(time.minute).padStart(2, "0")}`;
    return `${hour}${minutePart}${isPM ? "PM" : "AM"}`;
}

const TURNAROUND_WEEKDAY_NAMES = [
    "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"
];

function turnaroundDateKeyToTimestamp(mD, year) {
    const parts = (mD || "").split("/");
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    return Date.UTC(year, month - 1, day);
}

// Turns the relationship between the checkout date and the next check-in
// date into the short label the field crew needs: "TODAY" for a same-day
// turnaround, "TOMORROW/<WEEKDAY>" for the very common next-day case, or
// "<WEEKDAY> M/D" for anything further out — so it's always unambiguous
// which day the next guest actually arrives.
function resolveTurnaroundDayLabel(endDateStr, startDateStr, year) {
    if (endDateStr === startDateStr) return "TODAY";

    const endTs = turnaroundDateKeyToTimestamp(endDateStr, year);
    const startTs = turnaroundDateKeyToTimestamp(startDateStr, year);
    const oneDayMs = 24 * 60 * 60 * 1000;

    const weekday = TURNAROUND_WEEKDAY_NAMES[new Date(startTs).getUTCDay()];

    if (startTs - endTs === oneDayMs) {
        return `TOMORROW/${weekday}`;
    }
    return `${weekday} ${startDateStr}`;
}

// Single-line "Priority Turnaround" card: a vehicle still sitting in
// checkout/wash/photos that already has another guest booked to pick it
// up soon. Kept as one plain, literal line - no jargon, no extra
// punctuation beyond what's shown - so it reads clearly at a glance.
// House format:
//   7/20: Black FIAT 500 2017 8XZL251 5248 ENDS 11PM NEXT TRIP: 7/21
//   STARTS 8:30AM - CHECK-OUT > WASH > NEW PHOTOS
// The leading date is always the CHECKOUT day (when Vlad needs to have
// wash+photos done), never the next guest's day - those are two
// different dates and conflating them is what caused cards to show the
// wrong day. "NEXT TRIP: <date>" spells out the next check-in's actual
// date explicitly, replacing the old TODAY/TOMORROW/WEEKDAY guess-work.
// nextTripExtras (optional) are the INCOMING guest's requested extras
// (child seat, etc.) — worth knowing on this card specifically, since
// it's the handoff moment where that prep actually needs to happen.
function formatPriorityTurnaroundCard(vehicle, endDateStr, endTime, startDateStr, startTime, year, nextTripExtras) {
    const vehicleLine = `${vehicle.color || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.year || ""}`
        .replace(/\s+/g, " ")
        .trim();

    const lockboxPart = vehicle.lockbox ? vehicle.lockbox : "*lockbox code TBA*";
    const endLabel = endTime ? compactTimeLabel(endTime) : "?";
    const startLabel = startTime ? compactTimeLabel(startTime) : "?";
    const nextTripDate = startDateStr || endDateStr;

    const base = `${endDateStr}: ${vehicleLine} ${vehicle.plate || ""} ${lockboxPart} ENDS ${endLabel} NEXT TRIP: ${nextTripDate} STARTS ${startLabel} - CHECK-OUT > WASH > NEW PHOTOS`
        .replace(/\s+/g, " ")
        .trim();

    const extrasLine = formatExtrasLine(nextTripExtras, true);
    return extrasLine ? `${base} \u2014 ${extrasLine}` : base;
}

// One-line message reminding a guest their license isn't confirmed yet,
// sent when their check-in is coming up within 24 hours and Turo still
// shows "Awaiting license" on the reservation.
function buildLicenseReminderMessage(guestName) {
    const name = (guestName || "").trim() || "there";
    return `Hi ${name}, your trip is coming up soon! We noticed your driver's license hasn't been confirmed yet on Turo — could you please submit it as soon as you can so we can finish verifying you ahead of pickup? Thank you!`;
}

// One-line-per-thought message asking a guest which of our 2 forward-
// facing / 1 rear-facing car seats they need, sent when their trip has a
// requested "Child safety seat" extra.
function buildChildSeatMessage(guestName) {
    const name = (guestName || "").trim() || "there";
    return `Hi ${name}, thanks for booking with us! I see you requested a child safety seat — we have 2 forward-facing seats and 1 rear-facing seat available. Which one do you need for your trip?`;
}

function formatCard(trip, fleet, dateStr) {
    dateStr = dateStr || getTodayDate();
    const extrasLine = formatExtrasLine(trip.extras, true);

    if (!fleet) {
        // Unmatched plate — flag it instead of guessing.
        const actionText = trip.action === "checkin" ? "Starting" : (trip.action === "checkout" ? "Ending" : "Unknown action");
        return [
            `⚠️ ${dateStr}: Unrecognized plate "${trip.plate || "UNKNOWN"}"`,
            `${actionText}${trip.time ? " at " + trip.time : ""}`,
            trip.guest ? `Guest: ${trip.guest}${trip.reservation ? " #" + trip.reservation : ""}` : "",
            extrasLine || "",
            "Needs manual lookup — not in fleet database."
        ].filter(Boolean).join("\n");
    }

    const vehicleLine = `${fleet.color} ${fleet.make} ${fleet.model} ${fleet.year}`.trim();
    const plateLockbox = `${trip.plate}${fleet.lockbox ? " " + fleet.lockbox : ""}`.trim();

    const lines = [`${dateStr}:`, vehicleLine, plateLockbox, ""];

    if (trip.action === "checkin") {
        lines.push(`Starting at ${trip.time || "?"}`);
        if (extrasLine) lines.push(extrasLine);
        lines.push("", "New photos");
    } else if (trip.action === "checkout") {
        lines.push(`Ending at ${trip.time || "?"}`);
        if (extrasLine) lines.push(extrasLine);
        lines.push("", "Check out", "Wash", "Photos");
    } else {
        lines.push("Unrecognized action — check original card.");
    }

    return lines.join("\n");
}
