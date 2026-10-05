// HostOS regression suite.  Run:  node tests/run.js
//
// Every case here corresponds to a bug that actually shipped and was found
// through live testing — the file is a record of them as much as a check.
// PROJECT_STATUS.md explains the reasoning behind each; the short labels here
// are meant to make a failure obvious without reading that first.
const fs = require("fs");
const path = require("path");
const h = require("./harness");

const MODULES = [
  "utils/constants.js",
  "utils/dates.js",
  "utils/parser.js",
  "utils/reviews.js",
  "utils/outlook.js",
  "modules/licenseMonitor.js",
  "modules/riskEngine.js",
  "modules/queueView.js"
];

const HostOS = h.loadModules(MODULES);
const { dates: D, riskEngine, queueView: qv } = HostOS;
const day = h.dayOffset;
const hoursAgo = h.hoursAgo;
const sw = h.readSource("background/service-worker.js");

// A vehicle with a full calendar window, solid-booked, $40/night.
const FLEET = { vehicles: { EWLW91: {
  vehicle: "Tesla Model 3 2025", plate: "EWLW91",
  prices: Array(26).fill(40), bookedDayFlags: Array(26).fill(true),
  bookedDays: 26, totalDays: 26
} } };

// A card fixture that genuinely fails the $0.20 test. Shapes and field names
// are Brent's (reservation 60634202); earningsPerMile is deliberately thin so
// it lands in the Profit Risk queue. His REAL figure is $0.35/mile and is
// asserted separately below — flagging that trip was the bug Matt reported.
const brent = riskEngine.enrich({
  reservationId: "60634202", guestName: "Brent", plate: "EWLW91",
  pickupDate: day(2, 16), returnDate: day(5, 19),
  estimatedMiles: 800, includedMiles: 800, pricePerMile: 0.19,
  earningsPerMile: 0.14, estimatedEarnings: 112, earningsExtras: 55, earningsDelivery: 0,
  earningsInputsKnown: true, // every input read from Turo - a real figure, not a floor
  hostTakeRate: 0.9, lengthDiscountPercent: 3, deliveryFee: 0,
  extras: [{ name: "Prepaid EV recharge", price: 55, unit: "trip", quantity: 1 }],
  protectionLevel: "DECLINED", protectionPlanName: "Not protected", guestMaxOutOfPocket: null
});

// ---------------------------------------------------------------------------
h.suite("a trip URL must be the trip page, not whatever /reservation/ link matched");
const urlSrc = h.readSource("content/scanner.js");
// The link selector is a[href*="/reservation/"], which also matches the
// activity feed's /reservation/{id}/receipt link. A co-host cannot open a
// receipt at all ("Error loading receipt"), so that URL was stored as the trip
// URL and the background scanner opened it forever. The id is authoritative,
// so the canonical URL is rebuilt from it.
h.ok("the trip URL is rebuilt from the reservation id, not taken from the anchor",
  urlSrc.includes("tripUrl: canonicalTripUrl(id, url)"));
h.notOk("no raw anchor href is stored as a trip URL any more",
  urlSrc.includes("tripUrl: url,"));
h.ok("it points at the reservation page itself",
  urlSrc.includes(String.fromCharCode(34) + "https://turo.com/us/en/reservation/" + String.fromCharCode(34) + " + id"));
// A non-numeric id means no reservation URL was found at all, and the raw
// value is all there is - better than nothing, and it cannot be a receipt.
h.ok("a card with no numeric id keeps whatever it had",
  urlSrc.includes("? " + String.fromCharCode(34) + "https://turo.com/us/en/reservation/"));
// Counting failures is what stops any future unopenable page looping.
h.ok("a scan that never renders is counted", urlSrc.includes("detailScanFailures"));
h.ok("and the count resets the moment a scan succeeds",
  urlSrc.includes("detailTrip.detailScanComplete === false"));

// Fixing the scanner stops NEW bad URLs being written, but a record stored
// earlier keeps its old value until a list scan re-reads that card - and a
// trip found through the activity feed may have no Booked card at all, so it
// would never be repaired. This is the defence at the point of use.
(function () {
  eval(h.extractFunction(sw, "backgroundScanUrl"));
  const opened = (url) => backgroundScanUrl(url);
  h.is("a stored receipt URL is never opened as one",
    opened("https://turo.com/us/en/reservation/56608637/receipt?source=activity_feed"),
    "https://turo.com/us/en/reservation/56608637?hostos_bg=1");
  h.is("any other sub-page is rebuilt the same way",
    opened("https://turo.com/us/en/reservation/60557889/messages"),
    "https://turo.com/us/en/reservation/60557889?hostos_bg=1");
  // A detail scan reading its own address used to store hostos_bg=1, which
  // then got a second one appended on the next pass.
  h.is("and the marker is never doubled up",
    opened("https://turo.com/us/en/reservation/56608637?hostos_bg=1"),
    "https://turo.com/us/en/reservation/56608637?hostos_bg=1");
  h.is("a canonical URL is left as it is",
    opened("https://turo.com/us/en/reservation/56608637"),
    "https://turo.com/us/en/reservation/56608637?hostos_bg=1");
  // No reservation id in the path means there is nothing to rebuild from.
  h.is("anything else is passed through untouched",
    opened("https://turo.com/us/en/trips/booked"),
    "https://turo.com/us/en/trips/booked?hostos_bg=1");
})();
// And storage is repaired on the next list scan, so the card links correctly too.
h.ok("saved trips have their URLs rewritten as well",
  urlSrc.includes("canonical === trip.tripUrl ? trip : { ...trip, tripUrl: canonical }"));

h.suite("dates — Turo lists each trip twice, so tripStatus lies");
h.ok("an upcoming trip stored as 'ending' still counts as booked",
  D.hasNotStarted({ pickupDate: day(2), returnDate: day(9), tripStatus: "ending" }));
h.ok("a trip on rent with no pickup date is active",
  D.isActive({ pickupDate: null, returnDate: day(1), tripStatus: "ending" }));
h.notOk("a finished trip is not active", D.isActive({ pickupDate: day(-9), returnDate: day(-1) }));
h.is("new Date(null) never reads as 1970", D.parseTime(null), null);
// Turo bills a partial day as a FULL day. Reservation 60634202 ran 3 days
// 3 hours and the receipt Matt sent charges "4 days @ $40.00/day"; that same
// trip is allowed 800 miles at the listing rate of 200 miles/day, which says
// 4 independently. Rounding to nearest gave 3, understating the trip by a
// whole night ($251.78 instead of $283.21, 11% low) - and understating
// earnings is exactly what pushes a healthy trip under the $0.20/mile line.
h.is("a part day is billed as a whole day, the way Turo bills it",
  D.tripDayCount({ pickupDate: day(0, 16), returnDate: day(3, 19) }), 4);
h.is("an exact multiple is not pushed up past itself",
  D.tripDayCount({ pickupDate: day(0, 16), returnDate: day(3, 16) }), 3);
h.is("a trip shorter than a day still bills one",
  D.tripDayCount({ pickupDate: day(0, 9), returnDate: day(0, 17) }), 1);
// A trip running across the end of DST gains a real hour of elapsed time,
// which must not turn an exact 3-day booking into a 4-day charge. Only
// meaningful where the runner clock actually shifts, so it checks first.
const dstFrom = "2026-10-30T16:00:00";
const dstTo = "2026-11-02T16:00:00";
if (new Date(dstFrom).getTimezoneOffset() !== new Date(dstTo).getTimezoneOffset()) {
  h.is("an exact 3-day trip across the DST change is still 3 days",
    D.tripDayCount({ pickupDate: dstFrom, returnDate: dstTo }), 3);
}
h.ok("hasReturned is true once the return time passes", D.hasReturned({ returnDate: day(-1) }));

// ---------------------------------------------------------------------------
h.suite("riskEngine — null coercion and the guest's plan");
h.notOk("an unscanned trip is not a profit risk", riskEngine.enrich({ earningsPerMile: null }).earningsRisk);
h.ok("a thin trip is flagged on EARNINGS per mile, not the overage rate",
  riskEngine.enrich({ earningsPerMile: 0.14, earningsInputsKnown: true }).earningsRisk);
// Reservation 60557889 really earns $0.26/mile and was reported as thin
// because its delivery fee and extras were never read. A floor below the
// line says nothing about where the real figure sits.
h.notOk("a thin-LOOKING trip built on an unread input is not flagged",
  riskEngine.enrich({ earningsPerMile: 0.14, earningsUnknownInputs: ["delivery fee"] }).earningsRisk);
h.notOk("and a trip priced before completeness was tracked is not flagged either",
  riskEngine.enrich({ earningsPerMile: 0.14 }).earningsRisk);
h.notOk("a low overage rate alone no longer flags anything",
  riskEngine.enrich({ pricePerMile: 0.19 }).earningsRisk);
h.notOk("the HOST's own deductible never flags a trip",
  riskEngine.enrich({ hostDamageResponsibility: 0 }).premierProtection);
h.ok("protectionLevel SUPREME is Premier", riskEngine.enrich({ protectionLevel: "SUPREME" }).premierProtection);
h.notOk("protectionLevel PREMIUM is Standard, NOT Premier",
  riskEngine.enrich({ protectionLevel: "PREMIUM", guestMaxOutOfPocket: 500 }).premierProtection);
h.ok("a $0 out-of-pocket flags even under an unknown level name",
  riskEngine.enrich({ protectionLevel: "SOMETHING_NEW", guestMaxOutOfPocket: 0 }).premierProtection);

// ---------------------------------------------------------------------------
h.suite("profit risk card");
const brentCard = h.renderQueue(HostOS, [brent], "earnings", FLEET);
const brentText = brentCard.textContent;
h.includes("earnings are the NET figure, not the gross nightly total", brentText,
  "$112 · 4 days · ~$28/day · after discounts and Turo's cut");
h.includes("extras are itemised so they are visibly counted", brentText,
  "$55 · Prepaid EV recharge ($55/trip)");
h.includes("the per-mile figure names the allowance it divides by", brentText,
  "$0.14/mi earned across 800 mi included");
h.ok("and it reconciles with the earnings row", Math.abs(112 / 800 - 0.14) <= 0.01);
h.includes("the overage rate is shown as information, not the trigger", brentText,
  "$0.19/mi past the allowance");
h.includes("the guest's plan is shown", brentText, "Declined — the guest carries full liability");
// A Profit Risk card used to name only a guest and a date range - nothing to
// search Turo by, nothing to quote to a guest, and no way to tell two trips by
// the same guest apart. The email card carries the same line.
h.includes("the card identifies the reservation", brentText, "#60634202");
h.includes("with the vehicle and plate beside it", brentText, "EWLW91");
// The head already shows the vehicle when there is no guest name, so repeating
// it below would read as a stutter.
const noGuest = h.renderQueue(HostOS, [riskEngine.enrich({ ...brent, guestName: null })],
  "earnings", FLEET).textContent;
h.includes("a card with no guest name still identifies the trip", noGuest, "#60634202");
h.notOk("and does not print the vehicle twice",
  noGuest.split("Tesla Model 3 2025").length - 1 > 1);
h.excludes("included miles x overage rate is never called earnings", brentText, "$152");

h.suite("Premier card — keeps its call to action AND the money");
// Premier bookings are their own queue since 2026-09-12, first and red. The
// card is the same one; only the queue it lives in changed.
const premier = riskEngine.enrich({ ...brent,
  protectionLevel: "SUPREME", protectionPlanName: "Premier", guestMaxOutOfPocket: 0 });
const premierText = h.renderQueue(HostOS, [premier], "premier", FLEET).textContent;
h.is("a Premier trip is in the Premier queue, not Profit Risk",
  [qv.computeGroups([premier]).premier.length, qv.computeGroups([premier]).earnings.length].join("/"), "1/0");
h.includes("the cancel instruction survives", premierText, "Consider canceling before pickup");
h.includes("the earnings estimate is still shown", premierText, "$112 · 4 days");
h.includes("the plan is named", premierText, "Premier · $0 excess");

h.suite("profit risk — a Premier trip written by the background sweep");
// sweepProtection writes plan fields without running riskEngine, so
// earningsRisk stays false and riskReasons stays empty.
const swept = {
  reservationId: "9", pickupDate: day(2, 16), returnDate: day(5, 19), plate: "EWLW91",
  protectionLevel: "SUPREME", protectionPlanName: "Premier", guestMaxOutOfPocket: 0,
  premierProtection: true, earningsRisk: false, riskReasons: []
};
h.is("still reaches the Premier queue", qv.computeGroups([swept]).premier.length, 1);
h.includes("renders without a dangling dash",
  h.renderQueue(HostOS, [swept], "premier", FLEET).textContent, "Consider canceling before pickup");

// ---------------------------------------------------------------------------
h.suite("earnings estimator");
const estimatorText = h.renderQueue(HostOS, [premier], "today", FLEET).textContent;
h.excludes("no bare 'in the next N' — that count is a rendering artifact",
  estimatorText.replace(/in the next \d+ days\./g, ""), "in the next ");
h.excludes("no 'booked X of the next Y'", estimatorText, "of the next 26 days");
h.includes("availability names a real end date", estimatorText, "Booked solid through");

h.suite("earnings estimator — missing-estimate messages name the real blocker");
const endedToday = riskEngine.enrich({ reservationId: "60581227", vehicle: "VW Tiguan 2024",
  plate: "DJIF67", pickupDate: null, returnDate: day(0, 5) });
const djFleet = { vehicles: { DJIF67: { vehicle: "VW Tiguan 2024", plate: "DJIF67",
  prices: Array(26).fill(35), bookedDayFlags: Array(26).fill(true), bookedDays: 26, totalDays: 26 } } };
const endedText = h.renderQueue(HostOS, [endedToday], "today", djFleet).textContent;
h.includes("a trip with no start date says so", endedText,
  "waiting on this trip's start date from a detail scan.");
h.excludes("and does NOT send the host to the Calendar page", endedText,
  "visit the Calendar page to price this vehicle");

// ---------------------------------------------------------------------------
h.suite("card layout — labelled grid, not stacked prose");
h.is("the risk type is a badge, not a sentence", h.textOfClass(brentCard, "hostos-badge"), ["Below $0.20/mi"]);
h.is("the trip window is one line",
  h.textOfClass(brentCard, "hostos-when").length, 1);
h.ok("values are addressable by label", h.textOfClass(brentCard, "hostos-key").length >= 3);
h.ok("Earnings is one of the labels", h.textOfClass(brentCard, "hostos-key").includes("Earnings"));
h.ok("Plan is one of the labels", h.textOfClass(brentCard, "hostos-key").includes("Plan"));
h.is("labels and values stay paired",
  h.textOfClass(brentCard, "hostos-key").length, h.textOfClass(brentCard, "hostos-val").length);
const premierCard = h.renderQueue(HostOS, [premier], "premier", FLEET);
h.is("the Premier badge names the plan", h.textOfClass(premierCard, "hostos-badge"), ["Premier plan"]);
h.is("the cancel instruction is its own note", h.textOfClass(premierCard, "hostos-note").length, 1);
h.ok("and the Plan row no longer repeats the consequence",
  h.textOfClass(premierCard, "hostos-val").some((v) => v === "Premier · $0 excess"));
const licenceCard = h.renderQueue(HostOS,
  [riskEngine.enrich({ ...brent, licenseVerified: false, pickupDate: hoursAgo(-6) })], "license", FLEET);
h.is("the licence badge is amber-worded", h.textOfClass(licenceCard, "hostos-badge"), ["License unverified"]);
h.ok("licence cards carry an Action row", h.textOfClass(licenceCard, "hostos-key").includes("Action"));

// ---------------------------------------------------------------------------
h.suite("money is picked out in colour");
const moneyRed = h.textOfClass(brentCard, "hostos-money-red");
h.ok("profit risk figures are red", moneyRed.length > 0);
h.ok("the earnings total is one of them", moneyRed.includes("$112"));
// The per-mile figure is highlighted because it IS the trigger; the overage
// rate deliberately is not, since it no longer decides anything.
h.ok("the per-mile earnings figure is one of them", moneyRed.includes("$0.14"));
h.notOk("the overage rate is plain text, not a highlighted risk figure",
  moneyRed.includes("$0.19"));
// Due back later today, so the Earnings Estimator actually has something to
// price — a trip returning days from now correctly renders nothing here.
const dueBackToday = riskEngine.enrich({
  reservationId: "60700001", vehicle: "Tesla Model 3 2025", plate: "EWLW91",
  pickupDate: day(-3, 16), returnDate: day(0, 20)
});
const estimatorCard = h.renderQueue(HostOS, [dueBackToday], "today", FLEET);
const moneyGreen = h.textOfClass(estimatorCard, "hostos-money-green");
h.ok("earnings estimator figures are green", moneyGreen.length > 0);
h.is("no green money leaks onto profit risk cards", h.textOfClass(brentCard, "hostos-money-green").length, 0);
h.is("no red money leaks into the estimator", h.textOfClass(estimatorCard, "hostos-money-red").length, 0);

// ---------------------------------------------------------------------------
h.suite("guest track record");
// Johennie / reservation 57760996: 1.0 star over a single trip, joined May
// 2026 — the guest who cost Matt a windshield on a Premier plan.
const badGuest = riskEngine.enrich({ ...brent, reservationId: "57760996", guestName: "Johennie",
  guestRating: 1, guestRatingCount: 1, guestTripCount: 1,
  guestMemberSince: { month: 5, year: 2026 }, guestCheckedAt: new Date().toISOString() });
const badGuestCard = h.renderQueue(HostOS, [badGuest], "earnings", FLEET);
h.includes("the rating is shown", badGuestCard.textContent, "1.0★ from 1 rating");
h.includes("trips as a guest are shown", badGuestCard.textContent, "· 1 trip ·");
h.includes("member-since is shown", badGuestCard.textContent, "joined May 2026");
h.ok("a poor record is highlighted",
  h.textOfClass(badGuestCard, "hostos-money-red").some((text) => text.includes("1.0★")));

