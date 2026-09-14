// The shared modules are LOADED here, not hand-copied. parseTime,
// hasNotStarted, isWithinLicenseUploadWindow and DETAIL_SCAN_VERSION used to
// exist twice — once in utils/, once inline here — kept aligned by "keep in
// sync" comments. The copies drifted more than once: the tripStatus fix and
// the null-date fix each had to be applied in two places, and missing the
// second copy was a real bug both times.
//
// importScripts is synchronous, so everything below can use HostOS.* right
// away. Paths are root-relative so they don't depend on this file's location.
// self.window aliases the global the modules expect, since they're written
// for a page context.
self.window = self;
importScripts("/utils/constants.js", "/utils/dates.js", "/utils/parser.js", "/utils/reviews.js", "/utils/outlook.js");

const parseTime = (value) => HostOS.dates.parseTime(value);
const isWithinLicenseUploadWindow = (value) => HostOS.dates.isWithinLicenseUploadWindow(value);
const hasNotStarted = (trip) => HostOS.dates.hasNotStarted(trip);
const isCancelled = (trip) => HostOS.dates.isCancelled(trip);

const DETAIL_RESCAN_MS = 30 * 60 * 1000;
// A trip currently showing as a risk gets rechecked far more often than a
// routine already-clear one — the cost of a 30-minute-stale false positive
// (a host still seeing "unconfirmed license" after the guest fixed it
// minutes ago) is much higher than the cost of scanning a flagged trip a
// bit more frequently.
const FLAGGED_RESCAN_MS = 5 * 60 * 1000;
const DETAIL_SCAN_VERSION = HostOS.constants.DETAIL_SCAN_VERSION;
// Content.js's own in-page wait for Turo's data to actually render can run
// up to 15s before it gives up — this outer timeout needs real headroom
// beyond that for the tab to open, navigate, and the completion message to
// round-trip back, or it would cut the inner wait off early every time.
const DETAIL_TAB_TIMEOUT_MS = 30000;
// After this many consecutive scans that never rendered, a trip stops bypassing
// the rescan cooldown and waits its turn like everything else. Bypassing exists
// for a page that was merely slow; a page that CANNOT render - an unopenable
// receipt, a deleted reservation, a Turo outage - would otherwise be retried on
// every single pass, and the queue is single-flight, so one of them starves
// every other trip. It still retries on the ordinary 30-minute cadence, so a
// transient failure recovers on its own.
const MAX_DETAIL_SCAN_FAILURES = 3;
const DETAIL_QUEUE_ALARM = "hostosDetailQueue";

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#5AA9FF" });
});

// Makes the toolbar icon open the persistent side panel (stays open across
// tab switches, unlike a popup that closes the instant you click away)
// instead of a transient popup. Runs every time the service worker wakes
// up — chrome.sidePanel.setPanelBehavior is idempotent, so no separate
// onInstalled-only registration is needed.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Runs every time the service worker wakes up (install, browser start, or
// after being suspended) — chrome.alarms.create is idempotent by name, so
// this just keeps the periodic detail-scan alarm alive rather than needing
// a separate onInstalled/onStartup registration.
chrome.alarms.create(DETAIL_QUEUE_ALARM, { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DETAIL_QUEUE_ALARM) maybeStartNextScrape();
  if (alarm.name === DIGEST_ALARM) maybeSendDigest();
  if (alarm.name === PROTECTION_ALARM) sweepProtection();
});

// chrome.notifications rejects a relative iconUrl from a service worker with
// "Unable to download all specified images" — the worker has no page to
// resolve it against. Seen live in the service worker console as repeated
// unhandled rejections, meaning every Chrome notification was failing
// silently. getURL gives the absolute chrome-extension:// path.
//
// Wrapped as well, because a notification is the least important thing this
// loop does: a failure here must never abort the badge update or the alert
// bookkeeping that follows it.
const NOTIFICATION_ICON = chrome.runtime.getURL("assets/icon-128.png");

async function notify(key, title, message) {
  try {
    await chrome.notifications.create(key, {
      type: "basic", iconUrl: NOTIFICATION_ICON, title, message
    });
    return true;
  } catch (error) {
    console.warn("[HostOS] Notification failed.", error);
    return false;
  }
}

// A booking found through the activity feed has NO dates yet - its card has
// not rendered anywhere - and hasNotStarted is deliberately false for an
// unknown pickup ("an unknown pickup cannot be claimed as upcoming"). Gating
// the Premier alert on hasNotStarted therefore defeated the entire point of
// that feed: it exists to catch a Premier plan within about a minute of
// booking, and instead the alert sat waiting for a detail scan to fill the
// dates in - a background tab, a queue position, and possibly a long wait.
//
// A trip with NEITHER date is a brand-new booking rather than one already
// running: an active trip still yields a returnDate from its "Ending at"
// card, so this cannot fire for a trip on rent. And if one somehow has
// started, the cost is a single message - weighed against a Premier booking
// going unmentioned, which is the damage Matt could not bill anyone for.
function isUpcomingOrBrandNew(trip) {
  if (hasNotStarted(trip)) return true;
  // "Brand new" has to mean the BOOKING is new, not the record. Reservation
  // 61109808 was booked, cancelled by Matt on 9/8, and then stood up by a
  // late-processed feed event on 9/10 with no dates - and the old rule read
  // "no dates" as "just booked" and emailed URGENT about it, twice. The feed
  // stamps the booking's own time (bookedAt); a record without one, or one
  // whose booking is older than a day, waits for a detail scan to supply real
  // dates like any other trip. That is one scan of delay for the rare live
  // case, against an urgent email about a trip that does not exist.
  if (trip.pickupDate || trip.returnDate || isCancelled(trip)) return false;
  const booked = parseTime(trip.bookedAt);
  return booked !== null && Date.now() - booked <= HostOS.constants.BRAND_NEW_BOOKING_MS;
}

async function notifyForTrips() {
  const { hostosTrips: trips = [], hostosNotified = {}, hostosReviews: reviewRecords = {} } =
    await chrome.storage.local.get(["hostosTrips", "hostosNotified", "hostosReviews"]);
  const nextNotified = { ...hostosNotified };
  let actionableCount = 0;
  // License and earnings risk are independent conditions, so a trip flagged
  // for both needs its own notification key per risk type — keying only on
  // reservationId (with a license/earnings ternary) meant a trip with both
  // risks simultaneously only ever notified for license, never earnings.
  for (const trip of trips) {
    const licenseDue = !isCancelled(trip)
      && trip.licenseVerified === false && isWithinLicenseUploadWindow(trip.pickupDate);
    // isPremier is checked alongside earningsRisk because sweepProtection
    // writes the plan fields without running riskEngine, so a Premier trip
    // found while no Turo tab was open has earningsRisk still false.
    const earningsDue = (trip.earningsRisk || isPremier(trip)) && isUpcomingOrBrandNew(trip);
    if (!licenseDue && !earningsDue) continue;
    actionableCount += 1;
    if (licenseDue) {
      const key = trip.reservationId + ":license";
      if (!nextNotified[key]) {
        // Only remembered as "told you" when it actually appeared, so a
        // failed notification retries instead of being lost.
        if (await notify(key, "Unverified license",
          (trip.guestName || trip.vehicle || "Reservation") + " has an unverified license.")) {
          nextNotified[key] = Date.now();
        }
      }
    }
    if (earningsDue) {
      const key = trip.reservationId + ":earnings";
      if (!nextNotified[key]) {
        // Premier is its own tile now, so its notification says so rather than
        // "Profit risk" - the thing to do about it is cancel, not reprice.
        if (await notify(key, isPremier(trip) ? "Premier plan booked" : "Profit risk",
          (trip.guestName || trip.vehicle || "Reservation") + ": " + ((trip.riskReasons || []).join(", ")
            || (isPremier(trip) ? "$0 out-of-pocket for the guest - cancel before pickup" : "below $0.20/mile")))) {
          nextNotified[key] = Date.now();
        }
      }
    }
  }
  // Reviews waiting on Matt. Counted on the badge like the other queues, and
  // reminded about twice: once a day while anything is waiting, and once per
  // trip when its window is about to close - the two moments the spec asked
  // for. Matt's stated failure is forgetting, so the daily one is the
  // important one and it says how many.
  const waiting = HostOS.reviews.pending(trips, reviewRecords);
  actionableCount += waiting.length;
  if (waiting.length) {
    const dayKey = "reviews:" + coloradoNow().date;
    if (!nextNotified[dayKey]) {
      const text = waiting.length + (waiting.length === 1 ? " guest" : " guests") + " waiting for a review.";
      if (await notify(dayKey, "Post-trip reviews", text)) nextNotified[dayKey] = Date.now();
    }
    for (const entry of waiting) {
      if (entry.state !== "pending") continue;
      const left = HostOS.reviews.daysLeft(entry.trip);
      if (left === null || left > 1) continue;
      const key = entry.trip.reservationId + ":review-expiring";
      if (nextNotified[key]) continue;
      if (await notify(key, "Review window closing",
        (entry.trip.guestName || entry.trip.vehicle || "A trip") + " can only be rated for about one more day.")) {
        nextNotified[key] = Date.now();
      }
    }
  }
  await chrome.action.setBadgeText({ text: actionableCount ? String(actionableCount) : "" });
  await chrome.storage.local.set({ hostosNotified: prune(nextNotified) });
}

// These "already told you" maps only ever gained keys, one per trip per risk
// type, for the life of the install. Reservations are finished and gone long
// before 90 days, so anything older can't suppress a live alert.
const DEDUPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
function prune(map) {
  const cutoff = Date.now() - DEDUPE_TTL_MS;
  const kept = {};
  Object.entries(map).forEach(([key, at]) => { if (typeof at === "number" && at >= cutoff) kept[key] = at; });
  return kept;
}

// --- Outbound alerts ------------------------------------------------------
//
// Matt (the fleet owner) needs to hear about a guest buying the Premier plan
// so he can cancel before pickup — that plan's $0 out-of-pocket maximum means
// he cannot bill the guest for damage and recovers nothing.
//
// Alerts go to a Google Apps Script web app rather than an email API called
// directly. The extension folder is readable by anyone it's shared with, so
// an embedded SendGrid/Twilio key could be lifted and used to send mail as
// the company. A deploy URL is write-only, rotatable, and useless for
// anything but posting here.
const DIGEST_ALARM = "hostosDailyDigest";
// 9 PM Colorado, timed to land as John clocks out — it's his turnover report.
// Pinned to America/Denver rather than the machine's clock, because "9 PM
// Colorado time" is the requirement and whoever runs this may not be sitting
// in Colorado.
const DIGEST_TIMEZONE = "America/Denver";
const DIGEST_HOUR = 21;

