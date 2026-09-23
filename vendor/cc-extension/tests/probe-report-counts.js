// Paste into the console on the EXTENSION'S OPTIONS PAGE
// (chrome-extension://…/options/options.html — F12 there, not on a Turo tab).
//
// Why: the panel showed 5 Unverified Licenses and 7 Profit Risks, and the 5:35
// report said 0 and 0. Those two surfaces are supposed to agree, and for
// licenses they run a byte-identical filter — so either the data changed
// between the two moments, or one of the counts is lying. Guessing which would
// be exactly the mistake this project keeps paying for.
//
// This runs BOTH filters over the SAME trips at the SAME instant and prints
// where they diverge, trip by trip. Reservation ids only — no guest names.

(async () => {
  const { hostosTrips: trips = [] } = await chrome.storage.local.get("hostosTrips");
  const now = Date.now();
  const parse = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) && t > 0 ? t : null; };
  const inLicenseWindow = (v) => { const t = parse(v); if (t === null) return false; const d = t - now; return d >= 0 && d <= 864e5; };
  const notStarted = (t) => { const p = parse(t.pickupDate); return p !== null && p > now; };
  const isPremier = (t) => t.protectionLevel === "SUPREME"
    || (typeof t.guestMaxOutOfPocket === "number" && t.guestMaxOutOfPocket === 0);
  const hours = (v) => { const t = parse(v); return t === null ? "no date" : ((t - now) / 3600000).toFixed(1) + "h"; };

  console.log("%cHostOS — why did the report say none?", "font:600 14px system-ui");
  console.log("trips in storage:", trips.length, "· now:", new Date(now).toLocaleString());

  // --- Licenses. The panel and the report run the SAME test, so any
  // difference here is the data moving, not the rule.
  const licenseUnverified = trips.filter((t) => t.licenseVerified === false);
  const licenseInWindow = licenseUnverified.filter((t) => inLicenseWindow(t.pickupDate));
  console.log("\n--- UNVERIFIED LICENSES ---");
  console.log("licenseVerified === false ............", licenseUnverified.length);
  console.log("…of those, pickup inside 24h .........", licenseInWindow.length, "  <- what BOTH panel and report count");
  console.log("(a pickup that has already passed drops out of the window — that is by design)");
  licenseUnverified.slice(0, 15).forEach((t) => {
    console.log("   #" + t.reservationId, "pickup in", hours(t.pickupDate),
      inLicenseWindow(t.pickupDate) ? "  COUNTED" : "  outside window");
  });

  // --- Profit risk. These filters genuinely DIFFER: the panel includes
  // Premier trips, the report deliberately excludes them because Premier gets
  // its own urgent email. So a gap here can be completely correct.
  const cancelled = trips.filter((t) => t.cancelled === true);
  console.log("\n--- CANCELLED (flagged so far) ---");
  console.log("reservations marked cancelled ........", cancelled.length);
  cancelled.slice(0, 15).forEach((t) => console.log("   #" + t.reservationId, t.cancelledSignal || "", "pickup in", hours(t.pickupDate)));

  const panelEarnings = trips.filter((t) => (t.earningsRisk || t.premierProtection) && notStarted(t));
  const reportRate = trips.filter((t) => t.earningsRisk && !isPremier(t) && notStarted(t));
  const undecided = trips.filter((t) => t.earningsUndecided === true && !isPremier(t) && notStarted(t));
  console.log("\n--- PROFIT RISK ---");
  console.log("panel  (earningsRisk || premierProtection) && upcoming .....", panelEarnings.length);
  console.log("report  earningsRisk && !premier && upcoming ...............", reportRate.length);
  console.log("report  COULD NOT PRICE (earningsUndecided) ...............", undecided.length);
  console.log("\nbreakdown of what the panel is counting:");
  panelEarnings.slice(0, 15).forEach((t) => {
    console.log("   #" + t.reservationId,
      "cancelled=" + (t.cancelled === true) + (t.cancelledSignal ? " (" + t.cancelledSignal + ")" : ""),
      "earningsRisk=" + Boolean(t.earningsRisk),
      "premier=" + isPremier(t),
      "earningsPerMile=" + (t.earningsPerMile === undefined ? "never computed" : t.earningsPerMile),
      "pickup in " + hours(t.pickupDate));
  });

  // Has the pricing sweep actually run? earningsRisk is STORED, written only
  // by that sweep — if earningsPerMile is missing fleet-wide, nothing can be
  // flagged no matter how thin the trips are.
  const priced = trips.filter((t) => typeof t.earningsPerMile === "number");
  console.log("\n--- has the pricing sweep run? ---");
  console.log("trips with earningsPerMile computed ...", priced.length, "of", trips.length);
  console.log("trips flagged earningsRisk ............", trips.filter((t) => t.earningsRisk).length);
  console.log("trips flagged premierProtection .......", trips.filter((t) => t.premierProtection).length);

  const upcoming = trips.filter(notStarted);
  console.log("\nupcoming trips at all:", upcoming.length,
    "(if this is 0, the list scan has not re-run since the reload)");

  const { hostosAlertStatus } = await chrome.storage.local.get("hostosAlertStatus");
  console.log("\n--- last alert ---");
  console.log(hostosAlertStatus || "none recorded");
  console.log("\nDone. Copy this whole output back to Claude.");
})();
