// messageLog.js
// Tracks which reservation numbers have already been sent a child-seat
// message, so scanning trips again later (or tomorrow, if the trip's
// still upcoming) never messages the same guest twice.

let MESSAGED_RESERVATIONS = {};
// Separate log for license-verification reminders — kept apart from the
// child-seat log (above) since a reservation might be eligible for one,
// both, or neither, and they shouldn't suppress each other.
let MESSAGED_LICENSE_REMINDERS = {};

function loadMessageLog() {
    return new Promise((resolve) => {
        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve(MESSAGED_RESERVATIONS);
            return;
        }
        chrome.storage.local.get(["messagedReservations", "messagedLicenseReminders"], (result) => {
            MESSAGED_RESERVATIONS = result.messagedReservations || {};
            MESSAGED_LICENSE_REMINDERS = result.messagedLicenseReminders || {};
            resolve(MESSAGED_RESERVATIONS);
        });
    });
}

function isReservationMessaged(reservation) {
    if (!reservation) return false;
    return !!MESSAGED_RESERVATIONS[reservation];
}

function markReservationMessaged(reservation) {
    return new Promise((resolve) => {
        if (!reservation) {
            resolve();
            return;
        }
        MESSAGED_RESERVATIONS[reservation] = Date.now();

        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve();
            return;
        }
        chrome.storage.local.set({ messagedReservations: MESSAGED_RESERVATIONS }, resolve);
    });
}

function isLicenseReminderSent(reservation) {
    if (!reservation) return false;
    return !!MESSAGED_LICENSE_REMINDERS[reservation];
}

function markLicenseReminderSent(reservation) {
    return new Promise((resolve) => {
        if (!reservation) {
            resolve();
            return;
        }
        MESSAGED_LICENSE_REMINDERS[reservation] = Date.now();

        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve();
            return;
        }
        chrome.storage.local.set({ messagedLicenseReminders: MESSAGED_LICENSE_REMINDERS }, resolve);
    });
}