// Current date and hour in Colorado. The date doubles as the "already sent
// today" key, so a machine in another timezone can't roll it over early or
// late.
function coloradoNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DIGEST_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return {
    date: value("year") + "-" + value("month") + "-" + value("day"),
    // Some engines render midnight as "24"; normalise so the comparison holds.
    hour: Number(value("hour")) % 24
  };
}

const COMPANY = "Colorado Cruisers";
// Bump whenever the relay contract changes (NOT when wording changes — that's
// the whole point of composing here). Surfaced on the options page so a stale
// deployment is visible instead of silently sending the old format.
// v5 of the relay can attach the logo inline; v4 and earlier cannot, and the
// masthead stays typographic for them.
const SCRIPT_VERSION = 7;
const LOGO_ASSET = "assets/colorado-cruisers.png";

// Subject and body are built HERE, not in the Apps Script. The script used to
// own the wording, which meant every copy change required re-pasting it into
// script.google.com AND cutting a new deployment version — and forgetting the
// second step silently kept sending the old emails. The script is now a dumb
// relay: it takes recipients/subject/body and sends them. Wording changes from
// now on need only an extension reload.
function formatTripTime(value) {
  const time = parseTime(value);
  if (time === null) return "unknown";
  // Shown in Colorado time so the whole team reads the same clock.
  return new Date(time).toLocaleString("en-US", {
    timeZone: DIGEST_TIMEZONE, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

// The guest's track record, inline after their name. A 1.0-star guest on
// their first trip is exactly the combination that cost Matt a windshield,
// and it belongs in the email rather than only in the panel.
function guestRecord(trip) {
  if (typeof trip.guestRating !== "number" && !trip.guestTripCount) return "";
  const rating = typeof trip.guestRating === "number" && trip.guestRatingCount
    ? trip.guestRating.toFixed(1) + "★"
    : "no ratings yet";
  const trips = (trip.guestTripCount || 0) + (trip.guestTripCount === 1 ? " trip" : " trips");
  return "  (" + rating + ", " + trips + " as a guest)";
}

function composePremier(trip) {
  return {
    subject: COMPANY + " - URGENT: Premier plan booked - " + trip.vehicle,
    body: [
      COMPANY,
      "",
      "A guest booked the " + (trip.plan || "Premier") + " protection plan on an UPCOMING trip.",
      "",
      "Their out-of-pocket maximum is $0, so damage cannot be billed to them.",
      "Cancel before pickup if you don't want that exposure.",
      "",
      "Guest:       " + trip.guest + guestRecord(trip),
      "Vehicle:     " + trip.vehicle + (trip.plate ? " (" + trip.plate + ")" : ""),
      "Reservation: #" + trip.reservationId,
      "Pickup:      " + formatTripTime(trip.pickup),
      "Return:      " + formatTripTime(trip.returnDate),
      "",
      trip.url || ""
    ].join("\n")
  };
}

function composeDigest(payload) {
  const lines = [COMPANY, "Nightly turnover report - " + payload.date, ""];
  if (payload.outlook) {
    lines.push("EARNINGS OUTLOOK (net of Turo's cut, counted when each trip ends)");
    [payload.outlook.week, payload.outlook.month, payload.outlook.ahead].forEach((window) => {
      lines.push("  " + window.label + ": " + HostOS.outlook.describe(window));
    });
    lines.push("");
  }
  lines.push("BELOW $0.20/MILE (" + payload.rateRisks.length + ")");
  if (!payload.rateRisks.length) lines.push("  none");
  payload.rateRisks.forEach((trip) => {
    lines.push("  #" + trip.reservationId + "  " + trip.vehicle + "  " + trip.guest);
    lines.push("      pickup " + formatTripTime(trip.pickup) + "  ->  return " + formatTripTime(trip.returnDate));
    (trip.reasons || []).forEach((reason) => lines.push("      - " + reason));
  });
  lines.push("");
  // Named rather than asserted. Every figure here is a floor - the trip can
  // only be worth MORE - so calling one of these a profit risk would repeat
  // exactly the mistake that has cost three corrections already.
  const unpriced = payload.unpriced || [];
  lines.push("COULD NOT PRICE (" + unpriced.length + ")");
  if (!unpriced.length) lines.push("  none");
  unpriced.forEach((trip) => {
    lines.push("  #" + trip.reservationId + "  " + trip.vehicle + "  " + trip.guest);
    lines.push("      pickup " + formatTripTime(trip.pickup) + "  ->  return " + formatTripTime(trip.returnDate));
    const missing = trip.missing || [];
    lines.push("      would read below $0.20/mile, but " + (missing.join(" and ") || "an input")
      + (missing.length > 1 ? " were" : " was") + " never read from Turo"
      + " - the real figure can only be higher");
  });
  lines.push("");
  lines.push("UNVERIFIED LICENSES, PICKUP WITHIN 24H (" + payload.licenseRisks.length + ")");
  if (!payload.licenseRisks.length) lines.push("  none");
  payload.licenseRisks.forEach((trip) => {
    lines.push("  #" + trip.reservationId + "  " + trip.vehicle + "  " + trip.guest);
    lines.push("      pickup " + formatTripTime(trip.pickup));
  });
  // Every Premier booking still ahead of us, each already alerted the moment
  // it was found. Listed so the report matches the panel's Profit Risk count
  // and reads as a checklist of what is still to cancel and rebook.
  const premier = payload.premier || [];
  lines.push("");
  lines.push("PREMIER PLAN, ALREADY ALERTED (" + premier.length + ")");
  if (!premier.length) lines.push("  none");
  premier.forEach((trip) => {
    lines.push("  #" + trip.reservationId + "  " + trip.vehicle + "  " + trip.guest);
    lines.push("      pickup " + formatTripTime(trip.pickup) + "  ->  return " + formatTripTime(trip.returnDate));
    lines.push("      - $0 out-of-pocket for the guest; cancel and have them rebook if not already done");
  });
  const reviews = payload.reviews || [];
  lines.push("");
  lines.push("REVIEWS WAITING ON YOU (" + reviews.length + ")");
  if (!reviews.length) lines.push("  none");
  reviews.forEach((trip) => {
    lines.push("  #" + trip.reservationId + "  " + trip.vehicle + "  " + trip.guest);
    lines.push(trip.ready
      ? "      GUEST RATED YOU - \"" + (trip.guestQuote || "") + "\" - rate them back"
      : "      waiting on the guest's 5-star review first");
    lines.push("      not rated yet" + (typeof trip.daysLeft === "number"
      ? " - " + (trip.daysLeft <= 0 ? "last day" : trip.daysLeft + " day" + (trip.daysLeft === 1 ? "" : "s") + " left") + " of Turo's " + HostOS.constants.REVIEW_WINDOW_DAYS + "-day window" : ""));
    if (trip.signals && trip.signals.length) lines.push("      - Turo's data: " + trip.signals.join(", "));
  });
  // Says what the Premier section is and is not. A NEW Premier booking is
  // emailed the moment it is found, because waiting until 9 PM would be too
  // late to cancel it; this list is the recap, not the alert.
  lines.push("");
  lines.push("-".repeat(62));
  lines.push("A NEW Premier plan booking ($0 out-of-pocket) gets its own URGENT");
  lines.push("email the moment it is found, so it can be cancelled before pickup.");
  lines.push("The Premier section above only recaps the ones still on the books.");
  lines.push("No separate email today means no new Premier bookings.");
  const subject = COMPANY + " - Nightly turnover report - " + payload.date
    + (payload.preview ? " (PREVIEW)" : "");
  return { subject, body: lines.join("\n") };
}

// --- HTML report ----------------------------------------------------------
// The plain-text body is still sent, and is still what an older relay
// deployment (SCRIPT_VERSION < 4) delivers. This is the rich version, and it
// mirrors the Profit Risk card in the panel deliberately: the same labelled
// rows in the same order, so a figure means the same thing in both places.
//
// Email HTML is not page HTML. No flexbox, no grid, no stylesheet - Gmail
// strips most of that - so this is tables with inline styles, which every mail
// client renders the same way. Colours are set explicitly on every cell so a
// client's own dark mode cannot invert half a card.
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function reportMoney(value) {
  const number = HostOS.parser.number(value);
  if (number === null) return null;
  return "$" + Math.round(number).toLocaleString("en-US");
}

const REPORT_AMBER = "#ff9f0a";
const REPORT_RED = "#ff6b5e";
const REPORT_WHITE = "#f5f5f7";
const REPORT_MUTED = "#8e8e93";

function reportStrong(text, colour) {
  return "<span style=\"color:" + colour + ";font-weight:700;\">" + escapeHtml(text) + "</span>";
}

// One labelled row, matching the card: small grey label, value beside it.
function htmlRow(label, valueHtml) {
  if (!valueHtml) return "";
  return "<tr>"
    + "<td style=\"padding:3px 10px 3px 0;vertical-align:top;white-space:nowrap;"
    + "font:700 10px Arial,sans-serif;letter-spacing:.06em;color:" + REPORT_MUTED + ";\">"
    + escapeHtml(label) + "</td>"
    + "<td style=\"padding:3px 0;vertical-align:top;font:12px Arial,sans-serif;color:#c7c7cc;line-height:1.45;\">"
    + valueHtml + "</td></tr>";
}

function htmlTripCard(trip, badge, badgeColour) {
  const rows = [];

  const earnings = reportMoney(trip.earnings);
  if (earnings) {
    let line = reportStrong(earnings, REPORT_AMBER);
    if (trip.days) line += " &middot; " + escapeHtml(trip.days + (trip.days === 1 ? " day" : " days"));
    const perDay = reportMoney(trip.perDay);
    if (perDay) line += " &middot; ~" + reportStrong(perDay, REPORT_AMBER) + "/day";
    line += " &middot; after discounts and Turo&#39;s cut"
      + (typeof trip.takeRate === "number" ? " (" + Math.round(trip.takeRate * 100) + " plan)" : "");
    rows.push(htmlRow("EARNINGS", line));
  }

  // Never a silent zero: an unread extras list is said out loud, exactly as the
  // card does, because the earnings above are then only a floor.
  // Name the missing inputs outright rather than making the reader work out
  // which one it was. This is the row John had to ask about.
  const missing = trip.missing || [];
  if (missing.length) {
    rows.push(htmlRow("NOT READ", "<span style=\"color:" + REPORT_AMBER + ";\">"
      + escapeHtml(missing.join(" and ")) + " could not be read from Turo &mdash; earnings above are a "
      + "minimum, the real figure can only be higher</span>"));
  } else if (trip.extrasChecked === false) {
    rows.push(htmlRow("EXTRAS", "<span style=\"color:" + REPORT_AMBER
      + ";\">not read yet &mdash; earnings above are a minimum, the real figure can only be higher</span>"));
  } else if (HostOS.parser.number(trip.extras) > 0) {
    rows.push(htmlRow("EXTRAS", reportStrong(reportMoney(trip.extras), REPORT_AMBER)
      + (trip.extrasLabel ? " &middot; " + escapeHtml(trip.extrasLabel) : "")));
  } else {
    // An answer even when the answer is zero - see the panel card. An absent
    // row cannot be told apart from one that failed to render.
    rows.push(htmlRow("EXTRAS", "None bought"));
  }

  if (HostOS.parser.number(trip.delivery) > 0) {
    rows.push(htmlRow("DELIVERY", reportStrong(reportMoney(trip.delivery), REPORT_AMBER) + " fee"
      + (trip.deliverySource === "standing" ? " &middot; your standing rate, not read from Turo" : "")));
  } else {
    rows.push(htmlRow("DELIVERY", "None"));
  }

  const perMile = HostOS.parser.number(trip.perMile);
  if (perMile !== null) {
    let line = reportStrong("$" + perMile.toFixed(2), REPORT_RED) + "/mi earned";
    if (trip.miles) line += " across " + escapeHtml(Number(trip.miles).toLocaleString("en-US")) + " mi included";
    rows.push(htmlRow("PER MILE", line));
  }

  if (trip.plan) {
    const excess = reportMoney(trip.planExcess);
    rows.push(htmlRow("PLAN", escapeHtml(trip.plan)
      + (excess ? " &middot; " + reportStrong(excess, REPORT_RED) + " excess" : "")));
  }

  if (trip.guestRatingCount === 0) {
    rows.push(htmlRow("GUEST", "<span style=\"color:" + REPORT_RED + ";\">No ratings yet &middot; "
      + escapeHtml(trip.guestTripCount || 0) + " trips</span>"));
  } else if (typeof trip.guestRating === "number") {
    rows.push(htmlRow("GUEST", escapeHtml(trip.guestRating.toFixed(1)) + "&#9733; from "
      + escapeHtml(trip.guestRatingCount) + " ratings &middot; "
      + escapeHtml(trip.guestTripCount || 0) + " trips"));
  }

  (trip.reasons || []).forEach((reason) => {
    rows.push(htmlRow("WHY", "<span style=\"color:" + REPORT_RED + ";\">" + escapeHtml(reason) + "</span>"));
  });

  const tripWindow = escapeHtml(formatTripTime(trip.pickup)) + " &rarr; " + escapeHtml(formatTripTime(trip.returnDate));
  const link = trip.url
    ? "<tr><td colspan=\"2\" style=\"padding:11px 0 0;\"><a href=\"" + escapeHtml(trip.url)
      + "\" style=\"display:inline-block;padding:7px 13px;border-radius:8px;background:#5aa9ff;"
      + "color:#07111e;font:700 12px Arial,sans-serif;text-decoration:none;\">Open trip</a></td></tr>"
    : "";

  return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\""
    + " style=\"margin:0 0 12px;background:#181c24;border:1px solid #2b3e5a;border-radius:14px;\">"
    + "<tr><td style=\"padding:14px 16px;\">"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\">"
    + "<tr><td style=\"font:700 15px Arial,sans-serif;color:" + REPORT_WHITE + ";\">"
    + escapeHtml(trip.guest || "Guest") + "</td>"
    + "<td align=\"right\" style=\"font:700 10px Arial,sans-serif;letter-spacing:.06em;color:"
    + badgeColour + ";\">" + escapeHtml(badge) + "</td></tr>"
    + "<tr><td colspan=\"2\" style=\"padding:3px 0 9px;font:12px Arial,sans-serif;color:" + REPORT_MUTED + ";\">"
    + escapeHtml(trip.vehicle || "Vehicle") + (trip.plate ? " &middot; " + escapeHtml(trip.plate) : "")
    // The reservation number, which the plain-text report has always carried
    // and the card did not. It is what you search Turo by, what you quote to a
    // guest, and the only way to identify the trip at all if the link below is
    // ever missing.
    + (trip.reservationId ? " &middot; #" + escapeHtml(trip.reservationId) : "")
    + "<br>" + tripWindow + "</td></tr>"
    + rows.join("") + link
    + "</table></td></tr></table>";
}

function htmlReviewCard(trip) {
  const badge = trip.ready ? "GUEST RATED YOU"
    : typeof trip.daysLeft === "number" ? (trip.daysLeft <= 0 ? "LAST DAY" : trip.daysLeft + (trip.daysLeft === 1 ? " DAY LEFT" : " DAYS LEFT"))
    : "WAITING ON GUEST";
  const colour = trip.ready ? "#30d158" : typeof trip.daysLeft === "number" && trip.daysLeft <= 2 ? REPORT_RED : REPORT_AMBER;
  const rows = [
    htmlRow("TRIP", escapeHtml(formatTripTime(trip.pickup)) + " &rarr; " + escapeHtml(formatTripTime(trip.returnDate))),
    htmlRow("STATUS", trip.ready
      ? reportStrong("Guest rated you &mdash; rate them back", "#30d158") + (trip.guestQuote ? " &ldquo;" + escapeHtml(trip.guestQuote) + "&rdquo;" : "")
      : "Waiting on the guest&rsquo;s 5-star review first"),
    htmlRow("TURO'S DATA", trip.signals && trip.signals.length
      ? reportStrong(escapeHtml(trip.signals.join(", ")), REPORT_AMBER) : "no flags"),
    htmlRow("GUEST", escapeHtml(guestRecord(trip).replace(/^\s*\(|\)\s*$/g, "") || "no ratings yet"))
  ].join("");
  return "<div style=\"margin:0 0 10px;padding:12px 14px;border-radius:14px;background:#181c24;border:1px solid #2b3e5a;\">"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr>"
    + "<td style=\"font:700 13px Arial,sans-serif;color:" + REPORT_WHITE + ";\">" + escapeHtml(trip.guest) + "</td>"
    + "<td align=\"right\" style=\"font:700 9px Arial,sans-serif;letter-spacing:.06em;color:" + colour + ";\">" + badge + "</td>"
    + "</tr></table>"
    + "<div style=\"font:11px Arial,sans-serif;color:" + REPORT_MUTED + ";padding:2px 0 8px;\">"
    + escapeHtml([trip.vehicle, trip.plate, trip.reservationId ? "#" + trip.reservationId : null].filter(Boolean).join(" \u00b7 ")) + "</div>"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\">" + rows + "</table>"
    + (trip.url ? "<div style=\"padding:10px 0 0;\"><a href=\"" + escapeHtml(trip.url) + "\" style=\"display:inline-block;padding:7px 12px;border-radius:8px;background:#5aa9ff;color:#07111e;font:700 11px Arial,sans-serif;text-decoration:none;\">Open trip</a></div>" : "")
    + "</div>";
}

// One row per trip, bold column labels, and the reason on a second muted line
// under the row. Nine trips read as nine rows rather than nine screens of
// cards - John: "so it's not tiring to scroll". Every cell is escaped here;
// callers pass plain text (or the few pre-built money spans).
function htmlTable(columns, rows) {
  if (!rows.length) {
    return "<div style=\"padding:10px 12px;border-radius:10px;background:#181c24;color:" + REPORT_MUTED
      + ";font:12px Arial,sans-serif;\">none</div>";
  }
  const head = "<tr>" + columns.map((column) =>
    "<th align=\"left\" style=\"padding:6px 8px;border-bottom:1px solid #2b3e5a;font:700 10px Arial,sans-serif;"
    + "letter-spacing:.08em;color:" + REPORT_WHITE + ";white-space:nowrap;\">" + escapeHtml(column) + "</th>").join("") + "</tr>";
  const body = rows.map((row) => {
    const cells = row.cells.map((cell, index) =>
      "<td style=\"padding:8px 8px 2px;vertical-align:top;font:12px Arial,sans-serif;color:#c7c7cc;line-height:1.4;"
      + (index === 0 ? "font-weight:700;color:" + REPORT_WHITE + ";" : "") + "\">" + cell + "</td>").join("");
    const note = row.note
      ? "<tr><td colspan=\"" + row.cells.length + "\" style=\"padding:0 8px 8px;font:11px Arial,sans-serif;color:"
        + (row.noteColour || REPORT_MUTED) + ";line-height:1.4;border-bottom:1px solid #1f2733;\">" + row.note + "</td></tr>"
      : "<tr><td colspan=\"" + row.cells.length + "\" style=\"padding:0 0 4px;border-bottom:1px solid #1f2733;\"></td></tr>";
    return "<tr>" + cells + "</tr>" + note;
  }).join("");
  return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\""
    + " style=\"border-collapse:collapse;background:#181c24;border-radius:10px;\">" + head + body + "</table>";
}

function shortDate(value) {
  const time = parseTime(value);
  if (time === null) return "unknown";
  return new Date(time).toLocaleDateString("en-US", { timeZone: DIGEST_TIMEZONE, month: "short", day: "numeric" })
    + " " + new Date(time).toLocaleTimeString("en-US", { timeZone: DIGEST_TIMEZONE, hour: "numeric", minute: "2-digit" });
}

function tripCell(trip) {
  return escapeHtml(trip.guest) + "<br><span style=\"font:11px Arial,sans-serif;color:" + REPORT_MUTED + ";font-weight:400;\">#"
    + escapeHtml(trip.reservationId) + "</span>";
}
function vehicleCell(trip) {
  return escapeHtml(trip.vehicle) + (trip.plate ? "<br><span style=\"color:" + REPORT_MUTED + ";\">" + escapeHtml(trip.plate) + "</span>" : "");
}
function datesCell(trip) {
  return escapeHtml(shortDate(trip.pickup)) + "<br>&rarr; " + escapeHtml(shortDate(trip.returnDate));
}
function guestCell(trip) {
  const rated = typeof trip.guestRating === "number" && trip.guestRatingCount;
  const record = (rated ? trip.guestRating.toFixed(1) + "★ · " : "no ratings · ")
    + (trip.guestTripCount || 0) + (trip.guestTripCount === 1 ? " trip" : " trips");
  const concern = (rated && trip.guestRating < 4.5) || !trip.guestTripCount;
  return concern ? reportStrong(record, REPORT_AMBER) : escapeHtml(record);
}
function planCell(trip) {
  if (trip.planExcess === 0) return reportStrong("Premier · $0", REPORT_RED);
  if (!trip.plan) return "not read";
  return escapeHtml(trip.plan) + (typeof trip.planExcess === "number" ? " &middot; " + escapeHtml(reportMoney(trip.planExcess)) : "");
}
function earningsCell(trip, colour) {
  const earnings = reportMoney(trip.earnings);
  if (!earnings) return "<span style=\"color:" + REPORT_MUTED + ";\">not priced</span>";
  const perDay = trip.days && trip.earnings ? " &middot; ~" + escapeHtml(reportMoney(trip.earnings / trip.days)) + "/day" : "";
  return reportStrong(escapeHtml(earnings), colour) + "<br><span style=\"color:" + REPORT_MUTED + ";\">"
    + (trip.days ? trip.days + (trip.days === 1 ? " day" : " days") : "") + perDay
    + " &middot; net" + (typeof trip.takeRate === "number" ? " &middot; " + Math.round(trip.takeRate * 100) + " plan" : "") + "</span>";
}
function perMileCell(trip, colour) {
  if (typeof trip.perMile !== "number") return "<span style=\"color:" + REPORT_MUTED + ";\">&mdash;</span>";
  return reportStrong("$" + trip.perMile.toFixed(2) + "/mi", colour) + "<br><span style=\"color:" + REPORT_MUTED + ";\">"
    + (trip.miles ? trip.miles.toLocaleString("en-US") + " mi incl." : "") + "</span>";
}
function openCell(trip) {
  return trip.url ? "<a href=\"" + escapeHtml(trip.url) + "\" style=\"color:#5aa9ff;text-decoration:none;font-weight:700;\">Open</a>" : "";
}
// The row's second line. Same rules as the card it replaces: an input that
// was never read is NAMED and the figure called a minimum; a real zero
// ("no extras", "no delivery") is stated, so it can never be mistaken for
// "not checked"; the standing delivery rate is never passed off as Turo's.
function earningsNote(trip) {
  const bits = [];
  (trip.reasons || []).forEach((reason) => bits.push(escapeHtml(reason)));
  if (trip.missing && trip.missing.length) {
    bits.push(escapeHtml(trip.missing.join(" and ")) + " could not be read from Turo &mdash; earnings shown are a minimum");
  }
  if (typeof trip.extras === "number" && trip.extras > 0) bits.push("extras " + escapeHtml(reportMoney(trip.extras)));
  else if (trip.extrasChecked) bits.push("no extras");
  else if (trip.extrasChecked === false && !(trip.missing || []).includes("extras")) bits.push("extras could not be read from Turo");
  if (typeof trip.delivery === "number" && trip.delivery > 0) {
    bits.push("delivery " + escapeHtml(reportMoney(trip.delivery)) + (trip.deliverySource === "standing" ? " (your standing rate, not read from Turo)" : ""));
  } else if (trip.delivery === 0 && !(trip.missing || []).includes("delivery fee")) bits.push("no delivery");
  return bits.join(" &middot; ");
}

function riskRows(trips, colour) {
  return trips.map((trip) => ({
    cells: [tripCell(trip), vehicleCell(trip), datesCell(trip), earningsCell(trip, colour), perMileCell(trip, colour), planCell(trip), guestCell(trip), openCell(trip)],
    note: earningsNote(trip), noteColour: colour === REPORT_RED ? "#d8c08a" : REPORT_MUTED
  }));
}
const RISK_COLUMNS = ["GUEST", "VEHICLE", "DATES", "EARNINGS", "PER MILE", "GUEST'S PLAN", "GUEST RECORD", ""];

function htmlSection(title, subtitle, cards) {
  return "<div style=\"font:700 12px Arial,sans-serif;letter-spacing:.08em;color:" + REPORT_WHITE
    + ";margin:18px 0 4px;\">" + escapeHtml(title) + "</div>"
    + (subtitle
      ? "<div style=\"font:12px Arial,sans-serif;color:" + REPORT_MUTED
        + ";margin:0 0 10px;line-height:1.45;\">" + escapeHtml(subtitle) + "</div>"
      : "<div style=\"height:6px;line-height:6px;\">&nbsp;</div>")
    + (cards.length ? cards.join("")
      : "<div style=\"padding:12px 14px;margin:0 0 12px;border-radius:14px;background:#181c24;"
        + "font:12px Arial,sans-serif;color:" + REPORT_MUTED + ";\">none</div>");
}

// The urgent Premier email is the third risk type, and the one that has to be
// acted on fastest - so it gets the same card, not a wall of text. The lead
// line stays blunt: it is the only alert that asks for a decision before
// pickup.
function composePremierHtml(trip, withLogo) {
  return reportShell("Premier plan booked",
    "<div style=\"padding:12px 14px;margin:0 0 12px;border-radius:14px;background:#2a1618;"
    + "border:1px solid #5a2b2b;font:13px Arial,sans-serif;color:#ffd7d2;line-height:1.5;\">"
    + "A guest booked the <b>" + escapeHtml(trip.plan || "Premier") + "</b> protection plan on an "
    + "<b>upcoming</b> trip. Their out-of-pocket maximum is <b>$0</b>, so damage cannot be billed "
    + "to them. Cancel before pickup if you do not want that exposure.</div>"
    + htmlTripCard(trip, "PREMIER - $0 EXCESS", REPORT_RED), null, withLogo);
}

// Every alert shares one frame, so the two emails cannot drift apart.
// The Colorado Cruisers badge, read from the extension's own assets and sent to
// the relay as base64 so it can be attached inline. Cached after the first read
// - it is the same handful of bytes on every alert.
//
// Returns null when the file is absent or unreadable, and the masthead then
// stays purely typographic. That is the whole point: an <img> whose source
// never arrives leaves a broken-image icon in Matt's inbox, which looks worse
// than no logo at all.
let logoCache;
async function readLogoBase64() {
  if (logoCache !== undefined) return logoCache;
  try {
    const response = await fetch(chrome.runtime.getURL(LOGO_ASSET));
    if (!response.ok) throw new Error("HTTP " + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    logoCache = btoa(binary);
  } catch (error) {
    console.warn("[HostOS] No report logo; the masthead stays typographic.", error);
    logoCache = null;
  }
  return logoCache;
}

function reportShell(heading, innerHtml, subtitle, withLogo) {
  // Referenced by cid:, which means the relay attaches the bytes to the message
  // itself. Gmail strips <svg> and data: URIs from email HTML, and a
  // chrome-extension:// URL is unreachable from a mail client, so an inline
  // attachment is the only route that actually renders. The tag is only emitted
  // when the relay is known to be able to attach it - see postAlert.
  const mark = withLogo
    ? "<td style=\"padding:0 13px 0 0;vertical-align:top;width:56px;\">"
      + "<img src=\"cid:ccLogo\" width=\"56\" alt=\"\" style=\"display:block;border:0;width:56px;height:auto;\">"
      + "</td>"
    : "";
  return "<div style=\"margin:0;padding:20px 14px;background:#0e1116;\">"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\""
    + " width=\"100%\" style=\"max-width:780px;margin:0 auto;\"><tr><td>"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr>"
    + mark
    + "<td style=\"vertical-align:top;\">"
    + "<div style=\"font:700 10px Arial,sans-serif;letter-spacing:.16em;color:" + REPORT_MUTED + ";\">"
    + escapeHtml(COMPANY.toUpperCase()) + "</div>"
    + "<div style=\"font:700 22px Arial,sans-serif;color:" + REPORT_WHITE + ";padding:3px 0 0;"
    + "letter-spacing:-.01em;\">" + escapeHtml(heading) + "</div>"
    + (subtitle
      ? "<div style=\"font:12px Arial,sans-serif;color:" + REPORT_MUTED + ";padding:3px 0 0;\">"
        + escapeHtml(subtitle) + "</div>"
      : "")
    + "</td></tr></table>"
    // A hairline under the masthead, so the first card does not butt straight
    // into the title.
    + "<div style=\"height:1px;background:#2b3e5a;margin:15px 0 16px;line-height:1px;\">&nbsp;</div>"
    + innerHtml
    + "</td></tr></table></div>";
}

function composeDigestHtml(payload, withLogo) {
  const unpriced = payload.unpriced || [];
  const parts = [];

  // The outlook first: the day in the context of the week and the month.
  if (payload.outlook) {
    const windows = [payload.outlook.week, payload.outlook.month, payload.outlook.ahead];
    parts.push(htmlSection("EARNINGS OUTLOOK", "Net of Turo's cut, each trip counted when it ends. A trip not yet priced is named, never counted as $0.",
      [htmlTable(["WINDOW", "ESTIMATED", "TRIPS", ""], windows.map((window) => ({
        cells: [escapeHtml(window.label), window.trips ? reportStrong("≈" + reportMoney(window.total), "#30d158") : "<span style=\"color:" + REPORT_MUTED + ";\">no trips</span>",
          String(window.trips), window.unpriced ? "<span style=\"color:" + REPORT_MUTED + ";\">" + window.unpriced + " not priced yet</span>" : ""]
      })))]));
  }

  parts.push(htmlSection("BELOW $0.20/MILE (" + payload.rateRisks.length + ")",
    "What each trip earns you divided by the miles it includes, on the trip's own earnings plan.",
    [htmlTable(RISK_COLUMNS, riskRows(payload.rateRisks, REPORT_RED))]));

  parts.push(htmlSection("COULD NOT PRICE (" + unpriced.length + ")",
    "These read below $0.20/mile, but an input was never read from Turo. The real figure "
    + "can only be higher, so they are not called a risk.",
    [htmlTable(RISK_COLUMNS, riskRows(unpriced, REPORT_MUTED))]));

  parts.push(htmlSection("UNVERIFIED LICENSES, PICKUP WITHIN 24H (" + payload.licenseRisks.length + ")", null,
    [htmlTable(["GUEST", "VEHICLE", "PICKUP", "GUEST'S PLAN", "GUEST RECORD", ""], payload.licenseRisks.map((trip) => ({
      cells: [tripCell(trip), vehicleCell(trip), escapeHtml(shortDate(trip.pickup)), planCell(trip), guestCell(trip), openCell(trip)],
      note: "Confirm the driver's license before pickup"
    })))]));

  const premier = payload.premier || [];
  parts.push(htmlSection("PREMIER PLAN, ALREADY ALERTED (" + premier.length + ")",
    "Each of these had its own urgent email when it was booked. Still on the books, so still "
    + "to cancel and have rebooked, unless you have decided to keep it.",
    [htmlTable(["GUEST", "VEHICLE", "DATES", "EARNINGS", "GUEST'S PLAN", "GUEST RECORD", ""], premier.map((trip) => ({
      cells: [tripCell(trip), vehicleCell(trip), datesCell(trip), earningsCell(trip, REPORT_RED), planCell(trip), guestCell(trip), openCell(trip)],
      note: "$0 out-of-pocket for the guest &mdash; damage cannot be billed to them", noteColour: REPORT_RED
    })))]));

  const reviews = payload.reviews || [];
  parts.push(htmlSection("REVIEWS WAITING ON YOU (" + reviews.length + ")",
    "Completed trips not yet rated. You rate a guest back once they have rated you 5 stars - "
    + "\"guest rated you\" means they said so in the thread. Rate in the Turo app; the HostOS panel "
    + "has the checklist. Turo sends the guest the discount code itself after a 5.",
    [htmlTable(["GUEST", "VEHICLE", "ENDED", "STATUS", "TURO'S DATA", ""], reviews.map((trip) => ({
      cells: [tripCell(trip), vehicleCell(trip), escapeHtml(shortDate(trip.returnDate)),
        trip.ready ? reportStrong("Guest rated you — rate back", "#30d158") + (trip.guestQuote ? "<br><span style=\"color:" + REPORT_MUTED + ";\">&ldquo;" + escapeHtml(trip.guestQuote) + "&rdquo;</span>" : "")
          : "Waiting on guest" + (typeof trip.daysLeft === "number" ? "<br><span style=\"color:" + (trip.daysLeft <= 2 ? REPORT_RED : REPORT_MUTED) + ";\">" + (trip.daysLeft <= 0 ? "last day" : trip.daysLeft + (trip.daysLeft === 1 ? " day left" : " days left")) + "</span>" : ""),
        trip.signals && trip.signals.length ? reportStrong(escapeHtml(trip.signals.join(", ")), REPORT_AMBER) : "<span style=\"color:" + REPORT_MUTED + ";\">no flags</span>",
        openCell(trip)]
    })))]));

  return reportShell("Nightly turnover report",
    parts.join("")
    + "<div style=\"border-top:1px solid #2b3e5a;margin-top:6px;padding-top:12px;"
    + "font:11px Arial,sans-serif;color:" + REPORT_MUTED + ";line-height:1.5;\">"
    + "A new Premier plan booking ($0 out-of-pocket) gets its own urgent email the moment it "
    + "is found, so it can be cancelled before pickup. The Premier section above only recaps "
    + "the ones still on the books. No separate email today means no new Premier bookings.</div>",
    payload.preview ? payload.date + " — preview, sent on request" : payload.date,
    withLogo);
}

// The test button exists to prove the delivery path works, so it has to
// exercise the SAME path a real alert takes - including the HTML. Sending it as
// plain text meant a correctly-deployed v4 relay still produced an unstyled
// email, which reads exactly like a failed deployment: the one thing this
// button exists to rule out.
//
// Deliberately no sample trip card. This email goes to the urgent list, which
// includes Matt, and a realistic-looking risk card in a test would be worse
// than useless.
function composeTestHtml(withLogo) {
  return reportShell("Test alert",
    "<div style=\"padding:14px 16px;border-radius:14px;background:#181c24;"
    + "border:1px solid #2b3e5a;font:13px Arial,sans-serif;color:#c7c7cc;line-height:1.55;\">"
    + "Alerts are working. This is a test from the HostOS extension &mdash; "
    + "<b style=\"color:" + REPORT_WHITE + ";\">no action needed</b>.<br><br>"
    + "<span style=\"color:" + REPORT_MUTED + ";\">If this arrived laid out like a card, the relay "
    + "is on the current version and the nightly report will arrive the same way. If it arrived as "
    + "plain text, the script is deployed at an older version &mdash; everything still works, the "
    + "report just stays plain.</span></div>", null, withLogo);
}

function composeAlert(payload, options = {}) {
  if (payload.kind === "premier") {
    return { ...composePremier(payload.trip), html: composePremierHtml(payload.trip, options.logo) };
  }
  // The digest carries both. An older relay deployment ignores the html and
  // sends the text, so this cannot break a deployment that never gets updated.
  if (payload.kind === "digest") return { ...composeDigest(payload), html: composeDigestHtml(payload, options.logo) };
  return {
    subject: COMPANY + " - HostOS test alert",
    body: COMPANY + "\n\nThis is a test from the HostOS extension. Alerts are working.",
    html: composeTestHtml(options.logo)
  };
}

async function alertConfig() {
  const { hostosAlertConfig = {} } = await chrome.storage.local.get("hostosAlertConfig");
  return hostosAlertConfig;
}

// A failing webhook must not be retried on every storage write. hostosTrips
// changes every few seconds while a Turo page is open, and each change
// re-attempts every un-sent alert — a misconfigured URL would mean a POST
// storm against Apps Script. In memory only: a service worker restart clears
// it, which just means one extra attempt.
let alertBackoffUntil = 0;
const ALERT_BACKOFF_MS = 5 * 60 * 1000;

async function postAlert(payload, options = {}) {
  const config = await alertConfig();
  if (!config.enabled || !config.webhookUrl) return { ok: false, reason: "not-configured" };
  // A test alert is an explicit human action, so it always goes out.
  if (!options.force && Date.now() < alertBackoffUntil) {
    return { ok: false, reason: "backing-off-after-failure" };
  }
  try {
    // Premier alerts (and the manual test, which exists to prove that exact
    // path works) go to the urgent list. The nightly report goes to the
    // standard list. Either falls back to the other rather than silently
    // sending nowhere.
    const urgent = payload.kind === "premier" || payload.kind === "test";
    const recipients = (urgent
      ? config.urgentRecipients || config.recipients
      : config.recipients || config.urgentRecipients) || "";
    // Only emit the <img> when the relay is KNOWN to be able to attach it.
    // The deployed version is reported back on every successful send, so this
    // is last-known-good: unknown means no logo, which is the safe direction -
    // a cid: reference an older relay never attaches renders as a broken image
    // in Matt's inbox. The first send after upgrading the relay therefore has
    // no logo, and every send after it does.
    const { hostosAlertStatus: relayStatus } = await chrome.storage.local.get("hostosAlertStatus");
    // Gmail lists an inline image as an attachment on the message, whatever the
    // blob is called - tried nameless in v6, and it chipped it as "noname".
    // That is inherent to cid:, so whether the logo is worth the chip is a
    // preference, and it lives in the options page rather than in here.
    const { hostosPricingConfig: pricingConfig = {} } = await chrome.storage.local.get("hostosPricingConfig");
    const relayCanAttach = pricingConfig.reportLogo !== false
      && Boolean(relayStatus && relayStatus.deployedVersion >= 5);
    const logo = relayCanAttach ? await readLogoBase64() : null;
    // Recorded so the options page can say WHY a logo did not appear. Silently
    // omitting it left no way to tell an old relay apart from a missing file
    // apart from reading the service worker console.
    const logoState = pricingConfig.reportLogo === false ? "turned-off"
      : !relayCanAttach ? "relay-below-v5"
      : (logo ? "attached" : "asset-unreadable");
    const composed = composeAlert(payload, { logo: Boolean(logo) });
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      // Apps Script treats text/plain as a simple request, avoiding the CORS
      // preflight it won't answer. e.postData.contents still holds the JSON.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      // A superset on purpose. The relay script (v2) reads subject/body; the
      // older script that composes its own wording reads trip/rateRisks and
      // ignores these. Sending both means an already-deployed script keeps
      // working untouched, and upgrading to the relay is optional rather than
      // a forced re-paste.
      body: JSON.stringify({ ...payload, recipients, subject: composed.subject,
        body: composed.body, html: composed.html || null, logo })
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    alertBackoffUntil = 0;
    // The relay reports which version is deployed. Recorded so the options
    // page can say plainly when script.google.com is running older code than
    // the extension expects — the failure that looks like "my change didn't
    // apply" and has no other symptom.
    let deployedVersion = null;
    try {
      const acknowledgement = await response.json();
      deployedVersion = acknowledgement && acknowledgement.version;
      if (acknowledgement && acknowledgement.ok === false) throw new Error(acknowledgement.error || "relay refused");
    } catch (parseError) {
      if (/relay refused/.test(String(parseError))) throw parseError;
      // An older deployment answers without a version; treat that as version 1.
      deployedVersion = deployedVersion || 1;
    }
    await chrome.storage.local.set({
      hostosAlertStatus: {
        ok: true, at: new Date().toISOString(), kind: payload.kind,
        deployedVersion, expectedVersion: SCRIPT_VERSION, logoState
      }
    });
    return { ok: true, deployedVersion, expectedVersion: SCRIPT_VERSION };
  } catch (error) {
    alertBackoffUntil = Date.now() + ALERT_BACKOFF_MS;
    // Surfaced in the options page: a silently failing alert is worse than no
    // alert, because Matt would assume no news means no Premier bookings.
    await chrome.storage.local.set({ hostosAlertStatus: { ok: false, at: new Date().toISOString(), error: String(error), kind: payload.kind } });
    console.warn("[HostOS] Alert delivery failed.", error);
    return { ok: false, reason: String(error) };
  }
}

// --- Background protection sweep ------------------------------------------
//
// The guest's protection plan is the one thing Matt actually asked to be
// alerted about, so it can't depend on a Turo tab happening to be open.
//
// Two paths, because only one of them is guaranteed:
//   * A Turo tab is open -> content/protectionScanner.js does it. That's a
//     genuine same-origin request and always carries the session.
//   * No Turo tab -> this sweep fetches directly. Extension requests come
//     from the extension's own origin, so whether Turo's session cookie is
//     attached depends on its SameSite setting. That can't be assumed, so
//     the response is validated and a failure is recorded plainly rather
//     than leaving trips silently unchecked forever.
//
// Kept in sync with the same constants in content/protectionScanner.js.
const PROTECTION_ALARM = "hostosProtectionSweep";
const PROTECTION_BATCH = 10;
const PROTECTION_GAP_MS = 400;
const PROTECTION_RECHECK_MS = 6 * 60 * 60 * 1000;

chrome.alarms.create(PROTECTION_ALARM, { periodInMinutes: 2 });

// Mirrors HostOS.riskEngine's premier test. Computed here rather than read
// from the stored `premierProtection` flag so an alert never depends on a
// content script having re-enriched the trip first.
function isPremier(trip) {
  return trip.protectionLevel === "SUPREME"
    || (typeof trip.guestMaxOutOfPocket === "number" && trip.guestMaxOutOfPocket === 0);
}

function needsProtectionCheck(trip) {
  if (!trip.reservationId || !/^\d+$/.test(String(trip.reservationId))) return false;
  if (isCancelled(trip)) return false;
  const ret = parseTime(trip.returnDate);
  if (ret !== null && ret <= Date.now()) return false;
  if (!trip.protectionCheckedAt) return true;
  const checked = parseTime(trip.protectionCheckedAt);
  return checked === null || Date.now() - checked > PROTECTION_RECHECK_MS;
}

async function fetchProtection(reservationId) {
  const response = await fetch(
    "https://turo.com/api/reservation/detail?oppTermsAware=true&reservationId=" + encodeURIComponent(reservationId),
    { credentials: "include", headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error("HTTP " + response.status);
  // An unauthenticated request gets Turo's login page, not JSON. Checking the
  // content type keeps that from being parsed as a real (empty) answer, which
  // would stamp every trip "checked" with no plan on it.
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) throw new Error("not-authenticated");
  const data = await response.json();
  if (!data || !data.id) throw new Error("unexpected-shape");
  const detail = data.protectionLevelDetail || {};
  const amount = detail.maxOutOfPocket && detail.maxOutOfPocket.amount;
  const found = {
    protectionLevel: data.protectionLevel || null,
    protectionPlanName: detail.selectedShortText || detail.titleText || null,
    guestMaxOutOfPocket: typeof amount === "number" ? amount : null,
    protectionCheckedAt: new Date().toISOString()
  };
  // Same rule as the content-side reader: set only when the payload says so,
  // never written as false.
  const cancelledSignal = HostOS.parser.cancellationSignal(data);
  if (cancelledSignal) {
    found.cancelled = true;
    found.cancelledSignal = cancelledSignal;
    found.cancelledSeenAt = new Date().toISOString();
  }
  return found;
}

async function sweepProtection() {
  // A Turo tab is already doing this on the guaranteed-same-origin path;
  // running both would race on the same storage key for no benefit.
  const turoTabs = await chrome.tabs.query({ url: ["https://turo.com/*", "https://www.turo.com/*"] });
  if (turoTabs.length) return;

  const { hostosTrips: trips = [] } = await chrome.storage.local.get("hostosTrips");
  const queue = trips
    .filter(needsProtectionCheck)
    .sort((a, b) => (parseTime(a.pickupDate) || Infinity) - (parseTime(b.pickupDate) || Infinity))
    .slice(0, PROTECTION_BATCH);
  if (!queue.length) return;

  const results = new Map();
  let lastError = null;
  for (const trip of queue) {
    try {
      results.set(trip.reservationId, await fetchProtection(trip.reservationId));
    } catch (error) {
      lastError = String(error);
      // A session problem fails identically for every id, so stop rather than
      // hammering through the whole batch.
      if (/not-authenticated|HTTP 40/.test(lastError)) break;
    }
    await new Promise((resolve) => setTimeout(resolve, PROTECTION_GAP_MS));
  }

  if (!results.size) {
    await chrome.storage.local.set({
      hostosProtectionStatus: {
        source: "background",
        error: lastError || "no-results",
        // Says what to do about it, since this is the one check Matt relies on.
        hint: "Open a Turo tab so protection plans can be checked.",
        updatedAt: new Date().toISOString()
      }
    });
    return;
  }

  const latest = (await chrome.storage.local.get("hostosTrips")).hostosTrips || [];
  const merged = latest.map((trip) => {
    const found = results.get(trip.reservationId);
    if (!found) return trip;
    const next = { ...trip, ...found };
    next.premierProtection = isPremier(next);
    return next;
  });
  await chrome.storage.local.set({
    hostosTrips: merged,
    hostosProtectionStatus: { source: "background", checked: results.size, updatedAt: new Date().toISOString() }
  });
  console.log("[HostOS] Background protection sweep:", results.size, "checked.");
}

function tripSummary(trip) {
  return {
    reservationId: trip.reservationId,
    guest: trip.guestName || "Guest",
    vehicle: trip.vehicle || "Vehicle",
    plate: trip.plate || null,
    plan: trip.protectionPlanName || null,
    guestRating: typeof trip.guestRating === "number" ? trip.guestRating : null,
    guestRatingCount: trip.guestRatingCount || 0,
    guestTripCount: trip.guestTripCount || 0,
    pickup: trip.pickupDate || null,
    returnDate: trip.returnDate || null,
    url: trip.tripUrl || null,
    reasons: trip.riskReasons || [],
    // Which earnings inputs were never read, so the report can say why a trip
    // could not be priced instead of just omitting it.
    missing: trip.earningsUnknownInputs || [],
    // The same figures the Profit Risk card shows, so the email can lay a trip
    // out the same way instead of making it a wall of text.
    earnings: HostOS.parser.number(trip.estimatedEarnings),
    perMile: HostOS.parser.number(trip.earningsPerMile),
    miles: HostOS.parser.number(trip.includedMiles),
    extras: HostOS.parser.number(trip.earningsExtras),
    extrasChecked: Array.isArray(trip.extras),
    delivery: HostOS.parser.number(trip.earningsDelivery),
    deliverySource: trip.deliveryFeeSource || null,
    // The plan the figure is net of, so the email can say "(90 plan)".
    takeRate: HostOS.parser.number(trip.hostTakeRate),
    planExcess: typeof trip.guestMaxOutOfPocket === "number" ? trip.guestMaxOutOfPocket : null,
    days: HostOS.dates.tripDayCount(trip),
    perDay: (() => {
      const total = HostOS.parser.number(trip.estimatedEarnings);
      const days = HostOS.dates.tripDayCount(trip);
      return total !== null && days ? total / days : null;
    })()
  };
}

// Fires the moment a Premier booking is seen, once per reservation.
//
// Gated on hasNotStarted, because the whole point is for Matt to cancel
// BEFORE pickup — a trip that has already started or finished can't be
// cancelled, so alerting on it is pure noise. This fired on reservation
// 57760996 (Johennie / Subaru Ascent), a trip that ran Aug 7-21 and was long
// over, and the email read "Pickup: unknown, Return: unknown" because a
// finished trip carries no pickup date from the list scan.
//
// hasNotStarted is deliberately strict: an unknown pickup date is NOT treated
// as upcoming. isUpcomingOrBrandNew relaxes that for a booking with NO dates at
// all, so a Premier plan is reported the moment it is booked rather than a scan
// later — cancelling gets more expensive the longer it waits. The trade is that
// the first email for such a trip prints "unknown → unknown" for the schedule.
//
// Only one alert is ever sent per reservation. Getting that right needs both
// guards below, because the trigger and the dedupe fought each other:
//
//   alertPremierTrips runs from chrome.storage.onChanged on `hostosTrips`, and
//   the background DETAIL SCAN writes hostosTrips when it resolves a trip's
//   dates. So the scan that fills in the schedule re-fires this function. The
//   old code read hostosAlerted, awaited a slow Apps Script round-trip, and only
//   wrote the dedupe key after every send had finished — so the second
//   invocation read the map before the first had written to it, saw the trip as
//   un-alerted, and sent again. Observed live on reservation 61156935: two
//   "Premier plan booked" emails, the first with "unknown → unknown" dates and
//   the second with real ones, which is exactly this race either side of the
//   detail scan.
let alertPremierInFlight = null;

async function alertPremierTrips(trips) {
  // 1. Serialise. Concurrent onChanged events queue behind each other instead
  //    of racing, so each one sees what the previous actually wrote.
  const run = (alertPremierInFlight || Promise.resolve())
    .catch(() => {})
    .then(() => alertPremierTripsInner(trips));
  alertPremierInFlight = run;
  return run;
}

async function alertPremierTripsInner(trips) {
  const { hostosAlerted = {} } = await chrome.storage.local.get("hostosAlerted");
  const pending = trips.filter((trip) => isPremier(trip)
    && isUpcomingOrBrandNew(trip)
    && !hostosAlerted[trip.reservationId + ":premier"]);
  if (!pending.length) return;

  // 2. Claim BEFORE sending, not after. Even with the queue above, a service
  //    worker can be torn down mid-send; a key written only on success means a
  //    delivered email whose claim never landed, and a resend next scan.
  const claimed = { ...hostosAlerted };
  for (const trip of pending) claimed[trip.reservationId + ":premier"] = Date.now();
  await chrome.storage.local.set({ hostosAlerted: prune(claimed) });

  const failed = [];
  for (const trip of pending) {
    const result = await postAlert({ kind: "premier", trip: tripSummary(trip) });
    if (!result.ok) failed.push(trip.reservationId);
  }

  // 3. Release the claim only for sends that genuinely failed, so a delivery
  //    failure still retries on the next scan — the property the original
  //    mark-on-success was protecting. Re-read rather than reusing `claimed`:
  //    a later run may have added keys while these sends were in flight.
  if (failed.length) {
    const { hostosAlerted: current = {} } = await chrome.storage.local.get("hostosAlerted");
    const next = { ...current };
    for (const id of failed) delete next[id + ":premier"];
    await chrome.storage.local.set({ hostosAlerted: prune(next) });
  }
}

// Everything else that's flagged, batched once a day — there are 60+ upcoming
// trips at any time, so these would drown the Premier alerts if sent live.
async function sendDailyDigest(options = {}) {
  const { hostosTrips: trips = [], hostosReviews: reviewRecords = {} } = await chrome.storage.local.get(["hostosTrips", "hostosReviews"]);
  // isPremier, not the stored flag, so a Premier trip can't land in both the
  // immediate alert and the digest.
  const rateRisks = trips.filter((trip) => trip.earningsRisk && !isPremier(trip) && hasNotStarted(trip));
  const licenseRisks = trips.filter((trip) => !isCancelled(trip)
    && trip.licenseVerified === false && isWithinLicenseUploadWindow(trip.pickupDate));
  // Premier bookings still on the books. Each already had its urgent email the
  // moment it was found; they are listed again here so the report reconciles
  // with the panel - which counts them under Profit Risk - and so Matt has, in
  // one place, the trips he has not yet cancelled and had rebooked. Without
  // this the panel read "Profit Risk 4" on the same evening the report read
  // "BELOW $0.20/MILE (0)", and the only explanation was a footnote.
  const premier = trips.filter((trip) => isPremier(trip) && hasNotStarted(trip));
  // Trips that LOOK thin but whose earnings were built on an input we never
  // read. They are deliberately NOT asserted as below $0.20 - a floor is not a
  // total, and reservation 60557889 (a real $0.26/mile trip) being reported as
  // thin is the third wrong number Matt has had to correct. They are named
  // anyway, because dropping them silently would be its own lie.
  // riskEngine already decided this when it priced the trip - re-deriving the
  // rule here is exactly how this file and the modules have drifted before.
  const unpriced = trips.filter((trip) =>
    trip.earningsUndecided === true && !isPremier(trip) && hasNotStarted(trip));
  // Sent even when both lists are empty. This is a turnover report handed over
  // at clock-out, and "no email" is ambiguous — it could equally mean nothing
  // was flagged or that the extension failed. A report saying "none" is the
  // only version that actually tells you something.
  return postAlert({
    kind: "digest",
    // A preview says so, in the subject and under the masthead. An
    // unlabelled copy of the turnover report arriving at 3 PM reads as the
    // real one going out early, and Matt would act on a list that is still
    // hours from settled.
    preview: options.force === true,
    date: new Date().toLocaleDateString(),
    rateRisks: rateRisks.map(tripSummary),
    licenseRisks: licenseRisks.map(tripSummary),
    unpriced: unpriced.map(tripSummary),
    premier: premier.map(tripSummary),
    // Completed trips still waiting on Matt. The report is where he actually
    // reads about his day, so this is the reminder that lands.
    outlook: HostOS.outlook.compute(trips),
    reviews: HostOS.reviews.pending(trips, reviewRecords).map((entry) => ({
      ...tripSummary(entry.trip),
      state: entry.state,
      ready: entry.ready,
      guestQuote: HostOS.reviews.readiness(entry.trip).quote,
      daysLeft: HostOS.reviews.daysLeft(entry.trip),
      signals: HostOS.reviews.signals(entry.trip).map((signal) => signal.label)
    }))
  }, options);
}

// The 8 AM alarm only fires if Chrome happens to be running at 8 AM. It often
// won't be, and the old code then simply rescheduled for the following day —
// so a day's digest vanished with nothing said. This runs the digest on the
// first wake after 8 AM on a day that hasn't had one, and records the date
// only once it's actually gone out.
async function maybeSendDigest() {
  const { date, hour } = coloradoNow();
  const { hostosLastDigestDate } = await chrome.storage.local.get("hostosLastDigestDate");
  if (hostosLastDigestDate === date) return;
  if (hour < DIGEST_HOUR) return;
  const result = await sendDailyDigest();
  if (result && result.ok) await chrome.storage.local.set({ hostosLastDigestDate: date });
}

// Polled rather than scheduled for an exact moment. A one-shot alarm at 9 PM
// only fires if Chrome happens to be awake then, and pinning an absolute time
// means recomputing it across daylight-saving changes. Checking the Colorado
// clock every few minutes is simpler and self-correcting: if the browser was
// closed at 9 PM, the report goes out on the first wake after it, still marked
// against the right Colorado date so it can't double-send.
chrome.alarms.create(DIGEST_ALARM, { periodInMinutes: 5 });
maybeSendDigest();

// Only reservations picking up (or returning) within this window get
// background-scanned at all — scanning the whole booked calendar meant a
// near-constant stream of background tabs for trips weeks out that don't
// need attention yet. A trip beyond this window simply won't have risk
// data yet; it becomes eligible once it enters the window.
const DETAIL_WINDOW_MS = 72 * 60 * 60 * 1000;

function eligibleForDetailScan(trip) {
  if (!trip.tripUrl) return false;
  // Nothing on a cancelled reservation's page can change the answer, and its
  // dates render struck through or not at all - it would otherwise sit in the
  // retry loop reserved for pages that never render.
  if (isCancelled(trip)) return false;
  // A scan from an older logic version is never "recently scanned" — a fix
  // that changes what a scan reads should correct existing stale/wrong data
  // right away, not leave it sitting until the cooldown expires or someone
  // happens to revisit that specific trip directly.
  const scannedUnderCurrentVersion = trip.detailScanVersion === DETAIL_SCAN_VERSION;
  // A scan whose date elements never rendered in time (detailScanComplete
  // === false) doesn't count as up to date no matter how recent — without
  // this, a trip whose schedule section is slow (e.g. one near its return
  // time) can get marked "freshly scanned" while its date was never
  // actually captured, then sit untouched for a full cooldown period.
  // Is either end of this trip close enough to matter? Flagged trips are now
  // scanned however far out they are, and the 5-minute cooldown exists so a
  // flag near pickup clears within minutes of the host fixing it. A trip a
  // month out has no such urgency, and rescanning it every 5 minutes forever
  // would be exactly the constant tab activity the window exists to prevent.
  const scanNow = Date.now();
  const closeBy = (value) => {
    const time = parseTime(value);
    return time !== null && time >= scanNow && time - scanNow <= DETAIL_WINDOW_MS;
  };
  const nearTerm = closeBy(trip.pickupDate) || closeBy(trip.returnDate);
  const isCurrentlyFlagged = nearTerm
    && ((trip.licenseVerified === false && isWithinLicenseUploadWindow(trip.pickupDate))
      || ((trip.earningsBelowFloor || trip.earningsUndecided) && hasNotStarted(trip)));
  const rescanWindow = isCurrentlyFlagged ? FLAGGED_RESCAN_MS : DETAIL_RESCAN_MS;
  const failingRepeatedly = (HostOS.parser.number(trip.detailScanFailures) || 0) >= MAX_DETAIL_SCAN_FAILURES;
  const recentlyScanned = scannedUnderCurrentVersion
    && (trip.detailScanComplete !== false || failingRepeatedly)
    && trip.detailScannedAt && Date.now() - new Date(trip.detailScannedAt).getTime() < rescanWindow;
  if (recentlyScanned) return false;
  // A trip whose card matched neither "Starting at" nor "Ending at" has no
  // dates at all from the list scan, so the check below could never judge
  // it — yet it's exactly the kind of active reservation whose mileage and
  // price data is worth fetching. Always eligible until a detail scan fills
  // its schedule in.
  if (trip.tripStatus === "in_progress") return true;
  // A trip we could not price is exactly the reservation worth opening: its
  // extras live ONLY on the reservation page, and reading them is the one
  // thing that settles whether it is genuinely below $0.20. Without this it
  // sat outside the 72-hour window reading "not read yet" indefinitely, and
  // the queue could never resolve it either way.
  //
  // This is deliberately NOT a general widening of the window - that was tried
  // and produced a near-constant stream of background tabs for trips weeks
  // out. It is scoped to trips that are actually undecided, which is a handful,
  // and it is self-limiting: a detail scan fills extras in, the trip stops
  // being undecided, and it stops qualifying.
  // Everything the Profit Risk report names is scanned regardless of how far
  // out it is, so that report is always complete. Both halves of it - a trip
  // flagged below $0.20, and one we could not price - are only as good as the
  // extras behind them, and extras live ONLY on the reservation page.
  //
  // Still not the general widening that was tried and rejected: that scanned
  // every trip weeks out. This is scoped to trips already on the report, which
  // is a handful, and they take the ordinary 30-minute cooldown rather than the
  // 5-minute one once they are outside the window.
  // Scoped to the PROFIT signal specifically - not earningsRisk, which is also
  // true for a Premier booking. A Premier trip is a protection risk: it is
  // emailed the moment it is booked from the JSON sweep, and opening its page
  // adds nothing. And only while the trip can still be cancelled, since that
  // is the entire point of knowing.
  const isProfitRisk = trip.earningsBelowFloor === true || trip.earningsUndecided === true;
  if (isProfitRisk && hasNotStarted(trip)) return true;
  // A trip with no dates at all can't be judged by the window check below, so
  // without this it would never be scanned and would never GET dates — a
  // permanent dead end. This is the normal state for a booking discovered
  // through the activity feed before its card has rendered in the Booked
  // list: it has a reservation id and a plan, but nothing else until a detail
  // scan fills the schedule in.
  if (!trip.pickupDate && !trip.returnDate) return true;
  // Either end of the trip being close is reason enough to look. This used to
  // read `returnDate || pickupDate`, which took the return date whenever one
  // existed and ignored the pickup entirely — so a trip picking up tomorrow
  // but not due back for two weeks fell outside the window and was never
  // scanned. That trip therefore never learned its licenseVerified value, and
  // since the license check only fires within 24h of pickup, those trips
  // could never be flagged at all. Both dates are now considered.
  const now = Date.now();
  const inWindow = (value) => {
    const time = parseTime(value);
    return time !== null && time >= now && time - now <= DETAIL_WINDOW_MS;
  };
  if (inWindow(trip.pickupDate) || inWindow(trip.returnDate)) return true;
  // A trip that has just ENDED still needs scanning, and the forward-looking
  // checks above can never schedule it because both its dates are in the
  // past. Its Booked-list card reads "Ended at 5:30 AM", which yields a
  // return date and no pickup date — so without this it never learns when it
  // started, `tripDayCount` stays null, and the Earnings Estimator can never
  // price it. That's precisely the set of trips the daily roll-up is about,
  // so they'd show "No estimate yet" forever.
  //
  // Scoped to trips actually missing a pickup date, so it's a one-shot catch
  // per trip rather than a standing re-scan of recent history.
  const returned = parseTime(trip.returnDate);
  if (!trip.pickupDate && returned !== null && now - returned <= DETAIL_WINDOW_MS) return true;
  // An ACTIVE trip is exactly what the Earnings Estimator prices, and its
  // guest extras exist ONLY on the reservation page. A long rental — say one
  // out until Aug 30 when the window reaches 72 hours — matches none of the
  // checks above, so it would never be scanned and its extras would silently
  // count as zero while the tile still showed a confident total.
  //
  // One-shot: it stops qualifying the moment it has been scanned once, so this
  // doesn't put active trips into a standing rescan loop.
  return !trip.detailScannedAt && HostOS.dates.isActive(trip);
}

// --- Background detail scanning -------------------------------------------
//
// Confirmed via the service worker console (repeated identical "Detail scan
// timed out" for the same reservation, never once succeeding): Turo blocks
// its pages from being framed at all, so no iframe-based approach — hidden
// iframe on the live page, or one inside a chrome.offscreen document — can
// ever work here, invisible or not. The only mechanism that has ever
// actually produced a result in this whole project is a genuine top-level
// navigation: manual visits, and this — a real background tab. It's a
// deliberate function-over-cosmetics tradeoff: it can briefly flash open
// and closed in the tab strip, in exchange for actually working.
let scrapeStats = { completed: 0, failed: 0 };
let currentScrape = null; // { tabId, reservationId, tripUrl, timeoutId } | null
// Set synchronously the moment a scrape starts being set up. currentScrape
// itself is only assigned several awaits later (pause check, storage read,
// status write, then the tab actually opening), and maybeStartNextScrape is
// called from chrome.storage.onChanged — which fires on every single list
// scan. Two calls could both clear the "if (currentScrape) return" guard
// inside that window, both open a tab, and the second assignment would
// overwrite the first: a tab nobody tracks, which handleScanDone rejects
// (its sender.tab.id no longer matches) and tabs.onRemoved ignores. Those
// are the stray reservation tabs that pile up in the tab strip.
let startingScrape = false;
// Resolves once the startup orphan sweep below has finished. That sweep
// closes every hostos_bg tab it cannot account for, and its chrome.tabs.query
// snapshot is taken before currentScrape is assigned - so a scrape starting
// in that window could have its brand-new tab closed underneath it, leaving
// currentScrape tracking a dead tab and the queue stalled until the 30s
// timeout. Declared null rather than assigned here so there is no temporal
// dead zone if anything ever calls the queue during top-level execution.
let orphanSweep = null;
let lastEligibleCount = 0;
let lastAttempt = null; // { reservationId, tripUrl, result, at } — shown directly in the popup/widget so this is checkable without devtools

function backgroundScanUrl(tripUrl) {
  // Defence at the point of use. Fixing the scanner stops NEW bad URLs being
  // written, but a record stored earlier keeps its old value until a list scan
  // happens to re-read that card - and a trip discovered through the activity
  // feed may have no Booked card at all, so it would never be repaired. The
  // activity feed links to /reservation/{id}/receipt, which a co-host cannot
  // open, and opening it was what starved the queue.
  //
  // Rebuild from the id in the path, so nothing that reaches this function can
  // send a tab anywhere but the trip page.
  const marker = "/reservation/";
  const at = String(tripUrl).indexOf(marker);
  let base = tripUrl;
  if (at >= 0) {
    const id = String(tripUrl).slice(at + marker.length).split("/")[0].split("?")[0];
    if (id && /^[0-9]+$/.test(id)) base = "https://turo.com/us/en/reservation/" + id;
  }
  return base + (base.includes("?") ? "&" : "?") + "hostos_bg=1";
}

async function setDetailStatus(state) {
  await chrome.storage.local.set({
    hostosDetailStatus: { eligible: lastEligibleCount, completed: scrapeStats.completed, failed: scrapeStats.failed, state, lastAttempt, updatedAt: new Date().toISOString() }
  });
}

async function recordAttempt(trip, result) {
  lastAttempt = { reservationId: trip.reservationId, tripUrl: trip.tripUrl, result, at: new Date().toISOString() };
  await setDetailStatus(result === "in-progress" ? "scanning" : "idle");
}

// Opening background tabs is the only part of HostOS the host can actually
// see happening, so it's the only part that gets paused. Everything that
// runs over the JSON APIs — protection plans, the activity feed, and so the
// Premier alerts to Matt — keeps working while paused, because none of it
// needs a tab and silently muting Matt's alerts would be a nasty surprise.
async function isPaused() {
  const { hostosPaused } = await chrome.storage.local.get("hostosPaused");
  return Boolean(hostosPaused);
}

async function maybeStartNextScrape() {
  if (currentScrape || startingScrape) return; // one scrape in flight at a time
  startingScrape = true;
  try {
    // Never race the startup sweep - see orphanSweep above.
    if (orphanSweep) await orphanSweep;
    if (await isPaused()) {
      await setDetailStatus("paused");
      return;
    }
    const { hostosTrips: trips = [] } = await chrome.storage.local.get("hostosTrips");
    const queue = trips.filter(eligibleForDetailScan);
    lastEligibleCount = queue.length;
    if (!queue.length) {
      await setDetailStatus("idle");
      return;
    }
    console.log("[HostOS] Detail queue:", queue.length, "eligible trip(s).", queue.map((trip) => trip.reservationId));

    const trip = queue[0];
    await recordAttempt(trip, "in-progress");
    // Awaited rather than given a callback, so currentScrape is assigned
    // before this function returns and startingScrape is cleared. With the
    // callback form the guard dropped while the tab was already open but
    // still untracked, which is the window the duplicate tabs came from.
    let tab = null;
    try {
      tab = await chrome.tabs.create({ url: backgroundScanUrl(trip.tripUrl), active: false });
    } catch (error) {
      console.warn("[HostOS] Failed to open background tab for detail scan.", trip.tripUrl, error);
    }
    if (!tab || !tab.id) {
      scrapeStats.failed += 1;
      await recordAttempt(trip, "tab-failed-to-open");
      setTimeout(maybeStartNextScrape, 2000);
      return;
    }
    const tabId = tab.id;
    const timeoutId = setTimeout(() => {
      console.warn("[HostOS] Detail scan timed out.", trip.tripUrl);
      scrapeStats.failed += 1;
      recordAttempt(trip, "timed-out");
      chrome.tabs.remove(tabId, () => chrome.runtime.lastError);
    }, DETAIL_TAB_TIMEOUT_MS);
    currentScrape = { tabId, reservationId: trip.reservationId, tripUrl: trip.tripUrl, timeoutId };
  } finally {
    startingScrape = false;
  }
}

// A background scan tab outlives the service worker that opened it. MV3 can
// terminate this worker whenever it looks idle, which discards currentScrape
// AND the setTimeout that would have closed the tab; handleScanDone then
// rejects that tab's own "done" message, because currentScrape is null and
// nothing matches its sender. The tab is left open in the strip forever, and
// another one joins it on the next termination. Any hostos_bg tab present
// when this worker starts is by definition untracked — currentScrape is
// always null on a fresh worker — so closing them is safe: the trip just
// gets rescanned by the normal queue.
async function closeOrphanedScanTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://turo.com/*", "https://www.turo.com/*"] });
    const orphans = tabs.filter((tab) => (tab.url || "").includes("hostos_bg=1")
      && (!currentScrape || tab.id !== currentScrape.tabId));
    orphans.forEach((tab) => chrome.tabs.remove(tab.id, () => chrome.runtime.lastError));
    if (orphans.length) console.warn("[HostOS] Closed", orphans.length, "orphaned background scan tab(s).");
  } catch (error) {
    console.warn("[HostOS] Could not sweep orphaned scan tabs.", error);
  }
}

orphanSweep = closeOrphanedScanTabs();

// The content script in the background tab sends this once its scan
// finishes — checked against the tracked tabId so a stray/duplicate message
// can't be mistaken for the trip actually in flight.
function handleScanDone(sender, complete) {
  if (!currentScrape || !sender.tab || sender.tab.id !== currentScrape.tabId) return;
  clearTimeout(currentScrape.timeoutId);
  scrapeStats.completed += 1;
  recordAttempt(currentScrape, complete === false ? "incomplete" : "success");
  chrome.tabs.remove(currentScrape.tabId, () => chrome.runtime.lastError);
}

// tabs.onRemoved fires whether the tab closed because the content script
// asked for it, the fallback timeout forced it, or the user closed it
// manually — either way, clear tracking and move on. This is the actual
// queue-advancement mechanism, not a timer this file has to stay alive for.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (!currentScrape || currentScrape.tabId !== tabId) return;
  clearTimeout(currentScrape.timeoutId);
  const scrape = currentScrape;
  currentScrape = null;
  // Normal completion (handleScanDone) and the fallback timeout both record
  // a final attempt before removing the tab, so lastAttempt has already
  // moved past "in-progress" by the time this fires for those cases. If the
  // tab instead closed some other way (closed manually, killed by Chrome),
  // neither of those ran — without this, the footer would stay frozen on
  // "checking reservation…" until the next attempt, misreporting an
  // apparently-live scan that actually stopped.
  if (lastAttempt && lastAttempt.reservationId === scrape.reservationId && lastAttempt.result === "in-progress") {
    recordAttempt(scrape, "closed-early");
  }
  maybeStartNextScrape();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.hostosPaused) {
    // Resume the moment it's switched back on, rather than waiting out the
    // 10-minute alarm.
    if (!changes.hostosPaused.newValue) maybeStartNextScrape();
    // And close any tab already in flight, so "off" means the tab strip stops
    // moving now. Without this the current scan would run on for up to 30
    // seconds after the click — long enough to look like the switch did
    // nothing. tabs.onRemoved does the bookkeeping and then sees the pause.
    else if (currentScrape) {
      clearTimeout(currentScrape.timeoutId);
      chrome.tabs.remove(currentScrape.tabId, () => chrome.runtime.lastError);
    }
  }
  if (!changes.hostosTrips) return;
  notifyForTrips();
  maybeStartNextScrape();
  alertPremierTrips(changes.hostosTrips.newValue || []);
});

