window.HostOS = window.HostOS || {};

// Keep selector changes isolated here as Turo's markup evolves.
// The data-testid values below were confirmed against a live Booked list
// page and a live reservation detail page (2026-08-24). Turo's "css-xxxxx"
// hash classes were NOT relied on anywhere here because they regenerate on
// every deploy; only real data-testid attributes and stable text patterns
// (e.g. "Ended at 7:00 AM", "Total Miles Included") are used.
HostOS.selectors = {
  tripCards: [
    "a[data-testid='baseTripCard']",
    "[data-testid='tripsList'] a[data-testid='baseTripCard']",
    "a[href*='/reservation/']"
  ],
  tripLinks: "a[data-testid='baseTripCard'], a[href*='/reservation/']",
  scheduleDates: "[data-testid='schedule-date']",
  scheduleTimes: "[data-testid='schedule-time']",
  licenseStatus: "[data-testid='driversLicenseVerificationStatusDescription']",
  mileageOverage: "[data-testid='distanceIncluded-overageMessage']",
  messageBubbles: "[data-testid='message-bubble']",
  messageSentMarker: "[data-testid='message-is-sent']",
  detailsSectionLabel: ".detailsSection-label",
  // The reservation page's title. Reads the guest's name on a live trip and
  // "Cancelled trip" once it is cancelled - the only place the page says so
  // that cannot also appear in a guest's message.
  pageHeadings: "h1, h2, [role='heading']",
  detailsSectionDescription: ".detailsSection-description",
  // Guest-purchased extras on a reservation. These are real semantic class
  // names, not Turo's "css-xxxxx" hashes, and one ".extraDetails" block
  // repeats per extra. Confirmed live on 2026-08-25 against reservations
  // 60634202 ("Prepaid EV recharge", $55/trip) and 60451879 ("Booster seat",
  // $15/trip, Quantity: 1). Turo prints the billing unit as its own element
  // ("$55" then "/trip"), so per-trip and per-day extras are distinguishable
  // rather than having to be assumed.
  extraDetails: ".extraDetails",
  extraDetailsPrice: ".extraDetails-details",
  extraDetailsQuantity: ".extraDetails-availability",
  // Fleet calendar (turo.com/us/en/trips/calendar) — confirmed against a
  // live capture on 2026-08-24. "reservation0" is the literal test-id Turo
  // uses for a guest-booking bar on a day cell; "custom0"/"custom1" were
  // NOT used for availability since they co-occur with custom-price cells
  // on every day for a vehicle, which isn't consistent with day-specific
  // unavailability.
  fleetVehicleRow: "[data-testid='sticky-column-row']",
  fleetDayCell: "[data-testid='fleet-calendar-day']",
  fleetReservationMarker: "[data-testid='calendar-day-unavailability-reservation0']"
};