const newGuest = riskEngine.enrich({ ...brent, reservationId: "2", guestRating: null,
  guestRatingCount: 0, guestTripCount: 0, guestCheckedAt: new Date().toISOString() });
const newGuestCard = h.renderQueue(HostOS, [newGuest], "earnings", FLEET);
h.includes("an unrated guest says so rather than showing 0 stars",
  newGuestCard.textContent, "No ratings yet");
h.ok("a brand-new guest is highlighted too",
  h.textOfClass(newGuestCard, "hostos-money-red").some((text) => text.includes("No ratings yet")));

const goodGuest = riskEngine.enrich({ ...brent, reservationId: "3", guestRating: 5,
  guestRatingCount: 40, guestTripCount: 42, guestCheckedAt: new Date().toISOString() });
const goodGuestCard = h.renderQueue(HostOS, [goodGuest], "earnings", FLEET);
h.includes("a solid guest is shown plainly", goodGuestCard.textContent, "5.0★ from 40 ratings");
h.ok("and is NOT highlighted as a concern",
  !h.textOfClass(goodGuestCard, "hostos-money-red").some((text) => text.includes("★")));

h.excludes("a trip whose guest was never looked up shows no guest line",
  h.renderQueue(HostOS, [brent], "earnings", FLEET).textContent, "★");

const protectionSrc = h.readSource("content/protectionScanner.js");
h.ok("the guest lookup uses the driver detail endpoint", /\/api\/v2\/driver\/detail\?driverId=/.test(protectionSrc));
h.ok("it is fetched once per trip, not every sweep", /!trip\.guestCheckedAt/.test(protectionSrc));
h.ok("a failed guest lookup never costs us the protection plan",
  /Guest lookup failed/.test(protectionSrc) && protectionSrc.indexOf("Guest lookup failed") > protectionSrc.indexOf("found = { ...found"));
h.ok("the premier email carries the guest record", /guestRecord\(trip\)/.test(sw));

// ---------------------------------------------------------------------------
h.suite("fleet stats");
const stats = qv.computeFleetStats([brent, { pickupDate: null, returnDate: day(1), tripStatus: "ending" }]);
h.is("active and booked are counted from dates", [stats.active, stats.booked], [1, 1]);
h.is("protection coverage counts only cancellable trips",
  [stats.protectionChecked, stats.protectionTotal], [0, 2]);

// ---------------------------------------------------------------------------
h.suite("earnings per mile — the rule Matt actually uses");
// Reservation 60634202, rebuilt from co-host-visible inputs only. Every field
// here has a verified source; see PROJECT_STATUS.md.
const brentPricing = {
  reservationId: "60634202",
  pickupDate: "2026-08-27T16:30:00-06:00",
  returnDate: "2026-08-30T19:30:00-06:00",
  includedMiles: 800,                       // booking.mileageLimit
  cancellationPolicyType: "NON_REFUNDABLE", // reservation detail
  hostTakeRate: 0.9,                        // currentVehicleProtection.hostTakeRate
  lengthDiscountPercent: 3,                 // dateRangeRate.rentalPriceDiscountPercentage
  deliveryFee: 120,                         // vehicleDeliveryLocations[7896174].fee.amount
  extras: [{ name: "Prepaid EV recharge", price: 55, unit: "trip", quantity: 1 }]
};
const receipt = HostOS.earnings.compute(brentPricing, 160);
h.is("trip total matches Matt's receipt", Number(receipt.tripTotal.toFixed(2)), 314.68);
h.is("earnings match Matt's receipt", Number(receipt.earnings.toFixed(2)), 283.21);
h.is("per-mile matches Matt's figure", Number(receipt.perMile.toFixed(2)), 0.35);
h.is("the 3% length discount", Number(receipt.lengthDiscount.toFixed(2)), 4.80);
h.is("the 10% non-refundable discount", Number(receipt.nonRefundableDiscount.toFixed(2)), 15.52);

// The false positive Matt reported: a $0.19 OVERAGE rate on a $0.35/mile trip.
h.notOk("Brent's trip no longer flags",
  riskEngine.enrich({ ...brentPricing, earningsPerMile: receipt.perMile, pricePerMile: 0.19 }).earningsRisk);
h.ok("a genuinely thin trip still flags",
  riskEngine.enrich({ ...brentPricing, earningsPerMile: 0.14, pricePerMile: 0.45, earningsInputsKnown: true }).earningsRisk);
h.is("and the reason is stated in earnings terms",
  riskEngine.enrich({ ...brentPricing, earningsPerMile: 0.14, earningsInputsKnown: true }).riskReasons[0],
  "Earns only $0.14/mile of the allowance (below $0.20)");
h.notOk("a trip whose earnings aren't computed yet is NOT flagged",
  riskEngine.enrich({ ...brentPricing, earningsPerMile: null, pricePerMile: 0.19 }).earningsRisk);
// An unread plan used to mean no estimate at all - the trip vanished from the
// report. It is now priced at Turo's lowest plan as a FLOOR, named as unread,
// and never asserted: it lands in COULD NOT PRICE instead of nowhere.
(function () {
  const unread = HostOS.earnings.compute({ ...brentPricing, hostTakeRate: null }, 160);
  h.is("an unread plan is priced at the 60 floor and named", unread.unknownInputs, ["earnings plan"]);
  h.ok("and the figure is that floor", Math.abs(unread.earnings - ((155.2 * 0.9 + 55) * 0.6 + 120 * 0.6)) < 0.01);
  const enriched = riskEngine.enrich({ ...brentPricing, hostTakeRate: null, earningsPerMile: 0.14, includedMiles: 800,
    earningsInputsKnown: false, earningsUnknownInputs: ["earnings plan"] });
  h.notOk("a floor built on an unread plan is never asserted as below $0.20", enriched.earningsRisk);
  h.ok("it is surfaced as undecided instead", enriched.earningsUndecided === true);
})();

h.suite("the take rate is the reservation's plan, not the vehicle's current one");
// Read live 2026-09-12. Isaiah #60907051: booked under NINETYPLAN_US_2026,
// 6 billed days, 2% length discount, non-refundable, $120 DIA delivery,
// 1,200 miles, no extras. The fleet has since moved to the 70 plan, and
// pricing him at the vehicle's current 0.7 put him in the report at $0.16/mi.
(function () {
  const P = HostOS.parser.planTakeRate;
  h.is("NINETYPLAN reads as 90%", P({ vehicleProtectionLevelDetail: { key: "NINETYPLAN_US_2026" } }), 0.9);
  h.is("SEVENTYPLAN as 70%", P({ vehicleProtectionLevelDetail: { key: "SEVENTYPLAN_US_2026" } }), 0.7);
  h.is("SEVENTYFIVEPLAN is not mistaken for SEVENTY", P({ vehicleProtectionLevelDetail: { key: "SEVENTYFIVEPLAN_US_2026" } }), 0.75);
  h.is("EIGHTYFIVE likewise", P({ vehicleProtectionLevelDetail: { key: "EIGHTYFIVEPLAN_US_2026" } }), 0.85);
  h.is("an unknown key is null, never a guess", P({ vehicleProtectionLevelDetail: { key: "MAXPROTECT_US_2027" } }), null);
  h.is("and so is a payload with no plan", P({}), null);

  const isaiah = { includedMiles: 1200, cancellationPolicyType: "NON_REFUNDABLE", lengthDiscountPercent: 2,
    deliveryFee: 120, deliveryFeeSource: "turo", extras: [], pickupDate: day(0, 12), returnDate: day(5, 15),
    hostTakeRate: 0.9, hostTakeRateSource: "NINETYPLAN_US_2026", deliveryTakeRate: 0.9 };
  const base = 33.18 * 6;
  const right = HostOS.earnings.compute(isaiah, base);
  h.ok("priced on his own 90 plan Isaiah earns about $266", Math.abs(right.earnings - 266.1) < 1);
  h.ok("which is $0.22 a mile - not a profit risk", right.perMile > 0.20);
  const wrong = HostOS.earnings.compute({ ...isaiah, hostTakeRate: 0.7 }, base);
  h.ok("priced on the vehicle's current 70 plan he read $0.19 - the false flag Matt got", wrong.perMile < 0.20);
  h.ok("the plan is named on the figure", right.planKnown === true && right.takeRate === 0.9);

  // Delivery pays at its own rate. On the 70 plan Turo reports
  // hostDeliveryTakeRate 0.9 - Matt's "you get 90 percent of this".
  const seventy = HostOS.earnings.compute({ ...isaiah, hostTakeRate: 0.7, deliveryTakeRate: 0.9 }, base);
  h.ok("on the 70 plan the $120 delivery still pays $108, not $84",
    Math.abs(seventy.earnings - ((base * 0.98 * 0.9) * 0.7 + 108)) < 0.01);
  h.ok("a receipt where both rates were 0.9 still reproduces to the cent",
    Math.abs(HostOS.earnings.compute({ ...brentPricing, deliveryTakeRate: 0.9 }, 160).earnings - 283.21) < 0.01);

  const src = h.readSource("content/protectionScanner.js");
  h.ok("the sweep stores the reservation's plan as the trip's rate", src.includes("found.hostTakeRate = detail.pricing.planTakeRate;"));
  h.ok("and names where it came from", src.includes("found.hostTakeRateSource = detail.pricing.planKey;"));
  h.ok("written before the vehicle-pricing call, so a failed lookup cannot leave the old rate in place",
    src.indexOf("found.hostTakeRate = detail.pricing.planTakeRate;") < src.indexOf("await fetchVehiclePricing("));
  h.ok("the vehicle's current rate is kept only for reference", src.includes("vehicleCurrentTakeRate: pricing.vehicleCurrentTakeRate"));
  h.ok("every stored trip is re-priced", HostOS.constants.EARNINGS_VERSION >= 6);
})();
h.is("unknown mileage leaves perMile null, never zero",
  HostOS.earnings.compute({ ...brentPricing, includedMiles: null }, 160).perMile, null);

h.suite("the receipt chain, driven the way the extension actually drives it");
// The suite above hands compute() a $160 base rental. Nothing checked where
// that $160 comes from - and it comes from baseRentalFor, which multiplies
// the calendar nightly rate by tripDayCount. That day count rounded to
// nearest, so this trip priced as 3 nights instead of the 4 Turo billed, and
// the live pipeline produced $251.78 / $0.31 per mile while the isolated
// test above happily reported $283.21. Same trip, two different answers, and
// only the wrong one ever reached Matt. This drives the whole chain.
const billedTrip = {
  reservationId: "60634202", plate: "EWLW91",
  pickupDate: day(1, 16), returnDate: day(4, 19), // 3 days 3 hours, as Brent ran
  includedMiles: 800, hostTakeRate: 0.9, lengthDiscountPercent: 3,
  cancellationPolicyType: "NON_REFUNDABLE", deliveryFee: 120,
  extras: [{ name: "Prepaid EV recharge", price: 55, unit: "trip", quantity: 1 }]
};
const billedBase = qv.baseRentalFor(billedTrip, FLEET.vehicles.EWLW91);
const billed = HostOS.earnings.compute(billedTrip, billedBase);
const cents = (value) => Math.round(value * 100) / 100;
h.is("the base rental is 4 nights at $40, not 3", cents(billedBase), 160);
h.is("TRIP TOTAL still matches the receipt end to end", cents(billed.tripTotal), 314.68);
h.is("YOU EARNED still matches the receipt end to end", cents(billed.earnings), 283.21);
h.is("and Matt's $0.35/mile falls out of the real pipeline", cents(billed.perMile), 0.35);
h.notOk("so the trip Matt asked about is not a profit risk",
  riskEngine.enrich({ ...billedTrip, earningsPerMile: billed.perMile }).earningsRisk);

h.suite("a fix to the earnings math actually reaches the stored figures");
// earningsPerMile is computed once by the pricing sweep and stored. The panel,
// the notifications, the Premier alert and the 9 PM report all read that one
// stored number - none of them recompute it. Without a version stamp, fixing
// the chain leaves every already-priced trip sitting on its old figure until
// its 6-hour recheck window happens to expire, which can easily be after the
// nightly report has gone out to Matt.
const sweepSrc = h.readSource("content/protectionScanner.js");
h.ok("a trip priced under an older chain is re-checked regardless of age",
  sweepSrc.includes("trip.earningsVersion !== HostOS.constants.EARNINGS_VERSION"));
h.ok("and the sweep stamps the version it priced under",
  sweepSrc.includes("next.earningsVersion = HostOS.constants.EARNINGS_VERSION"));
h.ok("the version is a constant, not a literal buried in the sweep",
  Number.isInteger(HostOS.constants.EARNINGS_VERSION));

h.suite("guest extras, found in the payload the sweep already fetches");
// Extras could only ever be read from the reservation PAGE, which needs a
// background tab and therefore only happens inside the 72-hour detail window.
// Every trip beyond that had its extras counted as ZERO - understating
// earnings and pushing trips toward the $0.20 flag, the same false-positive
// direction Matt has reported twice. The reservation payload is fetched for
// every trip anyway, but its extras field has never been mapped, so nothing
// guesses a name: blocks are found by SHAPE, and one is only trusted after it
// reproduces a page-scraped total exactly.
const extrasBlock = sweepSrc.slice(sweepSrc.indexOf("  const NAME_KEYS"), sweepSrc.indexOf("  // A path is only trusted"));
eval(extrasBlock);

// Turo wraps money as { amount, currencyCode } nearly everywhere.
const payload = {
  reservationId: 60634202,
  vehicle: { make: "Tesla", model: "Model 3", year: 2025 },
  extras: [{ name: "Prepaid EV recharge", price: { amount: 55, currencyCode: "USD" }, quantity: 1, unit: "TRIP" }]
};
const candidates = collectExtraCandidates(payload);
h.is("the extras block is found without naming the field", candidates.length, 1);
h.is("its path is recorded, so it can be proven once and reused", candidates[0].path, "extras");
h.is("money is unwrapped from { amount }", candidates[0].extras[0].price, 55);
h.is("per-trip billing survives", candidates[0].extras[0].unit, "trip");
h.is("and it values exactly as the page scrape did on 60634202",
  qv.extrasValue({ extras: candidates[0].extras }, 4), 55);

// The expensive mistake: a $55/trip extra read as per-day overstates a 10-day
// booking by $495, so only an explicitly daily extra multiplies.
const daily = collectExtraCandidates({ addOns: [{ name: "Ski rack", amount: 20, chargeType: "PER_DAY" }] });
h.is("an explicitly daily extra is marked daily", daily[0].extras[0].unit, "day");
h.is("and only that one multiplies by trip length", qv.extrasValue({ extras: daily[0].extras }, 10), 200);
h.is("a per-trip extra never does", qv.extrasValue({ extras: candidates[0].extras }, 10), 55);

// Anything that is not clearly a purchased extra must not be mistaken for one,
// because a wrong block here invents money on the card that emails Matt.
h.is("a list of plain strings is not an extras block",
  collectExtraCandidates({ tags: ["airport", "ev"] }).length, 0);
h.is("a list with no prices is not an extras block",
  collectExtraCandidates({ photos: [{ name: "front" }, { name: "rear" }] }).length, 0);
h.is("a partially-matching list is rejected whole, not half-read",
  collectExtraCandidates({ mixed: [{ name: "Pet fee", price: 40 }, { url: "x" }] }).length, 0);
h.is("a zero-priced entry does not qualify",
  collectExtraCandidates({ items: [{ name: "Free thing", price: 0 }] }).length, 0);

h.ok("the page scrape stays authoritative wherever it exists",
  sweepSrc.includes("if (Array.isArray(next.extras)) {"));
h.ok("a discovered path is only used after proving itself against that scrape",
  sweepSrc.includes("proveExtrasPath") && sweepSrc.includes("Math.abs(HostOS.queueView.extrasValue"));
h.ok("candidate blocks are kept out of what gets saved onto the trip",
  sweepSrc.includes("candidates.set(trip.reservationId, detail.extrasCandidates)"));
h.ok("proving a path needs the count to agree too, not just the total",
  sweepSrc.includes("option.extras.length === trip.extras.length"));

// extrasSource says where a trip's extras actually came from. The first
// version flipped "api" to "page" on the very next sweep, so JSON-derived
// extras would have been reported as page-verified - hiding the one thing the
// field exists to reveal, on the money path that reaches Matt.
h.notOk("API-sourced extras are never relabelled as page-verified",
  sweepSrc.includes(String.fromCharCode(34) + "api" + String.fromCharCode(34) + " ? " + String.fromCharCode(34) + "page" + String.fromCharCode(34)));
h.ok("the source is labelled once, from whether a detail scan ever ran",
  sweepSrc.includes("next.extrasSource = next.detailScannedAt"));

h.suite("unknown extras are not zero extras");
// An absent list is not an empty one. Counting unknown as $0 is what made a
// trip look thinner than it is.
h.notOk("a trip never scanned for extras is not treated as checked",
  qv.extrasChecked({ reservationId: "1" }));
h.ok("an empty list IS a real answer - extras can be removed from a booking",
  qv.extrasChecked({ extras: [] }));
const uncheckedText = h.renderQueue(HostOS,
  [riskEngine.enrich({ ...brent, extras: undefined, earningsExtras: 0 })], "earnings", FLEET).textContent;
h.includes("and the card says so instead of showing a silent zero",
  uncheckedText, "not read yet");
// Three distinct states, and every one of them says something. An absent row
// proves nothing - it reads exactly like a card whose extras row failed to
// render - so a checked-and-empty trip could not be told from a broken one.
// Itemising extras exists to prove they were accounted for, which needs an
// answer even when the answer is zero. Reservation 56540984 (Anna, VW Atlas)
// is the real case: scanned, genuinely no extras, and the card showed nothing.
const extrasRow = (trip) => h.renderQueue(HostOS, [riskEngine.enrich(trip)], "earnings", FLEET).textContent;
h.includes("a checked trip with none says so instead of rendering nothing",
  extrasRow({ ...brent, extras: [], earningsExtras: 0 }), "None bought");
