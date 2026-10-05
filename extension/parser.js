// parser.js
// Turns raw lines scraped from a Turo trip card into structured data.
//
// Input example:
// [
//   "Starting at 10:00 AM",
//   "(Gregory's vehicle)",
//   "Volkswagen Passat 2012",
//   "SFO – San Francisco, CA",
//   "Seth #58646405",
//   "6TTN071"
// ]
//
// Output:
// {
//   action: "checkin" | "checkout" | "skip" | null,
//   skipReason: "In progress" | null,   // set when action === "skip"
//   time: "10:00 AM" | null,
//   guest: "Seth" | null,
//   reservation: "58646405" | null,
//   plate: "6TTN071" | null,
//   vehicleMake: "Volkswagen" | null,   // best-effort, used to prefill "Add to Fleet"
//   vehicleModel: "Passat" | null,
//   vehicleYear: "2012" | null,
//   extras: [{ label: "Child safety seat", quantity: 1 }]  // requested add-ons, if any
// }
//
// Turo status lines we know about:
//   "Starting at 10:00 AM"  -> upcoming pickup today          -> checkin
//   "Ending at 3:30 PM"     -> upcoming dropoff today          -> checkout
//   "Ended at 10:00 AM"     -> trip already ended today, still needs
//                              checkout/wash/photos             -> checkout
//   "Started at 9:00 AM"    -> already checked in, nothing to do -> skip
//   "In progress"           -> ongoing trip, not actionable today -> skip
//   "Upcoming" / "Completed" / "Canceled" / "Cancelled" -> not actionable -> skip
//
// Extras: on the trips LIST view, a requested extra renders as its own
// short chip-line (e.g. "Child safety seat") right below the guest line —
// no quantity shown there (quantity only appears on the individual trip's
// detail page, which isn't scraped). If Turo ever renders a quantity
// suffix inline (e.g. "Child safety seat x2"), that's captured too.

const SKIP_STATUS_PATTERN = /^(In progress|Upcoming|Completed|Cancell?ed)$/i;

// Known Turo extras as they render as standalone chip text on the trips
// list. Add more labels here as you spot new ones on the board.
const KNOWN_EXTRAS = [
    "Child safety seat",
    "Pet fee",
    "Pet",
    "Additional driver",
    "Unlimited mileage",
    "Unlimited miles",
    "Prepaid refueling",
    "Prepaid refuel",
    "Delivery",
    "Ski rack",
    "Bike rack",
    "Roadside assistance",
    "GPS"
];

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches a single line against the known extras list. Returns
// { label, quantity } (quantity defaults to 1 when not shown) or null.
function matchExtraLine(line) {
    const trimmed = line.trim();
    for (let i = 0; i < KNOWN_EXTRAS.length; i++) {
        const label = KNOWN_EXTRAS[i];
        const re = new RegExp("^" + escapeRegExp(label) + "(?:\\s*x\\s*(\\d+))?$", "i");
        const m = trimmed.match(re);
        if (m) {
            return { label: label, quantity: m[1] ? parseInt(m[1], 10) : 1 };
        }
    }
    return null;
}

function parseTripLines(lines) {
    const result = {
        action: null,
        skipReason: null,
        time: null,
        guest: null,
        reservation: null,
        plate: null,
        vehicleMake: null,
        vehicleModel: null,
        vehicleYear: null,
        extras: []
    };

    if (!Array.isArray(lines)) {
        return result;
    }

    lines.forEach(rawLine => {
        const line = rawLine.trim();

        // Action + time  ("Starting at 10:00 AM" / "Ending at 3:30 PM" /
        // "Ended at 10:00 AM" / "Started at 9:00 AM")
        const actionMatch = line.match(/^(Starting|Ending|Ended|Started)\s+at\s+(.+)$/i);
        if (actionMatch) {
            const verb = actionMatch[1].toLowerCase();
            result.time = actionMatch[2].trim();

            if (verb === "starting") {
                result.action = "checkin";
            } else if (verb === "ending" || verb === "ended") {
                // Both "about to end" and "already ended" still need the
                // checkout/wash/photos card today.
                result.action = "checkout";
            } else if (verb === "started") {
                // Already checked in — nothing actionable right now.
                result.action = "skip";
                result.skipReason = actionMatch[0];
            }
            return;
        }

        // Status lines with no time attached ("In progress", "Upcoming", etc.)
        if (SKIP_STATUS_PATTERN.test(line)) {
            result.action = "skip";
            result.skipReason = line;
            return;
        }

        // Guest name + reservation number  ("Seth #58646405")
        const guestMatch = line.match(/^([A-Za-z.'\- ]+?)\s*#(\d+)/);
        if (guestMatch) {
            result.guest = guestMatch[1].trim();
            result.reservation = guestMatch[2].trim();
            return;
        }

        // Vehicle name line, e.g. "Volkswagen Passat 2012" — no "#", doesn't
        // start with a digit (rules out street addresses like
        // "160 Produce Avenue..."), ends in a plausible model year.
        const vehicleMatch = line.match(/^([A-Za-z][A-Za-z0-9\-'.]*)\s+(.+?)\s+((?:19|20)\d{2})$/);
        if (vehicleMatch && !result.vehicleYear) {
            result.vehicleMake = vehicleMatch[1].trim();
            result.vehicleModel = vehicleMatch[2].trim();
            result.vehicleYear = vehicleMatch[3].trim();
            return;
        }

        // Requested extra chip ("Child safety seat", "Pet fee", etc.)
        const extraMatch = matchExtraLine(line);
        if (extraMatch) {
            result.extras.push(extraMatch);
            return;
        }

        // Plate: all-caps alphanumeric, 5-8 chars, contains both a letter and a digit,
        // no spaces, and not a word like "SFO" (must have a digit).
        const compact = line.replace(/\s+/g, "");
        const looksLikePlate =
            /^[A-Z0-9]{5,8}$/.test(compact) &&
            /[A-Z]/.test(compact) &&
            /[0-9]/.test(compact);

        if (looksLikePlate && !result.plate) {
            result.plate = compact.toUpperCase();
        }
    });

    return result;
}
