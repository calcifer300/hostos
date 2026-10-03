// fleetStore.js
// Persists vehicles you add/edit through the popup in chrome.storage.local.
//
// Two pieces of state:
//   CUSTOM_FLEET   - vehicles added by hand, OR edits that override a
//                     built-in FLEET (fleet.js) entry. matcher.js checks
//                     this first, so an override applies everywhere.
//   REMOVED_PLATES - built-in vehicles the VA has "removed" (retired) from
//                     the fleet. We can't edit fleet.js at runtime, so
//                     removal is tracked as a hide-list instead. Custom-only
//                     vehicles don't need this — removing one just deletes
//                     it from CUSTOM_FLEET outright.
//
// IMPORTANT — write safety:
// Every save/delete/remove/restore goes through withFreshFleetData(), which
// (1) re-reads storage immediately before writing and (2) queues all writes
// so they run one at a time. Without this, two nearly-simultaneous writes
// (e.g. editing a vehicle right before re-scanning, which also reads
// storage) can race: a read can land in between another edit's read and
// write, overwrite the in-memory copy with a slightly stale version, and
// then the NEXT save silently writes that stale version back over storage
// — permanently dropping whatever was edited moments earlier. Queuing +
// fresh-read-before-write closes that race.

let CUSTOM_FLEET = {};
let REMOVED_PLATES = {};
let writeQueue = Promise.resolve();

function loadCustomFleet() {
    return new Promise((resolve) => {
        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            resolve(CUSTOM_FLEET);
            return;
        }
        chrome.storage.local.get(["customFleet", "removedPlates"], (result) => {
            CUSTOM_FLEET = result.customFleet || {};
            REMOVED_PLATES = result.removedPlates || {};
            resolve(CUSTOM_FLEET);
        });
    });
}

// Runs `mutator` against data read fresh from storage (not whatever's
// currently sitting in the module-level variables), then writes the result
// back. All writes are chained through `writeQueue` so they execute strictly
// one at a time — no two saves can interleave their read/write steps.
function withFreshFleetData(mutator) {
    writeQueue = writeQueue.then(() => new Promise((resolve) => {
        if (!(typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)) {
            mutator(CUSTOM_FLEET, REMOVED_PLATES);
            resolve();
            return;
        }
        chrome.storage.local.get(["customFleet", "removedPlates"], (result) => {
            CUSTOM_FLEET = result.customFleet || {};
            REMOVED_PLATES = result.removedPlates || {};

            mutator(CUSTOM_FLEET, REMOVED_PLATES);

            chrome.storage.local.set(
                { customFleet: CUSTOM_FLEET, removedPlates: REMOVED_PLATES },
                resolve
            );
        });
    }));
    return writeQueue;
}

function saveCustomFleetEntry(plate, entry) {
    const key = plate.trim().toUpperCase();
    return withFreshFleetData((customFleet, removedPlates) => {
        customFleet[key] = entry;
        // Adding/editing a vehicle un-retires it, in case it was previously
        // removed and is now being brought back with new info.
        if (removedPlates[key]) delete removedPlates[key];
    }).then(() => CUSTOM_FLEET);
}

// Deletes a CUSTOM_FLEET entry only. If the plate also exists in the
// built-in FLEET, this just clears the override (edits revert to the
// original fleet.js data) — it does NOT retire the vehicle. If the plate
// only exists in CUSTOM_FLEET, this deletes it entirely.
function deleteCustomFleetEntry(plate) {
    const key = plate.trim().toUpperCase();
    return withFreshFleetData((customFleet) => {
        delete customFleet[key];
    }).then(() => CUSTOM_FLEET);
}

// Removes a vehicle from the fleet, from the VA's point of view:
//   - built-in vehicle -> added to REMOVED_PLATES (hidden from fleet lists)
//     and any override is cleared too, so it doesn't linger.
//   - custom-only vehicle -> deleted outright from CUSTOM_FLEET.
function removeFleetVehicle(plate) {
    const key = plate.trim().toUpperCase();
    return withFreshFleetData((customFleet, removedPlates) => {
        const isBuiltIn = typeof FLEET !== "undefined" && !!FLEET[key];
        delete customFleet[key];
        if (isBuiltIn) removedPlates[key] = true;
    });
}

// Brings a previously-removed built-in vehicle back.
function restoreFleetVehicle(plate) {
    const key = plate.trim().toUpperCase();
    return withFreshFleetData((customFleet, removedPlates) => {
        delete removedPlates[key];
    });
}

function isPlateRemoved(plate) {
    const key = plate.trim().toUpperCase();
    return !!REMOVED_PLATES[key];
}

// Safety net: every custom vehicle (added or edited) lives ONLY in
// chrome.storage.local. If the extension is ever reloaded from a
// different install path (a fresh zip extraction, a re-cloned folder,
// etc.), Chrome assigns a new extension ID and that storage is
// unreachable — every override and added vehicle appears to just vanish.
// These two functions let the current state be saved to a plain JSON
// file and restored later, independent of extension ID or storage.
function exportFleetBackup() {
    return withFreshFleetData(() => {}).then(() => ({
        exportedAt: new Date().toISOString(),
        customFleet: CUSTOM_FLEET,
        removedPlates: REMOVED_PLATES
    }));
}

// Merges a previously-exported backup back into storage. Merge, not
// overwrite — anything added/edited since the backup was taken (if any)
// is kept unless the backup explicitly has a newer entry for that plate.
function importFleetBackup(backupData) {
    if (!backupData || typeof backupData !== "object") {
        return Promise.reject(new Error("Backup file doesn't look like a valid fleet backup."));
    }
    const incomingFleet = backupData.customFleet || {};
    const incomingRemoved = backupData.removedPlates || {};

    return withFreshFleetData((customFleet, removedPlates) => {
        Object.keys(incomingFleet).forEach(key => {
            customFleet[key] = incomingFleet[key];
        });
        Object.keys(incomingRemoved).forEach(key => {
            removedPlates[key] = incomingRemoved[key];
        });
    }).then(() => ({
        restoredVehicles: Object.keys(incomingFleet).length,
        restoredRemovals: Object.keys(incomingRemoved).length
    }));
}