h.excludes("and does not claim it was never read",
  extrasRow({ ...brent, extras: [], earningsExtras: 0 }), "not read yet");
h.includes("an unread trip still says that instead",
  extrasRow({ ...brent, extras: undefined, earningsExtras: 0 }), "not read yet");
h.excludes("and is never confused with having none",
  extrasRow({ ...brent, extras: undefined, earningsExtras: 0 }), "None bought");
h.includes("a trip with extras shows the money, not a word",
  extrasRow({ ...brent, earningsExtras: 55 }), "$55");
// Delivery answers the same way rather than vanishing at zero.
h.includes("a trip with no delivery fee says None",
  extrasRow({ ...brent, earningsDelivery: 0 }), "None");
h.includes("and one with a fee shows it", extrasRow({ ...brent, earningsDelivery: 120 }), "$120");

h.suite("an unknown delivery fee is not a free delivery");
// The sweep used to fall back to 0 when a delivery reservation location was
// missing from the vehicle fee table - pricing a delivery trip as though
// delivery were free, understating it by the whole fee (~$120 at DIA) and
// pushing a healthy trip under the $0.20 line. A zero must mean "no delivery",
// never "we did not find out".
const deliveryTrip = {
  reservationId: "60640000", plate: "EWLW91",
  pickupDate: day(1, 16), returnDate: day(4, 19),
  includedMiles: 800, hostTakeRate: 0.9, lengthDiscountPercent: 3,
  cancellationPolicyType: "NON_REFUNDABLE", extras: []
};
const feeMissing = HostOS.earnings.compute({ ...deliveryTrip, deliveryLocationId: "7896174", deliveryFee: null }, 160);
const feeKnown = HostOS.earnings.compute({ ...deliveryTrip, deliveryLocationId: "7896174", deliveryFee: 120 }, 160);
const noDelivery = HostOS.earnings.compute({ ...deliveryTrip, deliveryFee: 0 }, 160);
h.notOk("a delivery trip with no fee found is not fully priced", feeMissing.inputsKnown);
h.is("and it names the input it never read", feeMissing.unknownInputs, ["delivery fee"]);
h.ok("a delivery trip whose fee came back IS fully priced", feeKnown.inputsKnown);
h.ok("a trip that is not a delivery is fully priced at $0 - that zero is real",
  noDelivery.inputsKnown);
h.notOk("unknown extras also count as not fully priced",
  HostOS.earnings.compute({ ...deliveryTrip, extras: undefined, deliveryFee: 0 }, 160).inputsKnown);

h.suite("the 9 PM email never states a floor as if it were a total");
// composeDigest prints trip.reasons verbatim, so the caveat has to live in
// the reason string itself - Matt reads the email, not the card. Two earlier
// false alarms are why: a number he cannot trust costs more than no number.
const reasonFor = (extra) => riskEngine.enrich({ ...deliveryTrip, ...extra,
  estimatedEarnings: 112 }).riskReasons[0];
h.is("a fully-priced trip states the figure plainly",
  reasonFor({ earningsPerMile: 0.14, earningsInputsKnown: true, earningsUnknownInputs: [] }),
  "Earns only $0.14/mile of the allowance (below $0.20)");
// $0.10 across 800 miles is $80 short of the line - more than the $55 extra
// could ever close - so the verdict holds even with extras unread, and the
// line says exactly that rather than hedging.
h.includes("an unread input is named, with why it does not change the answer",
  reasonFor({ earningsPerMile: 0.10, earningsUnknownInputs: ["extras"] }),
  "extras not read from Turo, but the shortfall is too large for any extra this fleet sells to close");
h.includes("and both are named when both are missing",
  reasonFor({ earningsPerMile: 0.10, earningsUnknownInputs: ["extras", "delivery fee"] }),
  "extras and delivery fee not read from Turo");
h.ok("the sweep records which inputs it actually read",
  sweepSrc.includes("next.earningsInputsKnown") && sweepSrc.includes("next.earningsUnknownInputs"));
h.notOk("and no longer defaults a missing delivery fee to zero",
  sweepSrc.includes("deliveryFees[detail.pricing.deliveryLocationId] || 0"));

h.suite("reservation 60557889 - the trip Matt corrected a third time");
// Turo states $860.01 across 3,300 included miles = $0.2606/mile. Matt read
// it as ".26 cents a mile" and asked why the automation said less. It was
// missing his $120 delivery fee (the reservation carried no delivery marker,
// so the fee was spent as a known $0) and its extras (the trip starts 6 days
// out, past the 72-hour detail window, so they were never read at all).
h.is("Turo's own figures give Matt's number", Math.round((860.01 / 3300) * 100) / 100, 0.26);
const lian = {
  reservationId: "60557889", guestName: "Lian", vehicle: "Tesla Model 3 2022",
  pickupDate: "2026-09-08T13:00:00", returnDate: "2026-10-08T10:00:00",
  includedMiles: 3300, earningsPerMile: 0.19, estimatedEarnings: 627
};
h.notOk("a floor below the line is no longer asserted as a profit risk",
  riskEngine.enrich({ ...lian, earningsInputsKnown: false,
    earningsUnknownInputs: ["extras", "delivery fee"] }).earningsRisk);
h.is("and it claims no reason it cannot support",
  riskEngine.enrich({ ...lian, earningsInputsKnown: false,
    earningsUnknownInputs: ["extras", "delivery fee"] }).riskReasons, []);
h.ok("the same trip DOES flag once every input has been read",
  riskEngine.enrich({ ...lian, earningsInputsKnown: true }).earningsRisk);
h.ok("the report names what it could not price rather than dropping it",
  sw.includes("COULD NOT PRICE (") && sw.includes("the real figure can only be higher"));
h.ok("the digest reads riskEngine's stored verdict rather than re-deriving it",
  sw.includes("trip.earningsUndecided === true") && !sw.includes("perMile < HostOS.constants"));
h.notOk("no bare 0.20 literal is left in the risk rule",
  h.readSource("modules/riskEngine.js").includes("earningsPerMile < 0.20"));
h.ok("plural inputs read as 'were', not 'was'", sw.includes('missing.length > 1 ? " were" : " was"'));

h.suite("Matt's standing delivery fee");
// Matt sets his own prices: "I charge a $120 delivery fee on every trip."
// That is a stated business fact, so where Turo exposes no fee his figure is
// the authority. It is NOT allowed to look like Turo data, and Turo's real
// per-location fee still wins wherever it can be read.
const withTuroFee = HostOS.earnings.compute({ ...deliveryTrip,
  deliveryLocationId: "7896174", deliveryFee: 120, deliveryFeeSource: "turo" }, 160);
const withStanding = HostOS.earnings.compute({ ...deliveryTrip,
  deliveryFee: 120, deliveryFeeSource: "standing" }, 160);
h.is("a Turo-read fee is labelled as such", withTuroFee.deliverySource, "turo");
h.is("and the standing rate is labelled separately", withStanding.deliverySource, "standing");
h.ok("either way the trip can now be priced at all", withStanding.inputsKnown);
h.is("both produce the same money - only the provenance differs",
  Math.round(withTuroFee.earnings * 100), Math.round(withStanding.earnings * 100));
h.ok("Turo's own per-location fee takes precedence in the sweep",
  sweepSrc.includes("deliveryFee: turoFee !== null ? turoFee : standingDelivery"));
h.ok("and the fee is configurable rather than baked in",
  sweepSrc.includes("hostosPricingConfig") && sweepSrc.includes("standingDeliveryFee"));

// A card must never pass the standing rate off as something read from Turo.
const standingCard = h.renderQueue(HostOS, [riskEngine.enrich({ ...brent,
  earningsDelivery: 120, deliveryFeeSource: "standing" })], "earnings", FLEET).textContent;
h.includes("the card says where the delivery figure came from",
  standingCard, "your standing rate, not read from Turo");
const turoCard = h.renderQueue(HostOS, [riskEngine.enrich({ ...brent,
  earningsDelivery: 120, deliveryFeeSource: "turo" })], "earnings", FLEET).textContent;
h.excludes("and says nothing extra when Turo supplied it",
  turoCard, "your standing rate");

// Blank means "use Matt's rate"; 0 means "he stopped charging it".
const optionsSrc = h.readSource("options/options.js");
h.ok("an empty box falls back to the stated rate, it does not read as zero",
  optionsSrc.includes('feeRaw === "" ? HostOS.constants.STANDING_DELIVERY_FEE'));
h.ok("the options page loads constants before it reads them",
  h.readSource("options/options.html").indexOf("utils/constants.js")
    < h.readSource("options/options.html").indexOf(String.fromCharCode(34) + "options.js"));
h.is("the stated rate is $120", HostOS.constants.STANDING_DELIVERY_FEE, 120);

h.suite("an empty Profit Risk queue must say whether it is really empty");
// The panel showed "Profit Risk 0 trips - No matching reservations right now"
// with no way to tell whether every trip cleared $0.20 or whether they were
// all held back for missing inputs. The email got a COULD NOT PRICE section;
// the sidebar got nothing, so a suppressed queue looked exactly like a clean
// one - the same ambiguity that section exists to remove.
// $0.19 across 3,300 miles is only $33 short of the line, and a $55 extra
// clears that - genuinely undecided, so it is held back rather than asserted.
const heldTrip = riskEngine.enrich({
  reservationId: "60557889", guestName: "Lian", vehicle: "Tesla Model 3 2022",
  pickupDate: day(6, 13), returnDate: day(36, 10), includedMiles: 3300,
  hostTakeRate: 0.9, earningsPerMile: 0.19, earningsInputsKnown: false,
  earningsUnknownInputs: ["extras"]
});
h.ok("a trip an unread extra could rescue is not asserted as a risk", !heldTrip.earningsRisk);

// The rule itself. Requiring every input to be READ before flagging anything
// was too strict - extras are only read inside the 72-hour window, so nothing
// outside it could ever flag and the queue sat empty for two days. Silence is
// its own failure. The real test is not "is everything known" but "could what
// we do not know change the answer": extras only ADD, so a floor below the
// line is decisive whenever the shortfall exceeds the priciest extra sold.
const verdict = (perMile, miles) => riskEngine.enrich({
  pickupDate: day(6, 13), returnDate: day(36, 10),
  includedMiles: miles, hostTakeRate: 0.9, earningsPerMile: perMile,
  earningsInputsKnown: false, earningsUnknownInputs: ["extras"]
});
// Clara: $0.15 across 3,500 miles is $175 short - no $55 extra touches that.
h.ok("a long trip well under the line still flags with extras unread",
  verdict(0.15, 3500).earningsRisk);
// Nicole: $0.19 across 1,500 miles is $15 short - one extra clears it.
h.notOk("a marginal trip an extra could rescue does not",
  verdict(0.19, 1500).earningsRisk);
h.ok("and that one is surfaced as undecided rather than dropped",
  verdict(0.19, 1500).earningsUndecided);
h.notOk("a decisive trip is not also called undecided",
  verdict(0.15, 3500).earningsUndecided);
h.notOk("a trip above the line is neither", verdict(0.31, 3500).earningsRisk);
h.notOk("nor undecided", verdict(0.31, 3500).earningsUndecided);
// The ceiling is the fleet price list, not a guess: $55 at a 0.9 take rate is
// $49.50 of earnings, so $49 of shortfall is rescuable and $50 is not.
h.notOk("just inside what an extra could close", verdict(0.20 - 49 / 1000, 1000).earningsRisk);
h.ok("just outside it", verdict(0.20 - 50 / 1000, 1000).earningsRisk);
h.notOk("with no mileage there is no shortfall to measure, so it is not asserted",
  verdict(0.15, null).earningsRisk);

