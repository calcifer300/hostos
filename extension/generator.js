// generator.js
// Orchestrates the pipeline: raw scraped trips -> parsed -> matched -> formatted
// -> grouped into check-ins / check-outs / skipped / needs-review.
//
// Each trip carries its own dateLabel (scraped from the "Today" /
// "Thursday, July 2, 2026" section header it sits under on the page), so
// every card gets the date it's ACTUALLY scheduled for — not just today.

function generateCards(rawTrips) {
    const checkins = [];
    const checkouts = [];
    const skipped = [];   // "In progress", "Started at", etc. — not actionable today, not an error
    const unmatched = []; // genuine problems: unrecognized plate or unrecognized status line

    // Every trip that had a requested extra (child seat, pet fee, etc.),
    // regardless of whether the trip itself is a checkin, checkout, or
    // already in progress. Kept separate from checkins/checkouts/skipped so
    // an in-progress trip with a child seat request doesn't get buried in
    // the collapsed "Not actionable today" list.
    const extrasRequested = [];

    // Flat list of every trip card that had a readable plate, regardless of
    // action type. Feeds availability.js so "In progress" / "Started" trips
    // (previously just set aside as skipped) still count as booking a
    // vehicle out — otherwise a mid-trip car would wrongly show as idle.
    const events = [];

    // Upcoming check-ins whose actual pickup moment (date + time, in
    // Pacific) falls within the next 24 hours — regardless of whether
    // Turo's own date-section label says "Today" or "Tomorrow", since a
    // 6 AM tomorrow pickup can already be inside the 24-hour window. Used
    // to prompt a driver's-license verification reminder before pickup.
    const upcomingForLicenseCheck = [];
    const licenseCheckYear = getPacificYear();
    const licenseCheckNow = Date.now();
    const LICENSE_CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

    (rawTrips || []).forEach(trip => {
        const parsed = parseTripLines(trip.lines);
        const dateStr = resolveDateLabel(trip.dateLabel);
        const fleet = matchFleet(parsed.plate);

        if (parsed.plate) {
            events.push({
                plate: parsed.plate.trim().toUpperCase(),
                dateStr,
                action: parsed.action,
                skipReason: parsed.skipReason
            });
        }

        if (parsed.action === "checkin" && parsed.reservation) {
            const startTs = pacificDateTimeToTimestamp(dateStr, parsed.time, licenseCheckYear);
            if (startTs !== null) {
                const msUntilStart = startTs - licenseCheckNow;
                if (msUntilStart >= 0 && msUntilStart <= LICENSE_CHECK_WINDOW_MS) {
                    upcomingForLicenseCheck.push({
                        id: trip.id,
                        dateStr,
                        parsed,
                        fleet,
                        startTs,
                        rawLines: trip.lines
                    });
                }
            }
        }

        if (parsed.extras && parsed.extras.length > 0) {
            // Only meaningful for upcoming check-ins — a checkout/skip entry
            // is already mid-trip or done, so there's no "starts at" moment
            // left to guard against.
            const extraStartTs = parsed.action === "checkin"
                ? pacificDateTimeToTimestamp(dateStr, parsed.time, licenseCheckYear)
                : null;

            extrasRequested.push({
                id: trip.id,
                dateStr,
                action: parsed.action,
                parsed,
                fleet,
                startTs: extraStartTs,
                rawLines: trip.lines
            });
        }

        // Not actionable today (already checked in, still in progress, etc.)
        // — set aside quietly, don't treat as an error needing review.
        if (parsed.action === "skip") {
            skipped.push({
                id: trip.id,
                parsed,
                rawLines: trip.lines
            });
            return;
        }

        const cardText = formatCard(parsed, fleet, dateStr);

        const entry = {
            id: trip.id,
            dateStr,
            parsed,
            fleet,
            cardText,
            rawLines: trip.lines
        };

        if (!fleet || !parsed.action) {
            unmatched.push(entry);
        } else if (parsed.action === "checkin") {
            checkins.push(entry);
        } else if (parsed.action === "checkout") {
            checkouts.push(entry);
        } else {
            unmatched.push(entry);
        }
    });

    // ---- Priority Turnaround: same vehicle, ending today and picking up
    // another guest afterward -------------------------------------------
    // Thumb-of-rule: a vehicle whose next guest is arriving soon, but
    // hasn't been washed/photographed yet, is the actual emergency. That's
    // a single situation — one vehicle, one handoff — so it should render
    // as exactly ONE card, not as a separate checkout card in column one
    // AND a separate checkin card in column two describing the same
    // vehicle. Whenever a checkout's plate has a later checkin for that
    // same plate, both entries are pulled out of the plain lists and
    // replaced with a single merged card here instead. Entirely computed
    // from this same Turo scan — no Trello board data involved.
    const now = Date.now();
    const usedCheckinIds = new Set();
    const priorityTurnarounds = [];

    checkouts.forEach(co => {
        const plate = co.parsed && co.parsed.plate;
        if (!plate) return;
        const coTs = pacificDateTimeToTimestamp(co.dateStr, co.parsed.time, licenseCheckYear);
        if (coTs === null) return;

        // Among this plate's check-ins: the earliest one that starts on or
        // after this checkout ends, and isn't already claimed by another
        // pairing (guards the rare case of more than one upcoming checkin
        // for the same plate — only the very next one pairs with THIS
        // checkout).
        const candidates = checkins
            .filter(ci => ci.parsed && ci.parsed.plate === plate && !usedCheckinIds.has(ci.id))
            .map(ci => ({ ci, ts: pacificDateTimeToTimestamp(ci.dateStr, ci.parsed.time, licenseCheckYear) }))
            .filter(c => c.ts !== null && c.ts >= coTs)
            .sort((a, b) => a.ts - b.ts);

        if (candidates.length === 0) return;

        const { ci, ts } = candidates[0];
        usedCheckinIds.add(ci.id);
        co._paired = true;
        ci._paired = true;

        // Only remainingCheckouts/remainingCheckins get ownTs assigned below,
        // and a paired entry is in neither list. Both timestamps are already
        // computed right here, so stamp them on the entries — without this a
        // turnaround trip reaches HostOS with startTs/endTs null and has to be
        // re-derived server-side from its dateLabel + time strings.
        co.ownTs = coTs;
        ci.ownTs = ts;

        const vehicle = Object.assign({ plate: plate }, co.fleet || {});
        const cardText = typeof formatPriorityTurnaroundCard === "function"
            ? formatPriorityTurnaroundCard(vehicle, co.dateStr, co.parsed.time, ci.dateStr, ci.parsed.time, licenseCheckYear, ci.parsed.extras)
            : null;

        priorityTurnarounds.push({
            plate: plate,
            fleet: co.fleet,
            checkoutEntry: co,
            checkinEntry: ci,
            endDateStr: co.dateStr,
            endTime: co.parsed.time,
            startDateStr: ci.dateStr,
            startTime: ci.parsed.time,
            nextTripTs: ts,
            cardText: cardText
        });
    });

    // Closest next trip first — the most time-critical handoff belongs at
    // the top of the list.
    priorityTurnarounds.sort((a, b) => a.nextTripTs - b.nextTripTs);

    // Each paired entry now exists as exactly one Priority Turnaround card
    // — remove it from the plain checkout/checkin lists so it doesn't also
    // render there.
    const remainingCheckouts = checkouts.filter(e => !e._paired);
    const remainingCheckins = checkins.filter(e => !e._paired);

    // Whatever's left just sorts by its own date/time, soonest first — no
    // turnaround urgency left to weigh since those cases were already
    // pulled into priorityTurnarounds above.
    remainingCheckouts.forEach(entry => {
        entry.ownTs = pacificDateTimeToTimestamp(entry.dateStr, entry.parsed.time, licenseCheckYear);
    });
    remainingCheckouts.sort((a, b) => {
        const at = a.ownTs === null ? Infinity : a.ownTs;
        const bt = b.ownTs === null ? Infinity : b.ownTs;
        return at - bt;
    });

    remainingCheckins.forEach(entry => {
        entry.ownTs = pacificDateTimeToTimestamp(entry.dateStr, entry.parsed.time, licenseCheckYear);
    });
    remainingCheckins.sort((a, b) => {
        const at = a.ownTs === null ? Infinity : a.ownTs;
        const bt = b.ownTs === null ? Infinity : b.ownTs;
        return at - bt;
    });

    const todayStr = getTodayDate();
    const tomorrowStr = shiftPacificDate(1);
    const fleetEntries = getAllFleetEntries();
    const available = computeAvailability(fleetEntries, events, todayStr, tomorrowStr);

    return {
        todayStr, tomorrowStr,
        checkins: remainingCheckins,
        checkouts: remainingCheckouts,
        priorityTurnarounds,
        skipped, unmatched, available, extrasRequested, upcomingForLicenseCheck
    };
}