// Manual "Scan now": finds a real, currently-open tab on Turo's Booked page
// (content scripts can't query other tabs themselves — only the background
// has chrome.tabs access) and asks that specific tab to scan itself, rather
// than opening anything new. If no such tab is open, says so plainly
// instead of silently doing nothing or opening one unprompted.
// More than one Booked tab open at once is normal — it's the page this runs
// against all day — and they are NOT interchangeable. A tab that was already
// open when the extension last reloaded has an orphaned content script and
// can never answer a message again until it is refreshed; a freshly loaded
// one answers fine. This used to take whichever Booked tab chrome.tabs.query
// happened to return first, so one stale tab earlier in the strip made "Scan
// now" fail every time while the passive observer in the *other* tab kept
// scanning normally — the confusing "it says scan failed but it clearly just
// scanned a minute ago" state. Worse, the error told the user to reload "the
// Booked tab", and reloading the one they were looking at never helped,
// because that was the tab already working. Order by how likely a tab is to
// be live, then actually try them all before reporting failure.
function orderBookedTabs(tabs) {
  return tabs.slice().sort((a, b) =>
    Number(Boolean(b.active)) - Number(Boolean(a.active))
    || Number(Boolean(a.discarded)) - Number(Boolean(b.discarded))
    || (b.lastAccessed || 0) - (a.lastAccessed || 0));
}

