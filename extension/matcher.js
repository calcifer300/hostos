// matcher.js
// Looks up a plate number: user-added vehicles (CUSTOM_FLEET, from
// fleetStore.js) take priority, falling back to the built-in FLEET database
// (fleet.js). Plate is always the primary key, since make/model repeat
// across the fleet.

function matchFleet(plate) {
    if (!plate) return null;
    const key = plate.trim().toUpperCase();

    if (typeof CUSTOM_FLEET !== "undefined" && CUSTOM_FLEET[key]) {
        return CUSTOM_FLEET[key];
    }
    return FLEET[key] || null;
}

// Returns every known vehicle (built-in FLEET + any user-added CUSTOM_FLEET
// entries, which take priority), EXCLUDING anything the VA has removed/
// retired. Used by availability.js so retired vehicles never show as idle,
// and by the Fleet manager's default view.
function getAllFleetEntries() {
    const merged = Object.assign({}, FLEET);

    if (typeof CUSTOM_FLEET !== "undefined") {
        Object.keys(CUSTOM_FLEET).forEach(key => {
            merged[key] = CUSTOM_FLEET[key];
        });
    }

    return Object.keys(merged)
        .filter(plate => typeof isPlateRemoved !== "function" || !isPlateRemoved(plate))
        .map(plate => Object.assign({ plate }, merged[plate]));
}

// Same as getAllFleetEntries but includes retired vehicles too, each
// annotated with `removed: true`. Used by the Fleet manager view so a
// retired vehicle can still be found and restored.
function getAllFleetEntriesIncludingRemoved() {
    const merged = Object.assign({}, FLEET);

    if (typeof CUSTOM_FLEET !== "undefined") {
        Object.keys(CUSTOM_FLEET).forEach(key => {
            merged[key] = CUSTOM_FLEET[key];
        });
    }

    return Object.keys(merged).map(plate => {
        const removed = typeof isPlateRemoved === "function" && isPlateRemoved(plate);
        return Object.assign({ plate, removed: !!removed }, merged[plate]);
    });
}

// Fleet-manager badge info for a plate: whether it's built-in (from
// fleet.js), has a custom override/addition, or both.
function getFleetSourceInfo(plate) {
    const key = plate.trim().toUpperCase();
    const isBuiltIn = typeof FLEET !== "undefined" && !!FLEET[key];
    const isCustom = typeof CUSTOM_FLEET !== "undefined" && !!CUSTOM_FLEET[key];
    return { isBuiltIn, isCustom };
}