(function () {
  h.suite("the nightly report as HTML");
  // John asked for the email to read like the Profit Risk card rather than a
  // wall of text. Email HTML is not page HTML - Gmail strips stylesheets and
  // does not do flexbox - so this is tables with inline styles only.
  const COMPANY = "Colorado Cruisers";
  const DIGEST_TIMEZONE = "America/Denver";
  const parseTime = (value) => HostOS.dates.parseTime(value);
  eval(h.extractFunction(sw, "formatTripTime"));
  eval(h.extractFunction(sw, "escapeHtml"));
  eval(h.extractFunction(sw, "reportMoney"));
  eval(h.extractFunction(sw, "reportStrong"));
  eval(h.extractFunction(sw, "htmlRow"));
  eval(h.extractFunction(sw, "htmlTripCard"));
  eval(h.extractFunction(sw, "guestRecord"));
  eval(h.extractFunction(sw, "htmlReviewCard"));
  // Each eval at this level, not in a loop: a function declared inside an
  // arrow's eval is scoped to that arrow.
  eval(h.extractFunction(sw, "htmlTable"));
  eval(h.extractFunction(sw, "shortDate"));
  eval(h.extractFunction(sw, "tripCell"));
  eval(h.extractFunction(sw, "vehicleCell"));
  eval(h.extractFunction(sw, "datesCell"));
  eval(h.extractFunction(sw, "guestCell"));
  eval(h.extractFunction(sw, "planCell"));
  eval(h.extractFunction(sw, "earningsCell"));
  eval(h.extractFunction(sw, "perMileCell"));
  eval(h.extractFunction(sw, "openCell"));
  eval(h.extractFunction(sw, "earningsNote"));
  eval(h.extractFunction(sw, "riskRows"));
  const RISK_COLUMNS = JSON.parse(sw.slice(sw.indexOf("const RISK_COLUMNS = ") + 21, sw.indexOf(";", sw.indexOf("const RISK_COLUMNS = "))));
  eval(h.extractFunction(sw, "htmlSection"));
  eval(h.extractFunction(sw, "reportShell"));
  eval(h.extractFunction(sw, "composePremierHtml"));
  eval(h.extractFunction(sw, "composeTestHtml"));
  eval(h.extractFunction(sw, "composeDigestHtml"));
  const REPORT_AMBER = "#ff9f0a";
  const REPORT_RED = "#ff6b5e";
  const REPORT_WHITE = "#f5f5f7";
  const REPORT_MUTED = "#8e8e93";

  const cardTrip = {
    reservationId: "60557889", guest: "Anna", vehicle: "Tesla Model 3 2022", plate: "EWLW91",
    pickup: day(6, 11), returnDate: day(12, 17), url: "https://turo.com/us/en/reservation/60557889",
    earnings: 289, perDay: 41, days: 7, perMile: 0.14, miles: 2000,
    extras: 0, extrasChecked: false, delivery: 120, deliverySource: "standing",
    plan: "Minimum", planExcess: 3000, guestRating: null, guestRatingCount: 0,
    guestTripCount: 0, reasons: []
  };
  const reportHtml = composeDigestHtml({ date: "9/2/2026", rateRisks: [cardTrip], licenseRisks: [], unpriced: [] });

  h.includes("the guest leads the card", reportHtml, "Anna");
  h.includes("with the badge from the panel", reportHtml, "BELOW $0.20/MI");
  h.includes("earnings, days and per-day read as one line", reportHtml, "7 days");
  h.includes("and say what they are net of", reportHtml, "net");
  h.includes("unread extras are stated, never shown as $0", reportHtml, "extras could not be read from Turo");
  h.includes("the delivery figure says whose it is", reportHtml, "your standing rate, not read from Turo");
  h.includes("per mile names the allowance it divides by", reportHtml, "2,000 mi incl.");
  h.includes("the plan carries its excess", reportHtml, "$3,000");
  h.includes("an unrated guest is called out", reportHtml, "no ratings");
  h.includes("and there is a way back to the trip", reportHtml, "https://turo.com/us/en/reservation/60557889");
  h.includes("the button points at the real reservation", reportHtml, "reservation/60557889");
  // The plain-text report has always carried the reservation number; the card
  // did not. It is what you search Turo by, and the only identifier left if
  // the link is ever missing.
  h.includes("the reservation number is on the card too", reportHtml, "#60557889");
  const noLink = composeDigestHtml({ date: "x", licenseRisks: [], unpriced: [], rateRisks: [{ ...cardTrip, url: null }] });
  h.excludes("no dead button when there is no link", noLink, "Open trip");
  h.includes("but the trip is still identifiable", noLink, "#60557889");

  // Email clients strip stylesheets and do not lay out with flexbox or grid.
  h.excludes("no stylesheet, which Gmail would drop", reportHtml, "<style");
  h.excludes("no flexbox", reportHtml, "display:flex");
  h.excludes("no grid", reportHtml, "display:grid");
  h.ok("laid out with tables, which every client renders alike", reportHtml.includes("<table"));

  // A guest name comes from Turo, not from us, and lands inside markup.
  const injected = composeDigestHtml({ date: "x", licenseRisks: [], unpriced: [],
    rateRisks: [{ ...cardTrip, guest: "<script>x</script>" }] });
  h.includes("guest names are escaped, not injected", injected, "&lt;script&gt;");
  h.excludes("so no raw tag survives", injected, "<script>x");

  // A missing section is ambiguous in a way "none" is not - this is a handover.
  const emptyHtml = composeDigestHtml({ date: "x", rateRisks: [], licenseRisks: [], unpriced: [] });
  h.includes("every section is present even when empty", emptyHtml, "BELOW $0.20/MILE (0)");
  h.includes("including the one that could not be priced", emptyHtml, "COULD NOT PRICE (0)");
  h.includes("and it says none rather than showing nothing", emptyHtml, "none");
  h.includes("Premier is still explained", emptyHtml, "own urgent email");
  h.includes("and the Premier recap section is present even when empty", emptyHtml,
    "PREMIER PLAN, ALREADY ALERTED (0)");
  h.includes("and so is the reviews section", emptyHtml, "REVIEWS WAITING ON YOU (0)");
  const reviewHtml = composeDigestHtml({ date: "x", rateRisks: [], licenseRisks: [], unpriced: [], premier: [],
    reviews: [{ ...cardTrip, guest: "Doug", state: "pending", daysLeft: 8, signals: ["Extra mileage"] },
      { ...cardTrip, reservationId: "2", guest: "Karen", state: "pending", daysLeft: 5, signals: [], ready: true, guestQuote: "5 stars!" }] });
  h.includes("a waiting review shows its window", reviewHtml, "8 days left");
  h.includes("a guest who rated first is badged in the email too", reviewHtml, "Guest rated you");
  h.includes("and what Turo's data says", reviewHtml, "Extra mileage");
  h.includes("and each card opens the trip", reviewHtml, ">Open</a>");

  // The panel mark cannot travel: Gmail strips <svg> from email HTML and
  // strips data: image URIs too, and a chrome-extension:// URL is unreachable
  // from a mail client. The masthead carries the identity in type instead.
  h.includes("the masthead names the fleet", emptyHtml, "COLORADO CRUISERS");
  h.excludes("and nothing else - John asked for the fleet name alone", emptyHtml, "HOSTOS");
  h.includes("the report is the headline, not the product", emptyHtml, "Nightly turnover report");
  h.includes("the date sits under the title rather than inside it", reportHtml, "9/2/2026");
  h.excludes("no svg, which Gmail strips", emptyHtml, "<svg");
  h.excludes("and no data uri, which Gmail also strips", emptyHtml, "data:image");
  h.excludes("nothing points at an unreachable extension url", emptyHtml, "chrome-extension:");

  // The badge rides along as an inline attachment referenced by cid: - the only
  // route that renders, since Gmail strips <svg> and data: URIs from email.
  const withLogo = composeDigestHtml({ date: "x", rateRisks: [], licenseRisks: [], unpriced: [] }, true);
  h.includes("the masthead carries the badge when the relay can attach it", withLogo, "cid:ccLogo");
  h.excludes("and never references one it cannot", emptyHtml, "cid:");
  h.includes("the premier alert can carry it too",
    composePremierHtml({ ...cardTrip, plan: "Premier" }, true), "cid:ccLogo");
  h.includes("and the test alert, which is how you check it renders",
    composeTestHtml(true), "cid:ccLogo");
  // Emitted only against a relay KNOWN to attach it. Unknown means no logo,
  // because a cid: an older relay never attaches is a broken image in the inbox.
  h.ok("the img is gated on the relay version actually reported back",
    sw.includes("relayStatus.deployedVersion >= 5"));
  h.ok("and the bytes are only read when it can be used",
    sw.includes("relayCanAttach ? await readLogoBase64() : null"));
  h.ok("a missing or unreadable logo file falls back rather than breaking",
    sw.includes("logoCache = null;"));
  // The relay only attaches when there is HTML to reference it from.
  h.ok("the relay attaches the blob inline",
    optionsSrc.includes("ccLogo: Utilities.newBlob(Utilities.base64Decode(logo)"));
  // Dropping the blob filename was tried to stop Gmail listing the image as an
  // attachment. Gmail chipped it anyway, labelled "noname" - which reads worse
  // than "logo.png". Gmail attaches inline images regardless of name, so there
  // is no version of cid: that renders without a chip. The name is back, and
  // whether the logo is worth the chip is a setting instead.
  h.ok("the blob keeps a sensible filename, since the chip is unavoidable",
    optionsSrc.includes("image/png" + String.fromCharCode(34) + ", " + String.fromCharCode(34) + "logo.png"));
  h.ok("the logo can be turned off without redeploying anything",
    sw.includes("pricingConfig.reportLogo !== false"));
  h.ok("and the options page offers that switch",
    h.readSource("options/options.html").includes("reportLogo"));
  h.ok("turning it off is reported as its own state, not a failure",
    sw.includes("turned-off"));
  h.ok("it defaults on, since the logo was asked for",
    optionsSrc.includes("hostosPricingConfig.reportLogo !== false"));
  // Undocumented corner, so it must never cost us the alert. On rejection the
  // same message is resent as PLAIN TEXT - not as HTML whose cid: image would
  // now be a broken picture.
  h.ok("a rejected inline image falls back to plain text, not a broken image",
    optionsSrc.includes("catch (inlineErr)")
    && optionsSrc.includes("MailApp.sendEmail({ to: to, subject: subject, body: body });"));
  h.ok("and never silently swallows an unrelated send failure",
    optionsSrc.includes("if (!message.inlineImages) throw inlineErr;"));
  h.ok("and only alongside an html body", optionsSrc.includes("if (html && logo) {"));
  // A missing logo has two completely different causes needing different
  // fixes, and neither is visible from the email itself. Silently omitting it
  // meant the only way to tell them apart was the service worker console.
  h.ok("the reason a logo was skipped is recorded", sw.includes("logoState"));
  h.ok("an old relay is named as the cause", sw.includes("relay-below-v5"));
  h.ok("so is an unreadable asset", sw.includes("asset-unreadable"));
  h.ok("and the options page says which it was",
    optionsSrc.includes("The header logo needs the v")
    && optionsSrc.includes("could not be read from assets/colorado-cruisers.png"));

  // John had to ask which input was missing. The card now says it outright.
  const notReadHtml = composeDigestHtml({ date: "x", rateRisks: [], licenseRisks: [],
    unpriced: [{ ...cardTrip, missing: ["extras"] }] });
  h.includes("the missing input is named, not left to be worked out",
    notReadHtml, "extras could not be read from Turo");
  h.includes("with what that means for the number",
    notReadHtml, "earnings shown are a minimum");
  h.includes("and both are named when both are missing",
    composeDigestHtml({ date: "x", rateRisks: [], licenseRisks: [],
      unpriced: [{ ...cardTrip, missing: ["extras", "delivery fee"] }] }),
    "extras and delivery fee could not be read from Turo");
  h.excludes("a fully-read trip says nothing about missing inputs",
    composeDigestHtml({ date: "x", rateRisks: [{ ...cardTrip, extrasChecked: true, missing: [] }],
      licenseRisks: [], unpriced: [] }), "could not be read from Turo");

  // The Premier alert is the third risk type and the one needing the fastest
  // decision, so it gets the same card rather than a wall of text.
  const premierHtml = composePremierHtml({ ...cardTrip, plan: "Premier", planExcess: 0 });
  h.includes("the premier alert leads with the exposure", premierHtml, "cannot be billed");
  h.includes("and says what to do about it", premierHtml, "Cancel before pickup");
  h.includes("it carries the same card", premierHtml, "PREMIER - $0 EXCESS");
  h.includes("with the trip figures on it", premierHtml, "2,000 mi included");
  h.includes("and a way into the reservation", premierHtml, "Open trip");
  h.excludes("no stylesheet here either", premierHtml, "<style");
  // Both emails share one frame, so they cannot drift apart.
  h.ok("both alerts use the same shell",
    premierHtml.startsWith("<div style=\"margin:0;padding:20px 14px;background:#0e1116;\">")
    && emptyHtml.startsWith("<div style=\"margin:0;padding:20px 14px;background:#0e1116;\">"));
  h.ok("the premier alert still sends plain text too",
    sw.includes("...composePremier(payload.trip), html: composePremierHtml(payload.trip, options.logo)"));

  // The test button proves the delivery path works, so it must exercise the
  // same path a real alert takes. Sending it as plain text meant a correctly
  // deployed relay still produced an unstyled email - indistinguishable from a
  // failed deployment, which is the one thing the button exists to rule out.
  const testHtml = composeTestHtml();
  h.includes("the test alert is html too, so it proves the real path", testHtml, "<table");
  h.includes("and says plainly that nothing is wrong", testHtml, "no action needed");
  h.includes("it explains what plain text would have meant", testHtml, "older version");
  // It goes to the urgent list, which includes Matt - a realistic-looking risk
  // card in a test would be worse than useless.
  h.excludes("no sample trip card in a test", testHtml, "BELOW $0.20/MI");
  h.excludes("and no invented money", testHtml, "/mi earned");

  // The email card answers the same three ways the panel card does.
  const noneHtml = composeDigestHtml({ date: "x", licenseRisks: [], unpriced: [],
    rateRisks: [{ ...cardTrip, extras: 0, extrasChecked: true, missing: [], delivery: 0 }] });
  h.includes("a checked-and-empty trip says none in the email too", noneHtml, "no extras");
  h.excludes("and does not claim it was never read", noneHtml, "not read yet");
  h.includes("no delivery fee answers too rather than vanishing", noneHtml, "no delivery");
  h.ok("the test still sends plain text as the fallback",
    sw.includes("This is a test from the HostOS extension. Alerts are working."));
  // Every alert shares the shell, so the branding cannot drift between them.
  h.includes("the premier alert carries the same masthead", premierHtml, "COLORADO CRUISERS");
  h.includes("and so does the test alert", testHtml, "COLORADO CRUISERS");
})();
h.is("a trip held back for an unread input is counted", qv.unpriceable([heldTrip]).length, 1);
h.is("a fully-priced trip is not",
  qv.unpriceable([riskEngine.enrich({ ...heldTrip, earningsInputsKnown: true })]).length, 0);
h.is("nor one already above the line - unknowns can only raise it",
  qv.unpriceable([riskEngine.enrich({ ...heldTrip, earningsPerMile: 0.31 })]).length, 0);
h.is("nor a Premier trip, which is flagged on its own signal",
  qv.unpriceable([{ ...heldTrip, premierProtection: true }]).length, 0);
h.is("nor a trip that has already started", qv.unpriceable([{ ...heldTrip,
  pickupDate: day(-2, 13), returnDate: day(10, 10) }]).length, 0);
const heldText = h.renderQueue(HostOS, [heldTrip], "earnings", FLEET).textContent;
h.includes("and the empty queue says so out loud", heldText, "could not be priced");
h.includes("naming how many", heldText, "1 trip");
h.excludes("a genuinely clear queue stays quiet",
  h.renderQueue(HostOS, [riskEngine.enrich({ ...heldTrip, earningsInputsKnown: true, earningsPerMile: 0.31 })],
    "earnings", FLEET).textContent, "could not be priced");

const pricingSrc = h.readSource("content/protectionScanner.js");
h.ok("delivery fee is joined on locationId, not name", /deliveryLocationId/.test(pricingSrc));
h.ok("take rate and discount come from the listing endpoint",
  /hostTakeRate/.test(pricingSrc) && /rentalPriceDiscountPercentage/.test(pricingSrc));
h.ok("a pricing failure never costs us the protection plan",
  /Vehicle pricing lookup failed/.test(pricingSrc));

h.suite("a Premier booking must alert the moment it is found");
// The one alert Matt lost real money by not having. The activity feed exists
// to catch a Premier plan within about a minute of booking, before any card
// has rendered - so a feed record has NO dates. hasNotStarted is deliberately
// false for an unknown pickup, and gating the alert on it silently defeated
// the whole fast path: the alert waited on a detail scan to supply dates.
(function () {
  const parseTime = (value) => HostOS.dates.parseTime(value);
  const hasNotStarted = (trip) => HostOS.dates.hasNotStarted(trip);
  const isCancelled = (trip) => HostOS.dates.isCancelled(trip);
  eval(h.extractFunction(sw, "isUpcomingOrBrandNew"));

  h.ok("a booking found by the feed, with no dates yet, is alertable",
    isUpcomingOrBrandNew({ reservationId: "1", pickupDate: null, returnDate: null, bookedAt: Date.now() - 6e5 }));
  // Reservation 61109808: booked, cancelled by Matt on 9/8, and stood up on
  // 9/10 by a feed event processed late - no dates, so the old rule read it
  // as brand new and emailed URGENT about a trip that did not exist. Twice.
  h.notOk("but a no-dates record whose BOOKING is days old is not brand new",
    isUpcomingOrBrandNew({ pickupDate: null, returnDate: null, bookedAt: Date.now() - 3 * 864e5 }));
  h.notOk("and one with no booking time at all waits for a detail scan",
    isUpcomingOrBrandNew({ pickupDate: null, returnDate: null }));
  h.notOk("a cancelled reservation is never alertable, whatever its dates",
    isUpcomingOrBrandNew({ pickupDate: day(5), returnDate: day(9), cancelled: true }));
  h.notOk("nor as a no-dates record",
    isUpcomingOrBrandNew({ pickupDate: null, returnDate: null, bookedAt: Date.now(), cancelled: true }));
  h.ok("so is an ordinary upcoming trip",
    isUpcomingOrBrandNew({ pickupDate: day(5), returnDate: day(9) }));
  // An active trip DOES yield a returnDate from its "Ending at" card, so it
  // cannot be mistaken for a brand-new booking - it is already on rent and
  // cannot be cancelled, which is the only reason to alert.
  h.notOk("a trip already on rent is not - it has a return date and cannot be cancelled",
    isUpcomingOrBrandNew({ pickupDate: null, returnDate: day(3) }));
  h.notOk("nor one that has finished",
    isUpcomingOrBrandNew({ pickupDate: day(-9), returnDate: day(-2) }));

  // Both surfaces have to use it, or the email and the notification disagree
  // about whether a booking counts.
  // Both surfaces have to use it, or the email and the notification disagree
  // about whether a booking counts.
  h.ok("the Premier email uses it", sw.includes("&& isUpcomingOrBrandNew(trip)"));
  h.ok("and so does the Chrome notification",
    sw.includes("(trip.earningsRisk || isPremier(trip)) && isUpcomingOrBrandNew(trip)"));
  // Nothing about Premier detection may depend on the earnings chain: the
  // sweep writes plan fields without running riskEngine at all.
  h.ok("Premier is detected from the plan alone, never from earningsRisk",
    sw.includes("function isPremier(trip)")
    && sw.includes("return trip.protectionLevel === " + String.fromCharCode(34) + "SUPREME"));
  // Delivery is exercised for real in premierAlertSuite below - asserting on
  // the source text of the dedupe let the send-once property pass while the
  // live code sent two emails.
})();

h.suite("service worker — detail scan eligibility");
const DETAIL_WINDOW_MS = 72 * 3600000;
const DETAIL_SCAN_VERSION = 5;
const MAX_DETAIL_SCAN_FAILURES = 3;
const FLAGGED_RESCAN_MS = 3e5;
const DETAIL_RESCAN_MS = 18e5;
function parseTime(value) { const t = new Date(value).getTime(); return Number.isFinite(t) && t > 0 ? t : null; }
function isWithinLicenseUploadWindow(value) {
  const t = parseTime(value); if (t === null) return false;
  const d = t - Date.now(); return d >= 0 && d <= 864e5;
}
function hasNotStarted(trip) { const p = parseTime(trip.pickupDate); return p !== null && p > Date.now(); }
const isCancelled = (trip) => trip.cancelled === true;
eval(h.extractFunction(sw, "eligibleForDetailScan"));
h.notOk("a cancelled reservation is never opened again - its page cannot change the answer",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: null, returnDate: null, cancelled: true }));
h.ok("a trip picking up tomorrow is eligible even if it returns in two weeks",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(1), returnDate: day(14) }));
h.ok("a feed-discovered trip with no dates is eligible (else it's a dead end)",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: null, returnDate: null }));
h.ok("a trip that ended a few hours ago with no pickup date is eligible",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: null, returnDate: hoursAgo(4) }));
h.notOk("but not once its pickup date is known",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(-4), returnDate: hoursAgo(4) }));
h.notOk("a trip that ended ten days ago is left alone",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: null, returnDate: day(-10) }));
h.notOk("a trip a month out is left alone",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35) }));

// Turo links to a reservation from several places and not all are the trip
// page. The activity feed links to /reservation/{id}/receipt, which a co-host
// cannot open - it renders "Error loading receipt". That URL got stored as a
// trip URL, the scan never rendered, and an incomplete scan bypasses the
// cooldown on purpose - so it was retried on every pass. The queue is
// single-flight, so one unopenable receipt starved every other trip.
const neverRenders = { tripUrl: "x", pickupDate: null, returnDate: null,
  detailScanComplete: false, detailScannedAt: new Date().toISOString(),
  detailScanVersion: DETAIL_SCAN_VERSION };
h.ok("an incomplete scan is still retried straight away at first",
  eligibleForDetailScan({ ...neverRenders, detailScanFailures: 1 }));
h.ok("and again while the failure might still be transient",
  eligibleForDetailScan({ ...neverRenders, detailScanFailures: 2 }));
h.notOk("but a page that has never rendered stops monopolising the queue",
  eligibleForDetailScan({ ...neverRenders, detailScanFailures: 3 }));
// It still retries on the ordinary cadence, so a real outage recovers on its own.
h.ok("it is not abandoned - it waits its turn like everything else",
  eligibleForDetailScan({ ...neverRenders, detailScanFailures: 9,
    detailScannedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() }));
// Extras live ONLY on the reservation page, so a trip we could not price sat
// outside the 72-hour window reading "not read yet" forever - the queue could
// never resolve it either way, which is what John saw. Opening exactly those
// reservations is the one thing that settles them. Deliberately not a general
// widening: that was tried and produced a constant stream of background tabs.
h.ok("a trip we could not price is worth opening however far out it is",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35),
    earningsUndecided: true }));
h.notOk("but a decided trip that far out is still left alone",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35),
    earningsUndecided: false }));
// John: the Profit Risk report has to be complete, so anything on it gets
// scanned however far out it is - a flagged trip is only as good as the extras
// behind it, and those live only on the reservation page.
h.ok("a flagged trip a month out is scanned so the report is complete",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35),
    earningsBelowFloor: true }));
// earningsRisk is the OR of below-$0.20 and the guest's Premier plan, so it
// cannot answer "is this a profit risk". A Premier booking is a PROTECTION
// risk: it is emailed the moment it is booked, from the JSON sweep, and
// opening its page adds nothing - so it does not earn the exemption.
h.notOk("a Premier booking a month out does not earn the exemption",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35),
    earningsRisk: true, premierProtection: true }));
// And only while it can still be cancelled, which is the point of knowing.
h.notOk("an undecided trip already over is not scanned either",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(-40), returnDate: day(-10),
    earningsUndecided: true }));
// A trip already over cannot be cancelled, so the exemption does not apply.
// (A trip currently ON rent stays eligible for a separate, pre-existing
// reason: its extras have never been read and it is one-shot.)
h.notOk("a flagged trip that is already over is not scanned",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(-40), returnDate: day(-10),
    earningsBelowFloor: true }));