async function runManualScan() {
  const tabs = await chrome.tabs.query({ url: ["https://turo.com/*", "https://www.turo.com/*"] });
  const bookedTabs = orderBookedTabs(tabs.filter((tab) => (tab.url || "").toLowerCase().includes("/trips/booked")));
  if (!bookedTabs.length) return { ok: false, reason: "no-booked-tab" };
  let detail = null;
  for (const tab of bookedTabs) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "HOSTOS_RUN_SCAN" });
      // A content script that threw on the way to registering its listener
      // can leave the port closing with no response at all. That is a tab
      // that failed to scan, not a page with zero cards on it — reporting it
      // as "scanned, 0 found" would be a lie that looks like an answer.
      if (!response || typeof response.tripsFound !== "number") {
        detail = (response && response.error) || "no response from the content script";
        continue;
      }
      maybeStartNextScrape();
      return { ok: true, tripsFound: response.tripsFound };
    } catch (error) {
      detail = (error && error.message) || String(error);
    }
  }
  // Distinct from "no-booked-tab": the page IS open, but nothing in it is
  // listening. The only fix is refreshing that tab, so say exactly that.
  return { ok: false, reason: "no-listener", tabsTried: bookedTabs.length, detail: String(detail) };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HOSTOS_GET_TRIPS") {
    chrome.storage.local.get(["hostosTrips", "hostosLastScan"]).then(sendResponse);
    return true;
  }
  if (message.type === "HOSTOS_RUN_SCAN") {
    runManualScan().then(sendResponse);
    return true;
  }
  if (message.type === "HOSTOS_DETAIL_SCAN_DONE") {
    handleScanDone(sender, message.complete);
    return false;
  }
  if (message.type === "HOSTOS_TEST_ALERT") {
    postAlert({ kind: "test" }, { force: true }).then(sendResponse);
    return true;
  }
  // The test alert only ever proved the Premier path: it goes to the urgent
  // list and composes its own wording. The two risks Matt asked to be told
  // about - trips below $0.20/mile, and unverified licenses inside 24 hours -
  // exist ONLY in the 9 PM report, so the sole way to learn whether they were
  // composed, addressed and delivered was to wait for 9 PM and see if an email
  // arrived. That is a whole day per attempt, and a silent failure looks
  // identical to a quiet night. This sends tonight's report, built from the
  // trips currently in storage, on demand.
  //
  // sendDailyDigest, deliberately, not maybeSendDigest: only the latter writes
  // hostosLastDigestDate, so a preview can never stand in for the 9 PM report
  // and cancel it.
  if (message.type === "HOSTOS_TEST_DIGEST") {
    sendDailyDigest({ force: true }).then(sendResponse);
    return true;
  }
});
