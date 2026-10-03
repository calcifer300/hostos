// tripWatch.js
// Detects when a trip's date, time, or action (checkin/checkout/skip) has
// changed since the last time this trip was scanned — e.g. a guest pushes
// their pickup back an hour, or Turo shifts a checkout to a different day.
// This is the actual cause of most "nothing happened but everything's
// wrong now" surprises: a card gets made once and nobody notices the
// underlying reservation moved.
//
// Keyed by reservation number, since that's the one thing that stays
// stable across a trip's lifetime even when its date/time/plate change.
// Trips with no readable reservation # can't be tracked this way — they're
// silently skipped rather than guessed at.

let LAST_TRIP_SNAPSHOT = {};

function loadTripSnapshot() {
    return new Promise((resolve) => {
        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve(LAST_TRIP_SNAPSHOT);
            return;
        }
        chrome.storage.local.get(["tripSnapshot"], (result) => {
            LAST_TRIP_SNAPSHOT = result.tripSnapshot || {};
            resolve(LAST_TRIP_SNAPSHOT);
        });
    });
}

function saveTripSnapshot(snapshot) {
    return new Promise((resolve) => {
        LAST_TRIP_SNAPSHOT = snapshot;
        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve();
            return;
        }
        chrome.storage.local.set({ tripSnapshot: snapshot }, resolve);
    });
}

// Only "checkin" and "checkout" entries have their date/time pinned to
// their own card (a literal "Starting at"/"Ending at" line). "skip"
// entries with reason Upcoming/Completed/Cancelled often don't sit under
// their own date header on Turo's page — they inherit whatever header was
// last seen above them in the DOM (see content.js) — so their dateStr
// can legitimately read differently scan to scan without the underlying
// reservation having changed at all. Started/In progress skip entries are
// the exception: those genuinely belong to "right now."
function hasReliableDate(entry) {
    if (entry.action === "checkin" || entry.action === "checkout") return true;
    if (entry.action === "skip" && /^(Started|In progress)/i.test(entry.skipReason || "")) return true;
    return false;
}

function isCancelled(entry) {
    return entry.action === "skip" && /^Cancell?ed/i.test(entry.skipReason || "");
}

// trackedEntries: [{ reservation, guest, plate, dateStr, time, action, skipReason }]
// — built fresh from the current scan (see generator.js). Compares each
// against LAST_TRIP_SNAPSHOT (loaded via loadTripSnapshot() before this
// runs) and returns which ones changed, plus the snapshot that should be
// saved after this scan via saveTripSnapshot().
//
// A trip seen for the first time (no prior entry) is NOT reported as a
// change — there's nothing to compare against yet, and everything would
// falsely show as "changed" on the very first scan after install/update.
//
// Only two kinds of change get surfaced as alerts:
//   1. A reschedule: both the prior AND current record have a reliable
//      date (see hasReliableDate) and the date/time/plate differ.
//   2. A cancellation: the trip is now Cancelled, regardless of what it
//      was before.
// Everything else (a trip naturally progressing from checkin -> "Started",
// or an Upcoming/Completed entry whose inherited date wobbled) updates the
// snapshot silently so it doesn't cry wolf on things that aren't real
// operational changes.
function detectTripChanges(trackedEntries) {
    const changes = [];
    const newSnapshot = {};

    (trackedEntries || []).forEach(e => {
        if (!e.reservation) return;

        const prior = LAST_TRIP_SNAPSHOT[e.reservation];
        const reliableNow = hasReliableDate(e);

        // Don't let an unreliable-date entry (Upcoming/Completed) stomp a
        // previously-recorded reliable date — keep the last trustworthy
        // value in the snapshot until we see this reservation again with
        // its own real date line.
        if (reliableNow) {
            newSnapshot[e.reservation] = {
                dateStr: e.dateStr, time: e.time, action: e.action,
                skipReason: e.skipReason, plate: e.plate, reliable: true
            };
        } else if (prior) {
            newSnapshot[e.reservation] = prior;
        } else {
            newSnapshot[e.reservation] = {
                dateStr: e.dateStr, time: e.time, action: e.action,
                skipReason: e.skipReason, plate: e.plate, reliable: false
            };
        }

        if (!prior) return;

        if (isCancelled(e) && !isCancelled(prior)) {
            changes.push({
                reservation: e.reservation, guest: e.guest, plate: e.plate,
                before: prior, after: { dateStr: e.dateStr, time: e.time, action: e.action },
                dateChanged: false, timeChanged: false, actionChanged: true, plateChanged: false,
                cancelled: true
            });
            return;
        }

        if (!reliableNow || !prior.reliable) return; // can't trust a comparison either side

        const dateChanged = prior.dateStr !== e.dateStr;
        const timeChanged = prior.time !== e.time;
        const plateChanged = !!prior.plate && !!e.plate && prior.plate !== e.plate;

        if (dateChanged || timeChanged || plateChanged) {
            changes.push({
                reservation: e.reservation, guest: e.guest, plate: e.plate,
                before: prior, after: { dateStr: e.dateStr, time: e.time, action: e.action, plate: e.plate },
                dateChanged, timeChanged, actionChanged: false, plateChanged
            });
        }
    });

    return { changes, newSnapshot };
}

const ACTION_LABELS = { checkin: "Check-in", checkout: "Check-out", skip: "In progress/other" };

// Plain-language summary of what changed, e.g.
// "Check-out moved 7/19 6:30 PM → 7/20 9:00 AM"
function describeTripChange(change) {
    if (change.cancelled) {
        return `Trip was CANCELLED (was ${ACTION_LABELS[change.before.action] || change.before.action}, ${change.before.dateStr || "?"} ${change.before.time || ""})`.trim();
    }
    const parts = [];
    if (change.actionChanged) {
        parts.push(`${ACTION_LABELS[change.before.action] || change.before.action || "?"} → ${ACTION_LABELS[change.after.action] || change.after.action || "?"}`);
    }
    if (change.dateChanged || change.timeChanged) {
        const beforeLabel = `${change.before.dateStr || "?"} ${change.before.time || ""}`.trim();
        const afterLabel = `${change.after.dateStr || "?"} ${change.after.time || ""}`.trim();
        parts.push(`${beforeLabel} \u2192 ${afterLabel}`);
    }
    if (change.plateChanged) {
        parts.push(`Vehicle ${change.before.plate} \u2192 ${change.after.plate}`);
    }
    return parts.join(" \u2014 ") || "Details changed";
}