// The 5-minute cooldown is about being near pickup, not about being flagged.
// A far-out flagged trip on the 5-minute clock would be a tab every 5 minutes
// forever, which is the activity the window exists to prevent.
const justScanned = { tripUrl: "x", earningsBelowFloor: true,
  detailScannedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  detailScanVersion: DETAIL_SCAN_VERSION };
h.notOk("a far-out flagged trip scanned 10 minutes ago waits the ordinary 30",
  eligibleForDetailScan({ ...justScanned, pickupDate: day(30), returnDate: day(35) }));
h.ok("but one picking up tomorrow still gets the fast 5-minute recheck",
  eligibleForDetailScan({ ...justScanned, pickupDate: day(1), returnDate: day(4) }));
// Self-limiting: the scan fills extras in, the trip stops being undecided, and
// it stops qualifying - so this cannot become a standing re-scan.
h.notOk("and once scanned it drops out again rather than looping",
  eligibleForDetailScan({ tripUrl: "x", pickupDate: day(30), returnDate: day(35),
    earningsUndecided: false, detailScannedAt: new Date().toISOString(),
    detailScanVersion: DETAIL_SCAN_VERSION }));

h.suite("extras are never silently zero");
// Every extra Colorado Cruisers offers is priced per trip: Camp chair $15,
// Stroller $40, Air mattress $40, Prepaid EV recharge $55, Booster seat $20,
// Child safety seat $40-45, Pet fee $40. Prices vary per booking, so they're
// always read from the reservation rather than assumed.
const OFFERED = [
  { name: "Camp chair", price: 15, unit: "trip", quantity: 1 },
  { name: "Stroller", price: 40, unit: "trip", quantity: 1 },
  { name: "Air mattress", price: 40, unit: "trip", quantity: 1 },
  { name: "Prepaid EV recharge", price: 55, unit: "trip", quantity: 1 },
  { name: "Booster seat", price: 20, unit: "trip", quantity: 2 },
  { name: "Child safety seat", price: 45, unit: "trip", quantity: 1 },
  { name: "Pet fee", price: 40, unit: "trip", quantity: 1 }
];
const allExtras = riskEngine.enrich({ ...brent, extras: OFFERED,
  earningsExtras: 275, estimatedEarnings: 355 });
const allExtrasCard = h.renderQueue(HostOS, [allExtras], "earnings", FLEET).textContent;
// 15+40+40+55+(20*2)+45+40 = 275, counted once each because every one is /trip.
// Itemised on its own row now that the net total would otherwise absorb them.
h.includes("all seven are summed, quantity included", allExtrasCard, "$275");
h.ok("and they get their own labelled row",
  h.textOfClass(h.renderQueue(HostOS, [allExtras], "earnings", FLEET), "hostos-key").includes("Extras"));

// Ashley / reservation 59799765 — Child safety seat $45/trip, the case that
// looked missing because the vehicle tile never named it.
const ashleyFleet = { vehicles: { EOIGO6: { vehicle: "Nissan Pathfinder 2024", plate: "EOIGO6",
  prices: Array(26).fill(73), bookedDayFlags: Array(26).fill(true), bookedDays: 26, totalDays: 26 } } };
const ashley = riskEngine.enrich({ reservationId: "59799765", vehicle: "Nissan Pathfinder 2024",
  plate: "EOIGO6", pickupDate: day(-3, 12), returnDate: day(5, 11),
  extras: [{ name: "Child safety seat", price: 45, unit: "trip", quantity: 1 }] });
const ashleyTile = h.renderQueue(HostOS, [ashley], "today", ashleyFleet).textContent;
h.ok("the vehicle tile now has an Extras row",
  h.textOfClass(h.renderQueue(HostOS, [ashley], "today", ashleyFleet), "hostos-key").includes("Extras"));
h.includes("and names the extra", ashleyTile, "Child safety seat ($45/trip)");

h.suite("service worker — alerting");
eval(h.extractFunction(sw, "isPremier"));
const premierGate = (trip) => isPremier(trip) && hasNotStarted(trip);
h.notOk("a finished Premier trip does NOT alert (reservation 57760996)",
  premierGate({ protectionLevel: "SUPREME", pickupDate: day(-18), returnDate: day(-4) }));
h.notOk("a Premier trip with unknown dates does NOT alert",
  premierGate({ protectionLevel: "SUPREME", pickupDate: null, returnDate: null }));
h.notOk("an in-progress Premier trip does NOT alert",
  premierGate({ protectionLevel: "SUPREME", pickupDate: day(-2), returnDate: day(3) }));
h.ok("an upcoming Premier trip DOES alert",
  premierGate({ protectionLevel: "SUPREME", pickupDate: day(2), returnDate: day(5) }));

h.suite("service worker — nightly report timing");
const DIGEST_TIMEZONE = "America/Denver";
eval(h.extractFunction(sw, "coloradoNow"));
const co = coloradoNow();
h.ok("the Colorado date is ISO-shaped", /^\d{4}-\d{2}-\d{2}$/.test(co.date));
h.is("the hour matches America/Denver", co.hour,
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", hour12: false })
    .format(new Date())) % 24);

h.suite("service worker — invariants that have regressed before");
h.ok("the pause gate sits before any tabs.create",
  sw.indexOf("await isPaused()") < sw.indexOf("chrome.tabs.create"));
h.ok("notifications include sweep-written Premier trips", /earningsRisk \|\| isPremier\(trip\)/.test(sw));
h.ok("the digest excludes Premier via isPremier", /!isPremier\(trip\) && hasNotStarted/.test(sw));
h.ok("dedupe maps are pruned", /hostosNotified: prune\(/.test(sw) && /hostosAlerted: prune\(/.test(sw));
h.ok("failed alerts back off instead of retrying every write", /alertBackoffUntil/.test(sw));
h.ok("the alert payload is a superset so an older relay still works",
  sw.includes("{ ...payload, recipients, subject: composed.subject,")
  && sw.includes("body: composed.body, html: composed.html || null, logo }"));
// The plain-text body is still composed and still sent. A relay deployed at v3
// ignores the html field entirely and mails the text, so a deployment that
// never gets updated cannot be broken by this.
h.ok("plain text is still sent alongside the html",
  sw.includes("...composeDigest(payload), html: composeDigestHtml(payload, options.logo)"));

h.suite("background writers must not fake scan freshness");
const storage = h.readSource("utils/storage.js");
h.ok("saveTrips takes a silent option", /saveTrips\(trips, options = \{\}\)/.test(storage));
h.ok("silent skips the last-scan stamp", /if \(!options\.silent\)/.test(storage));
h.ok("the protection sweep uses it", /saveTrips\(merged, \{ silent: true \}\)/.test(h.readSource("content/protectionScanner.js")));
h.ok("the activity feed uses it", /\{ silent: true \}/.test(h.readSource("content/activityScanner.js")));

h.suite("activity feed reads storage late");
const activity = h.readSource("content/activityScanner.js");
// The property, not its old proxy: between reading the trip list and writing
// it back there must be no network call, or the write discards whatever the
// list scanner saved meanwhile. Checked for every read/write pair, since the
// feed now has two (bookings, which look up the plan first; cancellations,
// which need no lookup at all).
(function () {
  const reads = [];
  let at = -1;
  while ((at = activity.indexOf("HostOS.storage.getTrips()", at + 1)) !== -1) reads.push(at);
  h.ok("the feed reads the trip list once per event type", reads.length >= 2);
  const raced = reads.filter((from) => {
    const to = activity.indexOf("saveTrips(", from);
    return to === -1 || /fetch\(|fetchDetail\(/.test(activity.slice(from, to));
  });
  h.is("no read of the trip list has a network call before its write", raced.length, 0);
})();
h.ok("booking events are acted on", /\\bbooked trip\\b/.test(activity));
h.ok("and so are cancellations, which the feed announces outright (61156935)",
  /trip cancel\+ed/.test(activity) && activity.includes('cancelledSignal: "feed: Trip canceled"'));
h.ok("a cancellation never stands up a record of its own",
  activity.includes("if (!existing || HostOS.dates.isCancelled(existing)) return;"));
h.ok("the first run only looks back a day", /FIRST_RUN_LOOKBACK_MS/.test(activity));

h.suite("storage does not grow forever");
const scannerSrc = h.readSource("content/scanner.js");
h.ok("finished trips are pruned", /function pruneFinished/.test(scannerSrc));
h.ok("pruning is applied on save", /pruneFinished\(\[\.\.\.byId\.values\(\)\]\)/.test(scannerSrc));
h.ok("trips with no return date are never dropped", /if \(ret === null\) return true;/.test(scannerSrc));

h.suite("a broken scraper is visible, not silent");
h.ok("scan health is recorded", /hostosScanHealth/.test(scannerSrc));
h.ok("the popup surfaces it", /Turo may have changed its layout/.test(h.readSource("popup/popup.js")));

h.suite("mail quota failures are distinguishable");
const relaySrc = h.readSource("options/options.js");
h.ok("the relay reports remaining quota on failure", /getRemainingDailyQuota/.test(relaySrc));
h.ok("a send failure returns ok:false rather than throwing", /error: "send failed: "/.test(relaySrc));
h.is("relay version matches what the extension expects",
  Number((relaySrc.match(/EXPECTED_SCRIPT_VERSION = (\d+)/) || [])[1]),
  Number((sw.match(/const SCRIPT_VERSION = (\d+)/) || [])[1]));

h.suite("nightly report explains what it does NOT cover");
const DIGEST_TZ = "America/Denver";
const COMPANY_NAME = (sw.match(/const COMPANY = "([^"]+)"/) || [])[1];
(function () {
  const DIGEST_TIMEZONE = DIGEST_TZ;
  const COMPANY = COMPANY_NAME;
  eval(h.extractFunction(sw, "formatTripTime"));
  eval(h.extractFunction(sw, "composeDigest"));
  const report = composeDigest({
    date: "8/25/2026",
    rateRisks: [{ reservationId: "1", guest: "Brent", vehicle: "Tesla",
      pickup: day(2), returnDate: day(5), reasons: ["Only $0.19/mile beyond the included miles (below $0.20)"] }],
    licenseRisks: []
  });
  h.includes("the licences section is still there", report.body,
    "UNVERIFIED LICENSES, PICKUP WITHIN 24H (0)");
  h.includes("it states that a NEW Premier booking is emailed immediately, not held for 9 PM", report.body,
    "gets its own URGENT");
  h.includes("and that the Premier section here is only a recap", report.body,
    "only recaps the ones still on the books");
  h.includes("and what silence means", report.body,
    "No separate email today means no new Premier bookings.");
  h.ok("the note sits at the end, after every section",
    report.body.indexOf("gets its own URGENT") > report.body.indexOf("PREMIER PLAN, ALREADY ALERTED"));
})();

h.suite("the report's own risk sections are checkable without waiting for 9 PM");
// Both sections Matt asked for - trips below $0.20/mile and unverified licenses
// inside 24 hours - exist ONLY in the 9 PM report. Send test alert never touched
// them: it goes to the URGENT list with its own wording, so a report addressed to
// an empty nightly list, or one that threw while composing a card, looked exactly
// like a quiet night. One day per attempt to find out.
(function () {
  const DIGEST_TIMEZONE = DIGEST_TZ;
  const COMPANY = COMPANY_NAME;
  eval(h.extractFunction(sw, "formatTripTime"));
  eval(h.extractFunction(sw, "composeDigest"));
  const payload = { date: "9/10/2026", rateRisks: [], licenseRisks: [], unpriced: [] };
  h.includes("a preview says so in the subject",
    composeDigest({ ...payload, preview: true }).subject, "(PREVIEW)");
  h.excludes("the 9 PM report does not",
    composeDigest(payload).subject, "PREVIEW");
  // The bodies must otherwise be identical, or the preview stops being
  // evidence about the real report.
  h.is("the preview body is the report body, unchanged",
    composeDigest({ ...payload, preview: true }).body, composeDigest(payload).body);
})();

// Gmail renders the HTML, so marking only the plain-text fallback would leave
// the copy Matt actually reads looking like the real 9 PM report.
h.ok("the HTML masthead is marked too", sw.includes("preview, sent on request"));

// A preview must never satisfy the day's report. Only maybeSendDigest writes
// hostosLastDigestDate; wiring the button to it would mean pressing preview at
// 9:30 PM silently cancelled the real one.
(function () {
  const from = sw.indexOf('message.type === "HOSTOS_TEST_DIGEST"');
  const handler = sw.slice(from, sw.indexOf("  }", from));
  h.includes("the preview calls sendDailyDigest", handler, "sendDailyDigest({ force: true })");
  h.excludes("not maybeSendDigest, which is what marks the day done", handler, "maybeSendDigest");
  h.excludes("and nothing in that path writes the digest date", handler, "hostosLastDigestDate");
})();

// The whole point of the preview is that it proves the NIGHTLY list, which the
// test alert cannot: postAlert routes only premier and test to the urgent one.
h.ok("a digest is addressed to the nightly recipients, not the urgent list",
  sw.includes('const urgent = payload.kind === "premier" || payload.kind === "test"'));

// The relay reports which version answered, and a send is the only moment that
// evidence exists. Both buttons used to discard it and write their success
// message OVER the status line load() uses to report a lagging deployment - so
// the "my change didn't apply" failure had its one symptom hidden by the very
// action that revealed it.
(function () {
  const js = h.readSource("options/options.js");
  const EXPECTED_SCRIPT_VERSION = Number((js.match(/EXPECTED_SCRIPT_VERSION = (\d+)/) || [])[1]);
  eval(h.extractFunction(js, "relayNote"));

  h.includes("a lagging deployment is named, with its version",
    relayNote({ deployedVersion: 5 }), "running v5");
  h.includes("and says which step was missed",
    relayNote({ deployedVersion: 5 }), "Version: New version");
  h.includes("a current deployment is confirmed, not left ambiguous",
    relayNote({ deployedVersion: EXPECTED_SCRIPT_VERSION }), "the current version");
  // An older relay answers without a version. Inventing "current" there would
  // be worse than saying nothing.
  h.is("a relay that reports nothing gets no claim either way", relayNote({}), "");
  h.is("and neither does a failed send", relayNote(null), "");

  // Both buttons, or the half you happened not to press stays silent about it.
  const after = (marker) => {
    const from = js.indexOf(marker);
    return from === -1 ? "" : js.slice(from, js.indexOf(");", from));
  };
  h.includes("the test alert reports the version back",
    after('"Test sent to the urgent list'), "relayNote(result)");
  h.includes("and so does the report preview",
    after('"Report preview sent to the nightly list'), "relayNote(result)");
})();

// A button with no listener looks like a working button and does nothing at all.
(function () {
  const html = h.readSource("options/options.html");
  const js = h.readSource("options/options.js");
  const ids = (html.match(/<button id="([^"]+)"/g) || [])
    .map((tag) => tag.match(/id="([^"]+)"/)[1]);
  h.ok("the report preview button exists", ids.includes("testDigest"));
  const dead = ids.filter((id) => !js.includes("$(\"" + id + "\")"));
  h.is("every button on the options page is wired to something", dead, []);
})();

h.suite("a cancelled reservation is not a trip");
// Reservation 61109808: cancelled by Matt on 9/8, emailed URGENT on 9/10 as a
// Premier booking - twice. Nothing in the extension could tell a cancelled
// reservation from a live one: it kept its record, its plan and its dates.
h.notOk("hasNotStarted is false for a cancelled trip, whatever its dates say",
  D.hasNotStarted({ pickupDate: day(5), returnDate: day(9), cancelled: true }));
h.ok("and unchanged for a live one", D.hasNotStarted({ pickupDate: day(5), returnDate: day(9) }));
h.notOk("only an explicit true counts - a scan that could not tell says nothing",
  D.isCancelled({ cancelled: null }) || D.isCancelled({ cancelled: "yes" }) || D.isCancelled({}));

// The panel's queues, which read the same storage the report does.
(function () {
  const live = { reservationId: "1", licenseVerified: false, pickupDate: hoursAgo(-6), returnDate: day(3),
    earningsRisk: true, earningsBelowFloor: true, premierProtection: false };
  const gone = { ...live, reservationId: "2", cancelled: true };
  const groups = qv.computeGroups([live, gone]);
  h.is("a cancelled trip leaves the licence queue", groups.license.map((t) => t.reservationId), ["1"]);
  h.is("and the Profit Risk queue", groups.earnings.map((t) => t.reservationId), ["1"]);
  h.is("and the Premier queue", qv.computeGroups([{ ...live, premierProtection: true }, { ...gone, premierProtection: true }]).premier.map((t) => t.reservationId), ["1"]);
})();

// The reservation API's own marker. Confirmed live 2026-09-10: 61109808 reads
// statusCode "CANCELLED" with cancelledRequest populated; every completed trip
// checked reads "COMPLETED". Pinned to that field - a wrong match is a Premier
// alert that never sends.
(function () {
  const sig = (data) => HostOS.parser.cancellationSignal(data);
  h.is("statusCode CANCELLED is found and named",
    sig({ id: 1, statusCode: "CANCELLED", cancelledRequest: {} }), "statusCode=CANCELLED");
  h.is("so is the American spelling, and a qualified enum",
    sig({ statusCode: "CANCELED_BY_HOST" }), "statusCode=CANCELED_BY_HOST");
  h.is("a completed trip is not a cancelled one", sig({ statusCode: "COMPLETED" }), null);
  h.is("a live trip's cancellation POLICY is not a cancellation",
    sig({ statusCode: "BOOKED", cancellationPolicyType: "NON_REFUNDABLE" }), null);
  h.is("the same word anywhere else in the payload no longer counts - the field is known",
    sig({ reservationStatus: "CANCELLED", status: { code: "CANCELLED" }, note: "canceled" }), null);
  h.is("and an empty payload is simply unknown", sig(null), null);
  h.is("the status itself is readable, for the review feature to key on",
    HostOS.parser.reservationStatus({ statusCode: "COMPLETED" }), "COMPLETED");
})();

// The page heading, which is the one place Turo says it in its own words.
(function () {
  h.loadModules(["utils/logger.js", "content/selectors.js", "content/scanner.js"]);
  const heading = (text) => ({ textContent: text });
  const page = (headings) => ({
    textContent: "Reservation #61109808",
    querySelector: () => null,
    querySelectorAll: (selector) => selector === HostOS.selectors.pageHeadings ? headings : []
  });
  const url = "https://turo.com/us/en/reservation/61109808";
  const cancelled = HostOS.scanner.buildDetailTrip(page([heading("Cancelled trip")]), url);
  h.ok("a page headed Cancelled trip marks the reservation cancelled", cancelled.cancelled === true);
  h.is("and says where it learned that", cancelled.cancelledSignal, "page heading");
  h.ok("and counts as a complete scan, not one to keep retrying", cancelled.detailScanComplete === true);
  h.notOk("so it is not an upcoming trip", D.hasNotStarted({ ...cancelled, pickupDate: day(10) }));
  const live = HostOS.scanner.buildDetailTrip(page([heading("Stephen's trip")]), url);
  h.ok("a live page says nothing about cancellation - never false, so the API's answer is kept",
    !("cancelled" in live));
  const chatty = HostOS.scanner.buildDetailTrip(page([heading("Stephen's trip"), heading("Canceled trip!!")]), url);
  h.notOk("only the exact heading counts", chatty.cancelled === true);
})();

// Retention: kept flagged for a while so nothing can stand it back up, then
// let go.
(function () {
  const src = h.readSource("content/scanner.js");
  h.ok("cancelled trips are pruned on their own clock", /CANCELLED_RETENTION_MS/.test(src)
    && /isCancelled\(trip\)/.test(src));
})();

// The report reconciles with the panel.
(function () {
  const DIGEST_TIMEZONE = DIGEST_TZ;
  const COMPANY = COMPANY_NAME;
  eval(h.extractFunction(sw, "formatTripTime"));
  eval(h.extractFunction(sw, "composeDigest"));
  const report = composeDigest({ date: "9/10/2026", rateRisks: [], licenseRisks: [], unpriced: [],
    premier: [{ reservationId: "7", guest: "Stephen", vehicle: "Tiguan", pickup: day(10), returnDate: day(17) }] });
  h.includes("Premier trips still on the books are listed, counted", report.body, "PREMIER PLAN, ALREADY ALERTED (1)");
  h.includes("with what to do about them", report.body, "cancel and have them rebook");
  h.includes("and the note says this is a recap, not the alert", report.body, "own URGENT");
  h.ok("the recap comes after the risk sections",
    report.body.indexOf("PREMIER PLAN, ALREADY ALERTED") > report.body.indexOf("UNVERIFIED LICENSES"));
  h.ok("the report's Premier list is gated like the panel's - upcoming and not cancelled",
    sw.includes("const premier = trips.filter((trip) => isPremier(trip) && hasNotStarted(trip));"));
  h.ok("and the licence list refuses cancelled trips the same way the panel does",
    sw.includes("const licenseRisks = trips.filter((trip) => !isCancelled(trip)"));
})();

h.suite("post-trip reviews: what is waiting on Matt");
// Matt, 2026-09-10: "I forget to rate people a lot". Turo web shows this
// co-host account no rate-guest control, so nothing here submits a rating; it
// tracks the one thing he does - rate in the app - and notices when it has
// happened. Turo sends the guest the discount code itself after a 5.
(function () {
  const R = HostOS.reviews;
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const done = (over) => ({ reservationId: "1", completed: true, completedAt: daysAgo(3), guestName: "Doug", ...over });

  h.is("days left counts from the real end of the trip", R.daysLeft(done()), 7);
  h.is("and goes negative once Turo's window has closed", R.daysLeft(done({ completedAt: daysAgo(11) })), -1);
  h.is("unknown end, unknown days", R.daysLeft({ completed: true }), null);

  h.is("a completed, unrated trip is pending", R.state(done(), null), "pending");
  h.is("a live trip is nothing to review", R.state({ pickupDate: day(2) }, null), "none");
  h.is("nor is a cancelled one, whatever else it says", R.state(done({ cancelled: true }), null), "none");
  h.is("rated 4 by Matt on the card: done", R.state(done(), { rating: 4 }), "done");
  h.is("rated 5 on the card: done - Turo sends the discount code itself", R.state(done(), { rating: 5 }), "done");
  h.is("a rating Matt gave in the Turo app counts the same way (Kaushal, 9/9)",
    R.state(done({ hostReviewedAt: daysAgo(1), hostReviewRating: 5 }), null), "done");
  h.is("unrated past the window: expired, not pending forever", R.state(done({ completedAt: daysAgo(12) }), null), "expired");
  h.is("dismissed: done", R.state(done(), { dismissedAt: daysAgo(0) }), "done");

  const list = R.pending([
    done({ reservationId: "a", completedAt: daysAgo(8) }),
    done({ reservationId: "b", completedAt: daysAgo(1) }),
    done({ reservationId: "c", completedAt: daysAgo(2), hostReviewRating: 5, hostReviewedAt: daysAgo(1) }),
    done({ reservationId: "d", completedAt: daysAgo(2) })
  ], { d: { rating: 4 } });
  h.is("the list is unrated trips only, soonest to expire on top",
    list.map((entry) => entry.trip.reservationId + ":" + entry.state), ["a:pending", "b:pending"]);

  // Signals are figures and quotes, never verdicts.
  const flags = R.flagsFromReviews([
    { review: "Great guest. Communicative and took care of our car.", overallRating: 5, date: { localDate: "2025-09-03" } },
    { review: "Car came back smelling of smoke and the tank was empty. Late too.", overallRating: 2, date: { localDate: "2026-01-10" } }
  ]);
  h.is("a host's review mentioning smoking is flagged with the host's own sentence",
    flags.find((f) => f.label === "Smoking").quote, "Car came back smelling of smoke and the tank was empty.");
  h.is("one review can raise several flags", flags.map((f) => f.label).sort(), ["Fuel / charge", "Late", "Smoking"]);
  h.is("a clean review raises none", R.flagsFromReviews([{ review: "Great guest, would host again.", overallRating: 5 }]), []);
  // Alexander, 2026-09-11: this 5-star review was flagged DIRTY on "messed",
  // and the card told Matt to inspect before rating a model guest.
  h.is("a 5-star review is praise whatever words it uses", R.flagsFromReviews([{ overallRating: 5, date: { localDate: "2026-06-29" },
    review: "Alexander was more than understanding when a prior guest failed to return the car on time and messed up his plans." }]), []);
  h.is("the same words in a 2-star review are a complaint", R.flagsFromReviews([{ overallRating: 2,
    review: "Left the car messy and returned it late." }]).map((f) => f.label).sort(), ["Dirty", "Late"]);
  h.is("a negated mention is not a complaint either", R.flagsFromReviews([{ overallRating: 4,
    review: "No smoke smell at all, car was spotless." }]), []);
  h.is("and a review with no rating cannot be judged, so it is not flagged", R.flagsFromReviews([{ review: "smoked in the car" }]), []);
  h.includes("the reviewer's star count sits beside their words",
    R.signals(done({ guestReviewFlags: [{ label: "Smoking", quote: "smelled of smoke", rating: 2, date: "2026-01-10" }] }))[0].detail, "2\u2605");

  const trip = done({ milesExcess: 794, milesLimit: 1500, reimbursementOpen: true, reimbursementNote: "resolve by Sep 11",
    guestReviewFlags: flags.slice(0, 1), guestRating: 3.5, guestRatingCount: 2 });
  h.is("every signal Turo's data supports is named",
    R.signals(trip).map((sig) => sig.label), ["Extra mileage", "Reimbursement open", "Low rating", "Prior review: Smoking"]);
  h.includes("with its figure", R.signals(trip)[0].detail, "+794 mi");
  h.is("a guest with no ratings is not a low rating", R.signals(done({ guestRating: null, guestRatingCount: 0 })), []);

  // Matt's rule: rate back only once the guest has rated him 5 stars. Turo
  // hides the guest's review until he does (double-blind), so the only signal
  // is the guest saying so in the thread.
  h.is("a guest saying they gave 5 stars is the ready signal, quoted",
    R.saysRated("Hi Matt, just left you a 5 star review, thanks again!"), "Hi Matt, just left you a 5 star review, thanks again!");
  h.is("so is 'rated you'", R.saysRated("Rated you 5 stars. Great car."), "Rated you 5 stars.");
  h.is("a message about something else is not", R.saysRated("We have parked the car, can we leave?"), null);
  h.is("nor the host's own review request quoted back", R.saysRated("what do you mean by charge before 11 am"), null);
  h.ok("a trip the guest has rated is ready", R.readiness(done({ guestSaysRated: { at: daysAgo(0), quote: "left you a 5 star review" } })).ready);
  h.notOk("one they have not said anything about is not", R.readiness(done()).ready);
  h.is("ready trips come first on the list, then the rest by window",
    R.pending([done({ reservationId: "x", completedAt: daysAgo(1) }),
      done({ reservationId: "y", completedAt: daysAgo(8), guestSaysRated: { quote: "5 stars!" } })]).map((e) => e.trip.reservationId), ["y", "x"]);

  h.is("the recommendation is 'inspect' whenever anything is on the table",
    R.recommendation(trip, null).verdict, "inspect");
  h.includes("and it says what", R.recommendation(trip, null).text, "extra mileage");
  h.is("a marked problem does the same", R.recommendation(done(), { problems: ["smoke"] }).verdict, "inspect");
  h.is("nothing on the table is the honest version of 'safe to rate 5'",
    R.recommendation(done({ postTripCheckedAt: daysAgo(0) }), null).verdict, "clean");
  h.excludes("and it never claims a percentage", R.recommendation(done(), null).text, "%");
})();

h.suite("post-trip sweep reads the reservation and the guest's reviews");
(function () {
  h.loadModules(["utils/logger.js", "content/reviewScanner.js"]);
  const S = HostOS.reviewScanner;
  const ended = Date.now() - 2 * 864e5;
  // Shaped like the live payloads read on 2026-09-10 (Randeep, Kaushal).
  const detail = {
    statusCode: "COMPLETED", renter: { id: 55735131 }, owner: { id: 111 }, cohosts: [{ id: 222 }, { id: 333 }],
    tripEnd: { epochMillis: ended, localDate: "2026-09-08", localTime: "17:00" },
    odometerDetail: { distanceDriven: { scalar: 2294, unit: "MI" }, excessDistance: { scalar: 794, unit: "MI" }, distanceLimit: { scalar: 1500, unit: "MI" } },
    reimbursementStatus: { disputed: false, explanation: "Please resolve the incidental invoice by September 11." },
    cleaningRecord: { cleaned: false, cleanedAt: null }
  };
  const reviewBy = (author, at, rating, text) => ({ author: { id: author }, overallRating: rating, review: text, date: { epochMillis: at } });

  const unrated = S.summarise(detail, { list: [reviewBy(999, ended + 3600e3, 5, "Nice guy")] });
  h.ok("a completed trip is marked completed, with its real end", unrated.completed === true && unrated.completedAt === new Date(ended).toISOString());
  h.is("miles over the allowance are read as a figure", unrated.milesExcess, 794);
  h.ok("an open reimbursement is read with Turo's own wording", unrated.reimbursementOpen === true && /September 11/.test(unrated.reimbursementNote));
  h.is("the guest's id is kept, so their reviews can be joined later", unrated.driverId, "55735131");
  h.is("a review by some other host is not Matt's rating", unrated.hostReviewedAt, null);

  const rated = S.summarise(detail, { list: [reviewBy(222, ended + 3600e3, 5, "Nice guy")] });
  h.ok("a review by anyone on the host team after the trip is the rating", rated.hostReviewedAt !== null && rated.hostReviewRating === 5);
  const stale = S.summarise(detail, { list: [reviewBy(111, ended - 30 * 864e5, 5, "Great last time")] });
  h.is("a team review from a previous trip is not this trip's rating", stale.hostReviewedAt, null);
  const early = S.summarise(detail, { list: [reviewBy(111, ended - 6 * 3600e3, 4, "Checked out early, fine")] });
  h.is("but a review a few hours before the scheduled end is - guests check out early", early.hostReviewRating, 4);

  const thread = (role, at, text) => ({ authorDriverRole: role, text, sentTime: { epochMillis: at } });
  const said = S.summarise(detail, { list: [] }, [
    thread("HOST", ended + 7200e3, "Thanks for choosing the Model Y! If you enjoyed it I'd appreciate a 5-star review"),
    thread("GUEST", ended + 3600e3, "Just left you a 5 star review, thank you!")
  ]);
  h.is("the guest saying they rated Matt, after the trip, is kept with the quote",
    said.guestSaysRated && said.guestSaysRated.quote, "Just left you a 5 star review, thank you!");
  const hostOnly = S.summarise(detail, { list: [] }, [thread("HOST", ended + 7200e3, "I'd appreciate a 5-star review")]);
  h.is("the host's own request for a review never counts", hostOnly.guestSaysRated, null);
  const before = S.summarise(detail, { list: [] }, [thread("GUEST", ended - 5 * 864e5, "left you a 5 star review last time")]);
  h.is("nor a guest message from before the trip", before.guestSaysRated, null);
  const noThread = S.summarise(detail, { list: [] }, null);
  h.is("no thread read is 'not said', never 'said'", noThread.guestSaysRated, null);
  h.ok("the thread is a third request, after the reviews", /CONVERSATION \+ encodeURIComponent\(trip\.reservationId\)/.test(h.readSource("content/reviewScanner.js")));
  h.ok("and a new message on a completed trip triggers a re-read within a minute",
    /isMessage/.test(h.readSource("content/activityScanner.js")) && h.readSource("content/activityScanner.js").includes("postTripCheckedAt: null"));

  const cancelled = S.summarise({ statusCode: "CANCELLED", renter: { id: 1 } }, null);
  h.ok("a cancelled reservation is recorded as cancelled, the same way the plan sweep does it",
    cancelled.cancelled === true && cancelled.cancelledSignal === "statusCode=CANCELLED");
  const live = S.summarise({ statusCode: "BOOKED", renter: { id: 1 } }, null);
  h.ok("a live reservation is only stamped as checked", live.completed === undefined && Boolean(live.postTripCheckedAt));

  const now = Date.now();
  const back = { reservationId: "1", returnDate: new Date(now - 864e5).toISOString() };
  h.ok("a trip that came back yesterday is checked", S.needsCheck(back, now));
  h.notOk("one still out is not", S.needsCheck({ reservationId: "1", returnDate: new Date(now + 864e5).toISOString() }, now));
  h.ok("an early checkout from the feed is checked before its scheduled return",
    S.needsCheck({ reservationId: "1", returnDate: new Date(now + 864e5).toISOString(), checkedOutAt: new Date(now).toISOString() }, now));
  h.notOk("a cancelled one never is", S.needsCheck({ ...back, cancelled: true }, now));
  h.notOk("nor one from months ago", S.needsCheck({ reservationId: "1", returnDate: new Date(now - 60 * 864e5).toISOString() }, now));
  const checked = { ...back, postTripVersion: HostOS.constants.POST_TRIP_VERSION, postTripCheckedAt: new Date(now - 3600e3).toISOString() };
  h.notOk("checked an hour ago and still unrated: wait", S.needsCheck(checked, now));
  h.ok("checked yesterday and still unrated: look again, Matt may have rated from the app",
    S.needsCheck({ ...checked, postTripCheckedAt: new Date(now - 864e5).toISOString() }, now));
  h.notOk("rated: nothing more to learn", S.needsCheck({ ...checked, postTripCheckedAt: new Date(now - 864e5).toISOString(), hostReviewedAt: new Date(now).toISOString() }, now));
  h.ok("read-late: every request happens before the trip list is read",
    (() => { const src = h.readSource("content/reviewScanner.js"); const from = src.indexOf("const latest = await HostOS.storage.getTrips()"); return from > 0 && !/fetch\(/.test(src.slice(from, src.indexOf("saveTrips(", from))); })());
})();

h.suite("the Pending Reviews queue");
(function () {
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const doug = { reservationId: "60556099", guestName: "Doug", vehicle: "Volkswagen Tiguan 2024", plate: "DJIF67",
    completed: true, completedAt: daysAgo(2), pickupDate: daysAgo(13), returnDate: daysAgo(2),
    postTripCheckedAt: daysAgo(0), milesDriven: 781, milesExcess: 0, tripUrl: "https://turo.com/us/en/reservation/60556099" };
  const randeep = { ...doug, reservationId: "60571517", guestName: "Randeep", milesDriven: 2294, milesExcess: 794,
    guestReviewFlags: [{ label: "Smoking", quote: "Car came back smelling of smoke.", date: "2026-01-10" }] };
  const kaushal = { ...doug, reservationId: "60999294", guestName: "Kaushal", hostReviewedAt: daysAgo(1), hostReviewRating: 5 };
  const karen = { ...doug, reservationId: "60616336", guestName: "Karen", guestSaysRated: { at: daysAgo(0), quote: "Left you a 5 star review!" } };
  const upcoming = { reservationId: "9", guestName: "Brooke", pickupDate: day(2), returnDate: day(5) };
  const trips = [doug, randeep, kaushal, upcoming, karen];

  const groups = qv.computeGroups(trips, {});
  h.is("completed trips Matt has not rated are their own queue, the guest who rated him first on top",
    groups.reviews.map((t) => t.guestName), ["Karen", "Doug", "Randeep"]);
  h.is("and count on the badge", qv.computeActionCount(groups), 3);
  h.is("a rating recorded on the card takes a trip off it", qv.computeGroups(trips, { "60556099": { rating: 4 } }).reviews.length, 2);
  h.is("and so does one already given in Turo (Kaushal)", groups.reviews.some((t) => t.guestName === "Kaushal"), false);

  const rendered = h.renderQueue(HostOS, trips, "reviews", null);
  const text = rendered.textContent;
  h.includes("the queue is titled", text, "PENDING REVIEWS");
  h.includes("a card names the guest", text, "Randeep");
  h.includes("and the days left of Turo's window, as Turo's", text, "8 days left");
  h.includes("Turo's data reads as chips", text, "Extra mileage");
  h.includes("with the other host's own words", text, "smelling of smoke");
  h.includes("a clean trip says so rather than showing nothing", text, "No flags from Turo");
  h.includes("problems are marked by exception", text, "Smoke odor");
  h.includes("Matt's rating is one tap", text, "Your rating");
  h.includes("a guest who has rated him is badged as such", text, "Guest rated you");
  h.includes("in their own words", text, "Left you a 5 star review!");
  h.includes("and one who has not is said to be waited on", text, "Waiting on the guest");
  h.excludes("nothing about a promo code - Turo sends it itself", text.toLowerCase(), "promo");
  h.includes("the recommendation gives reasons", text, "Inspect before rating");
  h.excludes("and never a made-up percentage", text, "%");
  h.includes("an empty queue is a sentence, not a blank", h.renderQueue(HostOS, [upcoming], "reviews", null).textContent, "Nothing waiting");
  // The queue has inputs now. Both surfaces rebuild the open queue on every
  // storage change (every few seconds on a Turo page) and every 15s; a
  // rebuild with a hand in the notes box threw the focus and the words away.
  h.ok("the panel never rebuilds a queue something inside it has focus on",
    h.readSource("content/widget.js").includes("results.contains(document.activeElement)"));
  h.ok("nor does the popup", h.readSource("popup/popup.js").includes('$("results").contains(document.activeElement)'));
  h.ok("and the actions that remove a card release focus first, so their rebuild happens",
    (h.readSource("modules/queueView.js").match(/\b(button|extra)\.blur\(\);/g) || []).length === 2);
  h.ok("a note is flushed on blur, not only on the debounce", h.readSource("modules/queueView.js").includes('notes.addEventListener("blur"'));
})();

h.suite("post-trip reviews reach the report, the badge and the options page");
h.ok("the sweep runs with the other content-side sweeps", /reviewScanner\?\.run\(\)/.test(h.readSource("content/content.js")));
h.ok("the feed's checkout event is read", /guest checked out/i.test(h.readSource("content/activityScanner.js")));
(function () {
  const manifest = JSON.parse(h.readSource("manifest.json"));
  const scripts = manifest.content_scripts[0].js;
  h.ok("the shared module loads before anything that uses it",
    scripts.indexOf("utils/reviews.js") > scripts.indexOf("utils/parser.js") && scripts.indexOf("utils/reviews.js") < scripts.indexOf("modules/queueView.js"));
  h.ok("and the sweep after the feed", scripts.indexOf("content/reviewScanner.js") > scripts.indexOf("content/activityScanner.js"));
  h.ok("the popup loads it too", /utils\/reviews\.js/.test(h.readSource("popup/popup.html")));
  h.ok("and the service worker", /importScripts\([^)]*"\/utils\/reviews\.js"/.test(sw));
})();
h.ok("the badge counts reviews waiting", /actionableCount \+= waiting\.length/.test(sw));
h.ok("one reminder a day, keyed by the Colorado date", /"reviews:" \+ coloradoNow\(\)\.date/.test(sw));
h.ok("and one per trip as its window closes", /:review-expiring/.test(sw));
(function () {
  const DIGEST_TIMEZONE = DIGEST_TZ;
  const COMPANY = COMPANY_NAME;
  eval(h.extractFunction(sw, "formatTripTime"));
  eval(h.extractFunction(sw, "composeDigest"));
  const report = composeDigest({ date: "9/10/2026", rateRisks: [], licenseRisks: [], unpriced: [], premier: [],
    reviews: [{ reservationId: "60556099", guest: "Doug", vehicle: "Tiguan", state: "pending", daysLeft: 8, signals: ["Extra mileage"], ready: false },
      { reservationId: "60616336", guest: "Karen", vehicle: "Tiguan", state: "pending", daysLeft: 5, signals: [], ready: true, guestQuote: "Left you a 5 star review!" }] });
  h.includes("the report lists what is waiting", report.body, "REVIEWS WAITING ON YOU (2)");
  h.includes("with the window", report.body, "8 days left of Turo's 10-day window");
  h.includes("and Turo's data", report.body, "Turo's data: Extra mileage");
  h.includes("a guest who rated first is called out to rate back", report.body, "GUEST RATED YOU - \"Left you a 5 star review!\"");
  h.includes("and one who has not is marked as waited on", report.body, "waiting on the guest's 5-star review first");
})();
// John, 2026-09-10: Turo sends the guest the discount code itself once they
// are rated 5 stars. An earlier version tracked a "promo sent" step; it was
// removed, and nothing may bring it back as a manual chore.
h.excludes("no promo-code step survives in the queue", h.readSource("modules/queueView.js").toLowerCase(), "promo");
h.excludes("nor in the options page", h.readSource("options/options.html").toLowerCase(), "promo");

h.suite("Premier bookings are their own queue, and Profit Risk is the $0.20 rule alone");
// "Profit Risk 14" had been two unrelated things - thin trips and Premier
// bookings - and could never match the report's BELOW $0.20/MILE count.
(function () {
  const up = { pickupDate: day(3), returnDate: day(6) };
  const thin = { reservationId: "t", ...up, earningsRisk: true, earningsBelowFloor: true, premierProtection: false };
  const prem = { reservationId: "p", ...up, earningsRisk: true, earningsBelowFloor: false, premierProtection: true };
  const both = { reservationId: "b", ...up, earningsRisk: true, earningsBelowFloor: true, premierProtection: true };
  const fine = { reservationId: "f", ...up, earningsRisk: false, earningsBelowFloor: false, premierProtection: false };
  const started = { reservationId: "s", pickupDate: day(-1), returnDate: day(2), premierProtection: true };
  const groups = qv.computeGroups([thin, prem, both, fine, started]);
  h.is("Profit Risk is thin trips only", groups.earnings.map((t) => t.reservationId), ["t"]);
  h.is("Premier is Premier trips only, and a thin Premier trip shows once, there", groups.premier.map((t) => t.reservationId), ["p", "b"]);
  h.is("a Premier trip already on rent cannot be cancelled, so it is not listed", groups.premier.some((t) => t.reservationId === "s"), false);
  h.is("both count on the badge", qv.computeActionCount(groups), 3);
  h.is("the queue is titled", h.renderQueue(HostOS, [prem], "premier", null).textContent.slice(0, 30).trim().split("×")[0].trim(), "PREMIER PLAN BOOKINGS");
  h.ok("the tile comes first in the panel", (() => { const w = h.readSource("content/widget.js"); return w.indexOf('summaryCard("premier"') < w.indexOf('summaryCard("license"') && w.includes("cards.append(premierCard, licenseCard"); })());
  h.ok("and in the popup", (() => { const html = h.readSource("popup/popup.html"); return html.indexOf('data-filter="premier"') < html.indexOf('data-filter="license"'); })());
  h.ok("the tile turns red while anything is on it", h.readSource("content/widget.js").includes('classList.toggle("hostos-widget-alert", groups.premier.length > 0)'));
})();

h.suite("earnings outlook: this week, this month, booked ahead");
(function () {
  const O = HostOS.outlook;
  const now = new Date(2026, 8, 12, 10, 0, 0).getTime(); // Saturday 12 Sep 2026
  const at = (d, h2) => new Date(2026, 8, d, h2 || 12).toISOString();
  const trips = [
    { reservationId: "1", returnDate: at(13), estimatedEarnings: 200 },   // Sun - this week, this month
    { reservationId: "2", returnDate: at(15), estimatedEarnings: 300 },   // next week, this month
    { reservationId: "3", returnDate: at(29), estimatedEarnings: null },  // this month, not priced
    { reservationId: "4", returnDate: new Date(2026, 9, 2).toISOString(), estimatedEarnings: 500 }, // October
    { reservationId: "5", returnDate: at(8), estimatedEarnings: 999 },    // already ended this week
    { reservationId: "6", returnDate: at(20), estimatedEarnings: 100, cancelled: true }
  ];
  const out = O.compute(trips, now);
  h.is("the week is Monday to Sunday", [new Date(O.weekWindow(now).start).getDay(), new Date(O.weekWindow(now).end - 1).getDay()], [1, 0]);
  h.is("this week sums what ends this week, including trips already back", out.week.total, 1199);
  h.is("this month sums September, with the unpriced trip named rather than counted as $0", [out.month.total, out.month.unpriced], [1499, 1]);
  h.is("booked ahead is everything still to end", [out.ahead.total, out.ahead.trips], [1000, 4]);
  h.excludes("a cancelled trip is never counted", JSON.stringify(out), "100,");
  h.includes("the wording names the unpriced trip", O.describe(out.month), "1 not priced yet");
  h.includes("the panel shows it above today's list", h.renderQueue(HostOS, trips, "today", null).textContent, "Earnings outlook");
  h.ok("the service worker loads it", /importScripts\([^)]*"\/utils\/outlook\.js"/.test(sw));
})();

h.suite("the panel reads at a glance: hero, tile subtitles, stat cells, collapsed marks");
(function () {
  const up = { pickupDate: day(3), returnDate: day(6) };
  const groups = {
    premier: [{ reservationId: "p", ...up, premierProtection: true }],
    license: [{ reservationId: "l", ...up, licenseVerified: false }],
    earnings: [{ reservationId: "e", ...up, earningsBelowFloor: true }],
    reviews: [{ reservationId: "r1", completed: true, completedAt: hoursAgo(30), guestSaysRated: { quote: "5 stars!" } },
      { reservationId: "r2", completed: true, completedAt: hoursAgo(30) }]
  };
  const hero = qv.computeHeroSummary(groups);
  // 41 "items need attention" was 25 reviews plus 16 real items. The hero
  // now counts deadline-bound work; reviews ride underneath.
  h.is("the hero counts Premier, licences and thin trips only", hero.urgent, 3);
  h.includes("and names the most urgent thing first", hero.headline, "1 Premier booking to cancel before pickup");
  h.includes("with the reviews underneath, and how many are ready", hero.sub, "2 reviews waiting \u00b7 1 ready to rate");
  h.is("a quiet fleet says so", qv.computeHeroSummary({ premier: [], license: [], earnings: [], reviews: [] }).headline, "Nothing needs attention");

  const subs = qv.tileSubtitles(groups, [], null);
  h.is("each tile says what its count is of", [subs.license, subs.earnings, subs.reviews],
    ["1 trip \u00b7 pickup within 24h", "1 trip \u00b7 below $0.20/mi", "2 waiting \u00b7 1 ready to rate"]);
  h.is("and a clear tile says so rather than showing 0",
    qv.tileSubtitles({ premier: [], license: [], earnings: [], reviews: [] }, [], null).premier, "None \u2014 all clear");
  const dueToday = [{ reservationId: "d", pickupDate: day(-3), returnDate: hoursAgo(-2), plate: "ZZZ" }];
  h.includes("a trip due back today that is not priced is counted, not shown as $0",
    qv.tileSubtitles({ premier: [], license: [], earnings: [], reviews: [] }, dueToday, null).today, "1 trip due back today");

  const cells = qv.statCells({ active: 36, booked: 69, protectionChecked: 105, protectionTotal: 105 }, 2, { completed: 254 }, "0s ago", "43s ago");
  h.is("the footer sentence is six labelled cells", cells.map((c) => c.label),
    ["Active", "Booked", "Available", "Plans checked", "Scanned", "Queue"]);
  h.is("with the numbers as values", cells.map((c) => c.value), ["36", "69", "2", "105/105", "0s ago", "43s ago"]);

  // Problems and notes sit behind one disclosure, open only when something
  // is in it - the common case is a card with nothing to mark.
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const trip = { reservationId: "1", guestName: "Karen", completed: true, completedAt: daysAgo(2), postTripCheckedAt: daysAgo(0) };
  const plain = h.renderQueue(HostOS, [trip], "reviews", null, { reviewRecords: {} }).textContent;
  h.includes("a clean card offers the marks behind a disclosure", plain, "Mark a problem or add a note");
  const marked = h.renderQueue(HostOS, [trip], "reviews", null, { reviewRecords: { "1": { problems: ["smoke"] } } }).textContent;
  h.includes("a card with a mark already on it opens it and says so", marked, "Problems & notes");
  h.ok("the popup's Premier tile carries real characters, not escape text",
    !/\\u26a0|\\u2014|\\u203a/.test(h.readSource("popup/popup.html")));
})();

h.suite("every tile with a reservation offers a way in");
function buttonLabels(node) {
  const found = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    // The test DOM keeps tagName as given; a real one uppercases it.
    if (String(n.tagName).toUpperCase() === "BUTTON") found.push(n.textContent);
    (n.children || []).forEach(walk);
  })(node);
  return found;
}
const withUrl = { ...brent, tripUrl: "https://turo.com/us/en/reservation/60634202" };
h.ok("profit risk tiles have Open trip",
  buttonLabels(h.renderQueue(HostOS, [riskEngine.enrich(withUrl)], "earnings", FLEET)).includes("Open trip"));
h.ok("licence tiles keep Copy reminder alongside it", (() => {
  const labels = buttonLabels(h.renderQueue(HostOS,
    [riskEngine.enrich({ ...withUrl, licenseVerified: false, pickupDate: hoursAgo(-6) })], "license", FLEET));
  return labels.includes("Open trip") && labels.includes("Copy reminder");
})());
h.ok("earnings estimator tiles have Open trip",
  buttonLabels(h.renderQueue(HostOS, [riskEngine.enrich({ ...withUrl,
    reservationId: "60700001", pickupDate: day(-3, 16), returnDate: day(0, 20) })], "today", FLEET))
    .includes("Open trip"));
// A vehicle with no active trip has no reservation page to open; a dead
// button would be worse than none.
h.excludes("an idle vehicle offers no dead button",
  buttonLabels(h.renderQueue(HostOS, [], "today", FLEET)).join("|"), "Open trip");

h.suite("money never renders as stacked blocks");
// .hostos-result b used to set display:block for the card title, which turned
// every money span into its own line ("≈$105" / "$35" / "/day" vertically).
const popupCss = h.readSource("popup/popup.css");
const widgetCss = h.readSource("content/widget.css");
h.notOk("the block rule no longer catches every b in a card",
  /\.hostos-result b \{ display:block/.test(popupCss) || /\.hostos-result b \{ display: block/.test(widgetCss));
h.ok("money is explicitly inline in the popup", /b\.hostos-money[^{]*\{[^}]*display:inline/.test(popupCss));
h.ok("money is explicitly inline in the widget", /b\.hostos-money[\s\S]{0,80}display: inline/.test(widgetCss));

h.suite("the queue uses the whole sidebar");
// It was position:fixed with max-height:300px — a small floating box with an
// empty sidebar beneath it, capped at a few tiles however tall the window was.
h.notOk("no longer a fixed-height floating box",
  /.hostos-results {[^}]*position:fixed/.test(popupCss) || /.hostos-results {[^}]*max-height:300px/.test(popupCss));
h.ok("it grows to fill the column", /.hostos-results {[^}]*flex:1 1 auto/.test(popupCss));
h.ok("min-height:0 so it scrolls instead of overflowing",
  /.hostos-results {[^}]*min-height:0/.test(popupCss));
h.ok("the popup is a flex column", /.popup {[^}]*flex-direction: column/.test(popupCss));
h.ok("footers stay pinned and don't steal height", /.footer { flex: none;/.test(popupCss));

h.suite("the card's two money rows must reconcile");
// A card once read "$1,283" and "$0.15/mi across 3,500 mi included" — figures
// that cannot both describe one trip ($1,283 ÷ 3,500 is $0.37). Earnings was
// showing the GROSS nightly total while Per mile was computed from NET. Both
// now come from the same net figure.
function cardRows(node) {
  const keys = h.textOfClass(node, "hostos-key");
  const vals = h.textOfClass(node, "hostos-val");
  const out = {};
  keys.forEach((k, i) => { out[k] = vals[i]; });
  return out;
}
const pricedFleet = { vehicles: { AAAA11: { vehicle: "Tesla", plate: "AAAA11",
  prices: Array(31).fill(43), bookedDayFlags: Array(31).fill(true), bookedDays: 31, totalDays: 31 } } };
const priced = riskEngine.enrich({
  reservationId: "60637474", guestName: "Clara", plate: "AAAA11",
  pickupDate: day(4, 19), returnDate: day(34, 20),
  includedMiles: 3500, pricePerMile: 0.23, earningsPerMile: 0.15, earningsInputsKnown: true,
  estimatedEarnings: 525, earningsExtras: 0, earningsDelivery: 120,
  hostTakeRate: 0.9, lengthDiscountPercent: 50,
  cancellationPolicyType: "NON_REFUNDABLE", deliveryFee: 120
});
const pricedRows = cardRows(h.renderQueue(HostOS, [priced], "earnings", pricedFleet));
const shownEarnings = Number((pricedRows.Earnings.match(/\$([\d,]+)/) || [])[1].replace(/,/g, ""));
const shownPerMile = Number((pricedRows["Per mile"].match(/\$([\d.]+)/) || [])[1]);
h.ok("earnings ÷ included miles equals the per-mile figure",
  Math.abs(shownEarnings / 3500 - shownPerMile) <= 0.01);
h.includes("earnings are labelled as net", pricedRows.Earnings, "after discounts and Turo's cut");
h.notOk("the gross nightly total is not passed off as earnings", /\$1,29\d|\$1,3\d\d/.test(pricedRows.Earnings));
h.includes("the overage rate stays visible but separate", pricedRows.Overage, "past the allowance");
// Before the pricing sweep reaches a trip the net chain can't be built; that
// must be said, not quietly shown as if it were take-home.
const unpricedRows = cardRows(h.renderQueue(HostOS,
  [riskEngine.enrich({ ...priced, reservationId: "2", hostTakeRate: null, deliveryFee: null,
    lengthDiscountPercent: null, estimatedEarnings: null, earningsExtras: null, earningsDelivery: null })],
  "earnings", pricedFleet));
h.includes("an unpriced trip says its figure is gross", unpricedRows.Earnings, "gross, pricing not scanned yet");

h.suite("notifications actually appear");
// Seen live in the service worker console: repeated "Unable to download all
// specified images" rejections. A relative iconUrl can't be resolved from a
// service worker, so every Chrome notification was failing silently.
h.ok("the icon is an absolute extension URL", /chrome\.runtime\.getURL\("assets\/icon-128\.png"\)/.test(sw));
h.notOk("no relative iconUrl remains", /iconUrl: "assets\//.test(sw));
h.ok("a failed notification is caught, not left unhandled", /console\.warn\("\[HostOS\] Notification failed\./.test(sw));
h.ok("and is only marked as sent when it actually appeared",
  /if \(await notify\(key, "Unverified license"/.test(sw)
  && /if \(await notify\(key, isPremier\(trip\) \? "Premier plan booked" : "Profit risk"/.test(sw));

h.suite("fleet branding");
const popupHtmlSrc = h.readSource("popup/popup.html");
const widgetSrc = h.readSource("content/widget.js");
h.includes("the sidebar names the fleet", popupHtmlSrc, "COLORADO CRUISERS");
h.includes("the widget names the fleet", widgetSrc, "COLORADO CRUISERS");
// The hostOS wordmark John supplied (2026-09-12) is the product name and
// stands in for both the old car mark and the "HostOS" heading; a hidden
// heading is kept for assistive tech, and the fleet eyebrow stays above it.
h.ok("the wordmark exists", fs.existsSync(path.join(h.ROOT, "assets/hostos-wordmark.svg")));
h.includes("the sidebar shows the wordmark", popupHtmlSrc, "assets/hostos-wordmark.svg");
h.includes("and keeps a heading for assistive tech", popupHtmlSrc, '<h1 class="visually-hidden">HostOS</h1>');
h.ok("the widget builds an absolute URL for it",
  /chrome\.runtime\.getURL\("assets\/hostos-wordmark\.svg"\)/.test(widgetSrc));
h.ok("the wordmark is web-accessible to Turo pages", (() => {
  const war = JSON.parse(h.readSource("manifest.json")).web_accessible_resources || [];
  return war.some((entry) => (entry.resources || []).includes("assets/hostos-wordmark.svg"));
})());
// A content script can't load an extension file inside a page unless it's
// declared web-accessible; without this the widget's mark is a broken image.
h.ok("the mark is web-accessible to Turo pages", (() => {
  const war = JSON.parse(h.readSource("manifest.json")).web_accessible_resources || [];
  return war.some((entry) => (entry.resources || []).includes("assets/fleet-logo.svg")
    && (entry.matches || []).some((m) => m.includes("turo.com")));
})());
// An SVG loaded via <img src> is an isolated document and cannot see the host
// page's CSS, so currentColor there resolves to black — invisible on this dark
// UI. The file must carry its own colours.
h.notOk("the mark does not rely on currentColor (it renders via <img>)",
  /currentColor/.test(h.readSource("assets/fleet-logo.svg").replace(/<!--[\s\S]*?-->/g, "")));
h.ok("it uses light fills that show on a dark panel",
  /fill="#f5f5f7"/.test(h.readSource("assets/fleet-logo.svg")));

h.suite("the header stays put while scrolling");
h.ok("the sidebar header is sticky", /\.header \{ position: sticky; top: 0;/.test(popupCss));
h.ok("and paints its own background so content can't show through",
  /\.header \{[^}]*background: #0e1116/.test(popupCss));
h.ok("the widget header is sticky", /\.hostos-widget-header \{ position: sticky;/.test(widgetCss));
h.ok("and paints its own background",
  /\.hostos-widget-header \{[^}]*background: #0e1116/.test(widgetCss));

h.suite("manifest");
const manifest = JSON.parse(h.readSource("manifest.json"));
h.is("version is pinned at 1.0.0", manifest.version, "1.0.0");
// An Apps Script /exec web app answers a POST with a 302 to
// script.googleusercontent.com. An extension fetch follows that redirect, and
// MV3 blocks a redirect to an origin with no host permission - surfacing as a
// bare "TypeError: Failed to fetch" with nothing pointing at the cause.
// Without this, every alert to Matt can die at the redirect.
h.ok("the Apps Script redirect target is permitted, not just /exec",
  manifest.host_permissions.includes("https://script.googleusercontent.com/*"));
manifest.content_scripts[0].js
  .concat([manifest.background.service_worker, manifest.options_ui.page, manifest.side_panel.default_path])
  .forEach((file) => h.ok("referenced file exists: " + file, fs.existsSync(path.join(h.ROOT, file))));
h.suite("no hand-copied logic in the service worker");
// These helpers used to exist twice and drifted; both the tripStatus fix and
// the null-date fix had to be applied in two places, and missing the second
// copy was a real bug each time. They're now loaded, not copied.
h.ok("shared modules are imported", /importScripts\("\/utils\/constants\.js"/.test(sw));
h.ok("the scan version comes from constants, not a second literal",
  /DETAIL_SCAN_VERSION = HostOS\.constants\.DETAIL_SCAN_VERSION/.test(sw));
h.notOk("no duplicate scan-version literal remains", /const DETAIL_SCAN_VERSION = \d+/.test(sw));
h.ok("date helpers delegate to HostOS.dates",
  /const parseTime = \(value\) => HostOS\.dates\.parseTime/.test(sw)
  && /const hasNotStarted = \(trip\) => HostOS\.dates\.hasNotStarted/.test(sw));
h.notOk("no re-implemented parseTime body", /Number\.isFinite\(time\) && time > 0 \? time : null/.test(sw));

h.suite("a broken scraper cannot knock out Scan now");
// content/content.js had no coverage at all until now, which is exactly why
// this shipped: the manual-scan listener was the LAST statement in a chain of
// unguarded top-level calls, so any one of them throwing left the tab unable
// to answer a scan for the rest of its life. The widget kept rendering stored
// data, so the panel still looked alive.
const contentSrc = h.readSource("content/content.js");
h.ok("the manual-scan listener registers before any scraper runs",
  contentSrc.indexOf("HOSTOS_RUN_SCAN") < contentSrc.indexOf('step("scan"'));
h.ok("a scan that rejects still answers, so the port never closes unexplained",
  contentSrc.includes(".catch((error) => sendResponse("));
h.ok("a scanner that throws synchronously answers too",
  contentSrc.includes("sendResponse({ error:"));
h.ok("each bootstrap step is guarded on its own",
  contentSrc.includes('step("fleetScanner"') && contentSrc.includes('step("observer"'));

h.suite("orphaned background scan tabs get cleaned up");
// MV3 can terminate the worker while a scan tab is open, discarding both
// currentScrape and the timeout that would have closed it. Two such tabs were
// sitting in the tab strip when this was reported.
h.ok("a fresh service worker sweeps hostos_bg tabs it can no longer track",
  sw.includes("closeOrphanedScanTabs();") && sw.includes('(tab.url || "").includes("hostos_bg=1")'));
h.ok("the in-flight guard is set before the first await, not after",
  sw.indexOf("startingScrape = true;") < sw.indexOf("if (await isPaused())"));

h.suite("scan failure wording says which tab to refresh");
h.includes("several disconnected tabs are named by count",
  qv.scanFailureText({ reason: "no-listener", tabsTried: 2 }), "2 open Booked tabs");
h.includes("refreshing is the advice, because only that reconnects them",
  qv.scanFailureText({ reason: "no-listener", tabsTried: 2 }), "Refresh");
h.includes("a single tab is not described in the plural",
  qv.scanFailureText({ reason: "no-listener", tabsTried: 1 }), "the Booked tab");

// --- async suites ---------------------------------------------------------
// The reported failure: the panel said "Scan failed - try reloading the
// Booked tab" while the footer showed a scan from a minute earlier. Two
// Booked tabs were open; the first one chrome.tabs.query returned had an
// orphaned content script (it was open when the extension last reloaded), and
// runManualScan gave up on it instead of trying the other one. Reloading the
// tab the user was looking at never helped - that was the working one.
async function scanNowSuite() {
  h.suite("Scan now has to reach the right Booked tab");

  let tabsOpen = [];
  let sent = [];
  let responder = () => ({ tripsFound: 7 });
  let queueKicked = 0;
  const maybeStartNextScrape = () => { queueKicked += 1; };
  const booked = (id, extra) => Object.assign({ id, url: "https://turo.com/us/en/trips/booked" }, extra);
  global.chrome = { tabs: {
    query: async () => tabsOpen,
    sendMessage: async (id) => { sent.push(id); return responder(id); }
  } };

  eval(h.extractFunction(sw, "orderBookedTabs"));
  eval(h.extractFunction(sw, "runManualScan"));

  h.is("the active Booked tab is tried first, not whichever query returned first",
    orderBookedTabs([booked(1, { lastAccessed: 900 }), booked(2, { active: true, lastAccessed: 5 })]).map((t) => t.id),
    [2, 1]);
  h.is("a discarded tab goes last - Chrome has already torn its scripts down",
    orderBookedTabs([booked(1, { discarded: true, lastAccessed: 900 }), booked(2, { lastAccessed: 5 })]).map((t) => t.id),
    [2, 1]);

  // The reported state, arranged so the old code provably fails it: the tab
  // chrome.tabs.query returns FIRST is disconnected, and so is the next one.
  // Only the third answers. The old version tried tab 11 alone and gave up.
  tabsOpen = [
    booked(11, { active: true, lastAccessed: 30 }),
    booked(12, { lastAccessed: 20 }),
    booked(13, { lastAccessed: 10 })
  ];
  responder = (id) => {
    if (id !== 13) throw new Error("Could not establish connection. Receiving end does not exist.");
    return { tripsFound: 7 };
  };
  sent = [];
  const recovered = await runManualScan();
  h.ok("dead Booked tabs no longer fail the whole scan", recovered.ok);
  h.is("it reports what the tab that answered actually found", recovered.tripsFound, 7);
  h.is("and it kept trying, in priority order, until one answered", sent, [11, 12, 13]);
  h.is("a scan that worked also kicks the detail queue", queueKicked, 1);

  // Every tab disconnected is a different problem from no tab being open:
  // refresh the page you have, versus open the page at all.
  sent = [];
  responder = () => { throw new Error("Receiving end does not exist."); };
  const dead = await runManualScan();
  h.is("with every Booked tab disconnected it says exactly that", dead.reason, "no-listener");
  h.is("and counts them, so the message can say how many to refresh", dead.tabsTried, 3);
  h.is("a failed scan never kicks the detail queue", queueKicked, 1);

  // A content script that died before registering its listener leaves the
  // port closing with no reply. Reporting that as a successful scan that
  // found zero cards would look like an answer.
  tabsOpen = [booked(21, { active: true })];
  responder = () => undefined;
  h.is("a tab that answers with nothing is a failure, not zero reservations",
    (await runManualScan()).reason, "no-listener");

  tabsOpen = [{ id: 3, url: "https://turo.com/us/en/vehicles", active: true }];
  h.is("a Turo tab that is not the Booked page is still no Booked tab",
    (await runManualScan()).reason, "no-booked-tab");
}

async function scrapeQueueSuite() {
  h.suite("one background scan tab at a time");
  let currentScrape = null;
  let startingScrape = false;
  // Resolves before any tab is created; the real worker uses this to avoid
  // racing its own startup orphan sweep.
  let sweepFinished = false;
  let orphanSweep = Promise.resolve().then(() => { sweepFinished = true; });
  let scrapeStats = { completed: 0, failed: 0 };
  let lastEligibleCount = 0;
  const DETAIL_TAB_TIMEOUT_MS = 30000;
  const opened = [];
  const isPaused = async () => false;
  const setDetailStatus = async () => {};
  const recordAttempt = async () => {};
  const backgroundScanUrl = (url) => url + "?hostos_bg=1";
  const eligibleForDetailScan = () => true;
  global.chrome = {
    storage: { local: { get: async () => ({ hostosTrips: [
      { reservationId: "a", tripUrl: "https://turo.com/us/en/reservation/1" },
      { reservationId: "b", tripUrl: "https://turo.com/us/en/reservation/2" }
    ] }) } },
    tabs: {
      create: async (opts) => { opened.push(opts.url); return { id: 100 + opened.length }; },
      remove: () => {}
    }
  };
  eval(h.extractFunction(sw, "maybeStartNextScrape"));

  const quiet = console.log;
  console.log = () => {};
  // chrome.storage.onChanged fires on every list scan, so these really do land
  // together. Every await in here used to be a window where a second call
  // cleared the guard and opened a second tab that nothing tracked.
  await Promise.all([maybeStartNextScrape(), maybeStartNextScrape(), maybeStartNextScrape()]);
  console.log = quiet;
  h.is("three triggers in one tick open exactly one background tab", opened.length, 1);
  // The startup sweep closes every hostos_bg tab it cannot account for, and it
  // snapshots the tab list before currentScrape is assigned. A scrape starting
  // inside that window used to get its own new tab swept away, leaving the
  // queue tracking a dead tab until the 30s timeout.
  h.ok("and it waited for the startup orphan sweep before opening it", sweepFinished);
  h.ok("and it is tracked, so something can still close it",
    currentScrape !== null && currentScrape.tabId === 101);
  if (currentScrape) clearTimeout(currentScrape.timeoutId);
}

// Two "Premier plan booked" emails arrived for reservation 61156935 - the
// first with "unknown -> unknown" dates, the second with the real ones. That
// is alertPremierTrips running twice either side of the detail scan that
// filled those dates in: it fires from chrome.storage.onChanged on
// hostosTrips, and the detail scan WRITES hostosTrips. The old code read
// hostosAlerted, awaited a slow round-trip to Apps Script, and only wrote the
// dedupe key once every send had finished - so the second run read the map
// before the first had written to it.
//
// This is driven rather than grepped for on purpose. The previous assertion
// checked that the source still contained the mark-on-success line, which was
// true the whole time the live code was sending Matt duplicates.
async function premierAlertSuite() {
  h.suite("a Premier alert is sent exactly once per reservation");

  let store = {};
  let sends = [];
  let claimedWhenSent = [];
  let sendResult = { ok: true };
  global.chrome = { storage: { local: {
    get: async (key) => ({ [key]: store[key] }),
    set: async (patch) => { Object.assign(store, patch); }
  } } };

  const DEDUPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const hasNotStarted = (trip) => HostOS.dates.hasNotStarted(trip);
  const isCancelled = (trip) => HostOS.dates.isCancelled(trip);
  const parseTime = (value) => HostOS.dates.parseTime(value);
  const tripSummary = (trip) => trip;
  // Deliberately slow, like the real Apps Script round-trip. The window this
  // suite exists for is only open while a send is in flight.
  const postAlert = async (payload) => {
    const key = payload.trip.reservationId + ":premier";
    claimedWhenSent.push(Boolean((store.hostosAlerted || {})[key]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    sends.push(payload.trip.reservationId);
    return sendResult;
  };
  let alertPremierInFlight = null;
  eval(h.extractFunction(sw, "prune"));
  eval(h.extractFunction(sw, "isPremier"));
  eval(h.extractFunction(sw, "isUpcomingOrBrandNew"));
  eval(h.extractFunction(sw, "alertPremierTripsInner"));
  eval(h.extractFunction(sw, "alertPremierTrips"));

  const brandNew = { reservationId: "61156935", protectionLevel: "SUPREME", pickupDate: null, returnDate: null,
    bookedAt: Date.now() - 60000 };
  const scanned = { ...brandNew, pickupDate: day(4), returnDate: day(8) };

  // The reported failure, arranged so the old code provably fails it: the
  // feed finds the booking, and the detail scan lands while that email is
  // still in flight.
  await Promise.all([alertPremierTrips([brandNew]), alertPremierTrips([scanned])]);
  h.is("the detail scan landing mid-send does not send a second email", sends, ["61156935"]);
  h.is("and the email went out with the claim already written, not after it",
    claimedWhenSent, [true]);

  await alertPremierTrips([scanned]);
  h.is("nor does any later scan", sends, ["61156935"]);

  // The property the mark-on-success version was protecting, kept: a claim is
  // released again for a send that genuinely failed.
  store = {}; sends = []; claimedWhenSent = [];
  sendResult = { ok: false, reason: "HTTP 500" };
  await alertPremierTrips([brandNew]);
  h.is("a failed send leaves nothing claimed", Object.keys(store.hostosAlerted || {}), []);

  sendResult = { ok: true };
  await alertPremierTrips([scanned]);
  h.is("so an undelivered Premier alert is retried, not lost", sends, ["61156935", "61156935"]);

  await alertPremierTrips([scanned]);
  h.is("and once it lands it stops", sends, ["61156935", "61156935"]);

  // A Premier trip already on rent cannot be cancelled, so there is nothing to
  // alert about - this is the guard that keeps the fast path from alerting on
  // every trip that happens to have no pickup date yet.
  store = {}; sends = [];
  await alertPremierTrips([{ reservationId: "9", protectionLevel: "SUPREME", pickupDate: null, returnDate: day(3) }]);
  h.is("a trip already on rent is not alerted at all", sends, []);

  // The 9/10 failure exactly: a Premier reservation Matt cancelled two days
  // earlier, no dates, no booking time - and then the same one with the
  // struck-through dates a detail scan might still read off the page.
  store = {}; sends = [];
  await alertPremierTrips([{ reservationId: "61109808", protectionLevel: "SUPREME", pickupDate: null, returnDate: null }]);
  await alertPremierTrips([{ reservationId: "61109808", protectionLevel: "SUPREME", pickupDate: day(10), returnDate: day(17), cancelled: true }]);
  h.is("a cancelled Premier reservation is never emailed, with or without dates (61109808)", sends, []);
}

scanNowSuite()
  .then(scrapeQueueSuite)
  .then(premierAlertSuite)
  .then(h.summary, (error) => { console.error(error); process.exit(1); });
