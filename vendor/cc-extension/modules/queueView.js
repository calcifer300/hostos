window.HostOS = window.HostOS || {};

// Shared between the toolbar popup and the in-page widget so both surfaces
// group, prioritize, and render trips identically. Depends on HostOS.dates
// and HostOS.constants only — no chrome.* calls except the two isolated in
// openTrip/copyText, so it works unmodified in the popup document and in a
// Turo page content script alike.
HostOS.queueView = (() => {
  const LABELS = {
    premier: "PREMIER PLAN BOOKINGS",
    license: "UNVERIFIED LICENSES",
    earnings: "PROFIT RISK",
    reviews: "PENDING REVIEWS",
    today: "EARNINGS ESTIMATOR"
  };

  const DAY_MS = 24 * 60 * 60 * 1000;

  function money(value) {
    return "$" + Math.round(value).toLocaleString();
  }

  // Money is picked out in bold colour so a figure can be found without
  // reading the sentence around it: green inside the Earnings Estimator
  // (what the fleet is making) and red on Profit Risk cards (what needs a
  // decision). Same font size as the surrounding text — weight and colour do
  // the work, so the cards don't turn into a ransom note.
  function moneyNode(text, tone) {
    const node = document.createElement("b");
    node.className = "hostos-money" + (tone ? " hostos-money-" + tone : "");
    node.textContent = text;
    return node;
  }

  // Lines are built as arrays mixing plain strings and elements, so a money
  // span can sit mid-sentence. Strings still go through createTextNode, so
  // guest- and Turo-controlled text is never parsed as markup.
  function appendParts(target, parts) {
    parts.forEach((part) => {
      if (part === null || part === undefined || part === "") return;
      target.appendChild(typeof part === "string" ? document.createTextNode(part) : part);
    });
  }

  function formatWhen(value) {
    // Via parseTime, because new Date(null).getTime() is 0 — finite, and it
    // would render as a date in 1969/1970 rather than being rejected.
    const parsed = HostOS.dates.parseTime(value);
    if (parsed === null) return null;
    const date = new Date(parsed);
    const calendar = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return calendar + " · " + time;
  }

  // What the guest's purchased extras add to a trip. Turo bills an extra
  // either once for the whole booking ("/trip") or per day ("/day") and
  // prints which, so the stored unit decides the multiplier rather than an
  // assumption — treating a $55/trip extra as per-day would overstate a
  // 10-day booking by $495. Quantity multiplies either kind.
  // Whether this trip has actually been LOOKED at for extras. An absent list
  // is not an empty one: extras are read from the reservation, and a trip the
  // detail scan has never reached simply has no answer yet. Counting unknown
  // as $0 understates earnings and pushes a trip toward the $0.20 flag - the
  // same false-positive direction Matt has reported twice. The card says so
  // out loud rather than showing a total that quietly assumes zero.
  function extrasChecked(trip) {
    return Array.isArray(trip.extras);
  }

  function extrasValue(trip, days) {
    return (trip.extras || []).reduce((sum, extra) => {
      const price = HostOS.parser.number(extra.price);
      if (price === null) return sum;
      const quantity = HostOS.parser.number(extra.quantity) || 1;
      const multiplier = extra.unit === "day" ? (days || 1) : 1;
      return sum + price * quantity * multiplier;
    }, 0);
  }

  // "Prepaid EV recharge ($55/trip)" — or with a count when more than one.
  function describeExtras(trip) {
    return (trip.extras || []).map((extra) => {
      const quantity = HostOS.parser.number(extra.quantity) || 1;
      const each = "$" + extra.price + "/" + extra.unit;
      return extra.name + " (" + (quantity > 1 ? quantity + " × " + each : each) + ")";
    }).join(", ");
  }

  // The guest's chosen protection plan, in plain words. "Premier" carries a
  // $0 out-of-pocket maximum, meaning the host cannot bill the guest for any
  // damage — that's the case Matt wants to catch and cancel. "Declined" is
  // the opposite: the guest carries full liability.
  // A guest's track record, which is the signal that was missing when Matt
  // lost a windshield to a 1.0-star guest on their first-ever trip. Shown
  // alongside the plan because the two together are what a cancel-or-keep
  // decision actually rests on.
  //
  // "New guest" is called out separately from a bad rating: nobody has rated
  // them, which is not the same as being rated badly, and both are worth
  // knowing before handing over a car.
  const LOW_RATING = 4.5;

  function guestConcern(trip) {
    const rating = HostOS.parser.number(trip.guestRating);
    const ratingCount = HostOS.parser.number(trip.guestRatingCount) || 0;
    if (rating !== null && ratingCount > 0 && rating < LOW_RATING) return "low-rating";
    if (!trip.guestCheckedAt) return null;
    if ((HostOS.parser.number(trip.guestTripCount) || 0) === 0) return "new-guest";
    return null;
  }

  function describeGuest(trip) {
    if (!trip.guestCheckedAt) return null;
    const rating = HostOS.parser.number(trip.guestRating);
    const ratingCount = HostOS.parser.number(trip.guestRatingCount) || 0;
    const trips = HostOS.parser.number(trip.guestTripCount) || 0;
    const parts = [rating !== null && ratingCount > 0
      ? rating.toFixed(1) + "★ from " + pluralize(ratingCount, "rating")
      : "No ratings yet"];
    parts.push(" · " + pluralize(trips, "trip"));
    if (trip.guestMemberSince && trip.guestMemberSince.year) {
      const month = trip.guestMemberSince.month
        ? new Date(2000, trip.guestMemberSince.month - 1, 1).toLocaleDateString([], { month: "short" }) + " "
        : "";
      parts.push(" · joined " + month + trip.guestMemberSince.year);
    }
    return parts;
  }

  function describeProtection(trip, tone) {
    if (trip.premierProtection) {
      // The consequence lives in the card's note and the badge, so this row
      // just states the plan — saying it three times made the card noisy.
      return [(trip.protectionPlanName || "Premier") + " · ", moneyNode("$0", tone), " excess"];
    }
    if (trip.protectionLevel === "DECLINED") {
      return ["Declined — the guest carries full liability"];
    }
    if (trip.protectionPlanName) {
      const excess = HostOS.parser.number(trip.guestMaxOutOfPocket);
      if (excess === null) return [trip.protectionPlanName];
      return [trip.protectionPlanName + " · ", moneyNode(money(excess), tone), " excess"];
    }
    // Turo does return a null protectionLevel for some reservations (seen on
    // 60676408). Distinguished from "never looked" so the card doesn't claim a
    // check is outstanding when one already came back empty — otherwise the
    // footer's plans counter and the card would contradict each other.
    if (trip.protectionCheckedAt) return ["Not stated by Turo for this trip"];
    // Said out loud rather than left blank, so an unchecked trip is never
    // mistaken for one confirmed safe.
    return ["Not checked yet"];
  }

  // Availability, anchored to real dates.
  //
  // How many day columns the calendar has rendered is a browser-layout
  // detail — measured at 34, then 27, then 26 on the same fleet — so any
  // phrasing built on that count drifts for reasons the reader can't see.
  // "booked 25 of the next 27 days" was the first attempt and "13 free days
  // in the next 26" the second; both left someone asking what 27 or 26 meant.
  //
  // Naming the end date instead makes every number checkable: the reader can
  // look at that date on the calendar. The span still depends on how much was
  // scanned, but now it says so out loud instead of hiding behind a count.
  function dayFromToday(offset) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date;
  }

  function shortDate(date) {
    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function availabilityLine(entry) {
    const flags = entry.bookedDayFlags || [];
    const total = flags.length || HostOS.parser.number(entry.totalDays) || 0;
    if (!total) return null;
    const lastDay = shortDate(dayFromToday(total - 1));
    if (!flags.length) return "Booked " + pluralize(entry.bookedDays || 0, "day") + " between now and " + lastDay + ".";

    const freeCount = flags.filter((booked) => !booked).length;
    if (!freeCount) return "Booked solid through " + lastDay + ".";

    const firstFree = flags.indexOf(false);
    const label = firstFree === 0
      ? "today"
      : firstFree === 1 ? "tomorrow" : shortDate(dayFromToday(firstFree));
    return "Next free day: " + label + " · " + pluralize(freeCount, "free day") + " between now and " + lastDay + ".";
  }

  function vehicleList(fleetAvailability) {
    const vehicles = (fleetAvailability && fleetAvailability.vehicles) || {};
    return Array.isArray(vehicles) ? vehicles : Object.values(vehicles);
  }

  function vehiclesByPlate(fleetAvailability) {
    return new Map(vehicleList(fleetAvailability).filter((entry) => entry.plate).map((entry) => [entry.plate, entry]));
  }

  // Turo shows this account no payout figure at all — the earnings pages
  // require a vehicle listing, and a co-host has none (confirmed live: they
  // return "you must have a vehicle listing"). The fleet calendar's daily
  // prices are the only money data reachable, and it renders today forward
  // only, so a trip's past days are simply not on the page.
  //
  // So the estimate is: the vehicle's observed nightly rate across the days
  // of this trip we CAN see, multiplied by the trip's true length taken from
  // the reservation page's schedule. Two things this is NOT, and which the
  // UI states outright wherever the number appears: it is not exact, and it
  // is gross list price — Turo's 10-40% cut is not deducted.
  // The nightly rate the trip is booked at, summed over its own days from the
  // fleet calendar. Exported so the pricing sweep computes earnings from
  // exactly the same base the panel displays — two derivations of the same
  // number would drift apart the moment either changed.
  function baseRentalFor(trip, vehicleEntry) {
    const days = HostOS.dates.tripDayCount(trip);
    if (!days || !vehicleEntry) return null;
    const raw = vehicleEntry.prices || [];
    if (!raw.length) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const pickup = HostOS.dates.parseTime(trip.pickupDate);
    const startIndex = pickup === null
      ? 0
      : Math.max(0, Math.floor((pickup - startOfToday.getTime()) / DAY_MS));
    let basis = raw.slice(startIndex, startIndex + days).filter((price) => price > 0);
    if (!basis.length) basis = raw.filter((price) => price > 0);
    if (!basis.length) return null;
    // Averaged then multiplied rather than summed, so a trip running past the
    // end of the visible calendar still prices its whole length.
    const avgDaily = basis.reduce((sum, price) => sum + price, 0) / basis.length;
    return avgDaily * days;
  }

  function estimateTripValue(trip, vehicleEntry) {
    const days = HostOS.dates.tripDayCount(trip);
    if (!days || !vehicleEntry) return null;
    const raw = vehicleEntry.prices || [];
    if (!raw.length) return null;
    // Take the calendar columns this trip actually occupies. Column 0 is
    // today, so a trip starting in two days begins at index 2 — averaging
    // from index 0 would fold in nights the trip doesn't cover, which for an
    // upcoming booking can be a different price band entirely. Clamped to 0
    // for a trip already under way, whose earlier nights are off-screen.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const pickup = HostOS.dates.parseTime(trip.pickupDate);
    const startIndex = pickup === null
      ? 0
      : Math.max(0, Math.floor((pickup - startOfToday.getTime()) / DAY_MS));
    let basis = raw.slice(startIndex, startIndex + days).filter((price) => price > 0);
    if (!basis.length) basis = raw.filter((price) => price > 0);
    if (!basis.length) return null;
    const avgDaily = basis.reduce((sum, price) => sum + price, 0) / basis.length;
    // Guest-purchased extras are billed on top of the nightly rate and don't
    // appear in the calendar's daily prices, so they're added here too — the
    // Profit Risk card and this estimate would otherwise disagree about what
    // the same trip is worth.
    const extras = extrasValue(trip, days);
    return { total: avgDaily * days + extras, days, avgDaily, extras };
  }

  // Names the input that's actually missing. This used to say "visit the
  // Calendar page to price this vehicle" whenever a plate was known, which
  // sent the host to the Calendar page while the real blocker was usually a
  // missing pickup date — a trip that ended today is listed as "Ended at
  // 5:30 AM" and yields no start date, so it has no length to price. Standing
  // on the Calendar page changed nothing, which is exactly how it looked.
  function missingEstimateReason(trip, fleetAvailability) {
    if (!trip.plate) return "No estimate yet — waiting on the vehicle's plate from a trip scan.";
    if (HostOS.dates.tripDayCount(trip) === null) {
      return "No estimate yet — waiting on this trip's start date from a detail scan.";
    }
    const entry = vehiclesByPlate(fleetAvailability).get(trip.plate);
    if (!entry || !(entry.prices || []).some((price) => price > 0)) {
      return "No estimate yet — open the Turo Calendar page and scroll to " + trip.plate + " to price it.";
    }
    return "No estimate yet.";
  }

  // Trips whose return lands today. Turo pays out on completion, so a trip's
  // whole value is credited to the day it ends rather than spread across it.
  function computeTodaysEarnings(trips, fleetAvailability) {
    const byPlate = vehiclesByPlate(fleetAvailability);
    const entries = trips
      .filter((trip) => HostOS.dates.isToday(trip.returnDate))
      .map((trip) => ({ trip, estimate: estimateTripValue(trip, byPlate.get(trip.plate)) }))
      .sort((a, b) => new Date(a.trip.returnDate).getTime() - new Date(b.trip.returnDate).getTime());
    const total = entries.reduce((sum, entry) => sum + (entry.estimate ? entry.estimate.total : 0), 0);
    const priced = entries.filter((entry) => entry.estimate).length;
    return { entries, total, priced };
  }

  function pluralize(count, noun = "trip") {
    return count + " " + noun + (count === 1 ? "" : "s");
  }

  function openTrip(url) {
    if (!url) return;
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
    else window.open(url, "_blank", "noopener");
  }

  // navigator.clipboard needs a focused, secure-context document and a user
  // gesture — both true for a click inside the popup or the in-page widget.
  // The execCommand path is a fallback for older/locked-down environments.
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        return true;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  const REVIEWS_KEY = "hostosReviews";
  async function saveReviewRecord(reservationId, patch) {
    if (typeof chrome === "undefined" || !chrome.storage) return null;
    const { [REVIEWS_KEY]: records = {} } = await chrome.storage.local.get(REVIEWS_KEY);
    const next = { ...records, [reservationId]: { ...(records[reservationId] || {}), ...patch, updatedAt: new Date().toISOString() } };
    await chrome.storage.local.set({ [REVIEWS_KEY]: next });
    return next[reservationId];
  }

  function formatStart(value) {
    const parsed = HostOS.dates.parseTime(value);
    if (parsed === null) return "Start time unavailable";
    const date = new Date(parsed);
    const weekday = date.toLocaleDateString([], { weekday: "short" });
    const calendar = date.toLocaleDateString([], { month: "short", day: "numeric" });
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return "Starts " + weekday + ", " + calendar + " · " + time;
  }

  function computeGroups(trips, reviewRecords = {}) {
    return {
      // Completed trips Matt has not rated. See utils/reviews.js.
      reviews: HostOS.reviews.pending(trips, reviewRecords).map((entry) => entry.trip),
      // isWithinLicenseUploadWindow takes a date, not a trip, so unlike the
      // earnings queue below this does not pass through hasNotStarted and has
      // to refuse a cancelled reservation itself. The report does the same.
      license: trips.filter((trip) => !HostOS.dates.isCancelled(trip)
        && trip.licenseVerified === false && HostOS.dates.isWithinLicenseUploadWindow(trip.pickupDate)),
      // Premier bookings are their own queue, first and red: the guest has $0
      // out-of-pocket, so nothing can be recovered from them, and the only
      // remedy is to cancel before pickup. They used to be folded into Profit
      // Risk, which made "Profit Risk 14" mean two unrelated things and never
      // match the report's BELOW $0.20/MILE count. premierProtection is the
      // stored flag the sweeps write (the service worker's tabless sweep sets
      // it without running riskEngine), so it is what both surfaces read.
      premier: trips.filter((trip) => trip.premierProtection === true && HostOS.dates.hasNotStarted(trip)),
      // The $0.20 rule alone. earningsBelowFloor is the profit half of
      // earningsRisk; a Premier trip that is also thin shows once, as Premier.
      earnings: trips.filter((trip) => trip.earningsBelowFloor === true && trip.premierProtection !== true
        && HostOS.dates.hasNotStarted(trip))
    };
  }

  // How many distinct reservations need attention, counted once each even
  // if a trip triggers more than one queue.
  // Trips that READ below $0.20 but were built on an input nobody ever read.
  // They are deliberately not flagged - a floor below the line says nothing
  // about where the real figure sits, which is what produced three wrong
  // numbers for Matt. But an empty Profit Risk queue is ambiguous on its own:
  // it can mean every trip cleared $0.20, or that everything was held back.
  // The nightly email says which; the panel used to say nothing at all, so a
  // suppressed queue looked exactly like a clean one. Same rule as the
  // digest's COULD NOT PRICE section.
  function unpriceable(trips) {
    return (trips || []).filter((trip) => trip.earningsUndecided === true
      && !trip.premierProtection && HostOS.dates.hasNotStarted(trip));
  }

  function computeActionCount(groups) {
    const ids = new Set();
    [groups.premier || [], groups.license, groups.earnings, groups.reviews || []].forEach((list) => list.forEach((trip) => ids.add(trip.reservationId)));
    return ids.size;
  }

  // "Active" = picked up and not yet returned. "Booked" = confirmed but not
  // yet picked up. Together these describe what's actually happening with
  // the fleet right now, instead of a raw lifetime reservation count.
  //
  // Both are decided from the trip's dates, never from tripStatus. Turo
  // lists a trip twice — once under its pickup date and again under its
  // return date — so the later card overwrites tripStatus and leaves an
  // ordinary upcoming trip stored as "ending". See utils/dates.js.
  // What the hero says. The big number is the deadline-bound work - Premier
  // bookings, licences, thin trips - and the reviews ride underneath: 25
  // reviews waiting is not the same kind of number as one Premier booking to
  // cancel, and adding them together read as 41 alarms.
  function computeHeroSummary(groups) {
    const urgentIds = new Set();
    [groups.premier || [], groups.license, groups.earnings].forEach((list) => list.forEach((trip) => urgentIds.add(trip.reservationId)));
    const urgent = urgentIds.size;
    const reviews = (groups.reviews || []).length;
    const ready = (groups.reviews || []).filter((trip) => HostOS.reviews.readiness(trip).ready).length;
    const headline = (groups.premier || []).length
      ? pluralize(groups.premier.length, "Premier booking") + " to cancel before pickup"
      : groups.license.length
        ? pluralize(groups.license.length, "license") + " to confirm before pickup"
        : groups.earnings.length
          ? pluralize(groups.earnings.length) + " below $0.20/mile"
          : reviews ? "Nothing urgent \u2014 reviews only" : "Nothing needs attention";
    const sub = reviews
      ? pluralize(reviews, "review") + " waiting" + (ready ? " \u00b7 " + ready + " ready to rate" : "")
      : "Reviews caught up";
    return { urgent, reviews, ready, headline, sub, label: urgent === 1 ? "item needs attention" : "items need attention" };
  }

  // Tile subtitles: the count, and what the count is of. A bare "3 trips"
  // under Unverified Licenses made the reader recall the rule; the rule is
  // short enough to print.
  function tileSubtitles(groups, trips, fleetAvailability) {
    const today = computeTodaysEarnings(trips, fleetAvailability);
    const outlook = HostOS.outlook.compute(trips);
    const ready = (groups.reviews || []).filter((trip) => HostOS.reviews.readiness(trip).ready).length;
    return {
      premier: (groups.premier || []).length
        ? pluralize(groups.premier.length) + " \u00b7 cancel before pickup" : "None \u2014 all clear",
      license: groups.license.length
        ? pluralize(groups.license.length) + " \u00b7 pickup within 24h" : "None due",
      earnings: groups.earnings.length
        ? pluralize(groups.earnings.length) + " \u00b7 below $0.20/mi" : "None flagged",
      reviews: (groups.reviews || []).length
        ? groups.reviews.length + " waiting" + (ready ? " \u00b7 " + ready + " ready to rate" : "") : "All caught up",
      today: (today.entries.length
        ? (today.priced ? "≈" + money(today.total) + " today" : pluralize(today.entries.length) + " due back today")
        : "Nothing due back today")
        + (outlook.month.trips ? " \u00b7 \u2248" + money(outlook.month.total) + " this month" : "")
    };
  }

  // The footer's one-line status, as labelled cells. "36 active \u00b7 69
  // booked \u00b7 2 available \u00b7 plans 105/105 \u00b7 details 254/0 \u00b7
  // scanned 0s ago \u00b7 queue 0s ago" was a sentence nobody could scan.
  function statCells(fleet, availableCount, detailStatus, lastScanAgo, queueAgo) {
    return [
      { label: "Active", value: String(fleet.active) },
      { label: "Booked", value: String(fleet.booked) },
      { label: "Available", value: String(availableCount) },
      { label: "Plans checked", value: fleet.protectionChecked + "/" + fleet.protectionTotal },
      { label: "Scanned", value: lastScanAgo },
      { label: "Queue", value: queueAgo || "never run" }
    ];
  }

  function renderStats(container, cells) {
    container.innerHTML = "";
    cells.forEach((cell) => {
      const item = document.createElement("div");
      item.className = "hostos-stat";
      const value = document.createElement("b");
      value.textContent = cell.value;
      const label = document.createElement("small");
      label.textContent = cell.label;
      item.append(value, label);
      container.appendChild(item);
    });
  }

  function computeFleetStats(trips) {
    const active = trips.filter((trip) => HostOS.dates.isActive(trip)).length;
    const booked = trips.filter((trip) => HostOS.dates.hasNotStarted(trip)).length;
    // Protection coverage across the trips that could still be canceled —
    // shown in the footer so "not checked yet" is visibly a backlog working
    // through, rather than something quietly stuck.
    const pending = trips.filter((trip) => !HostOS.dates.hasReturned(trip));
    const checked = pending.filter((trip) => trip.protectionCheckedAt).length;
    const premier = pending.filter((trip) => trip.premierProtection).length;
    return { active, booked, protectionChecked: checked, protectionTotal: pending.length, premier };
  }

  // A vehicle only counts as "available" if it's free for both today and
  // tomorrow — matching the same today/tomorrow window used for license
  // review, so the numbers in this tool stay consistent with each other.
  function availableVehicles(fleetAvailability) {
    return vehicleList(fleetAvailability).filter((entry) => entry.availableToday && entry.availableTomorrow);
  }

  function closeQueueButton(container) {
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "hostos-close-queue";
    closeButton.setAttribute("aria-label", "Close review queue");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => container.classList.remove("visible"));
    return closeButton;
  }

  // Title and close button share one sticky bar so the × stays reachable no
  // matter how far down a long queue is scrolled — previously the close
  // button was absolutely positioned and scrolled away with the content,
  // stranding the user with no visible way to dismiss the queue.
  function queueHeader(container, labelText) {
    const header = document.createElement("div");
    header.className = "hostos-queue-header";
    const title = document.createElement("p");
    title.className = "hostos-result-title";
    title.textContent = labelText;
    header.append(title, closeQueueButton(container));
    return header;
  }

  // Cards are laid out as a label/value grid rather than run-on sentences.
  // Prose lines stacked up to six deep and read as a paragraph — you had to
  // read the whole card to find one figure. Aligned labels let the eye jump
  // straight to Earnings, Plan, or Guest.
  //
  // Every node is built with textContent/createTextNode rather than innerHTML,
  // since guestName and vehicle come from guest- and Turo-controlled page text
  // and shouldn't be parsed as markup.
  function detailGrid(rows) {
    const grid = document.createElement("div");
    grid.className = "hostos-details";
    rows.filter(Boolean).forEach((row) => {
      const key = document.createElement("span");
      key.className = "hostos-key";
      key.textContent = row.label;
      const value = document.createElement("span");
      value.className = "hostos-val";
      appendParts(value, row.parts);
      grid.append(key, value);
    });
    return grid;
  }

  // Every tile that corresponds to a real reservation gets the same way in.
  // stopPropagation because vehicle tiles aren't click-through as a whole —
  // only this button navigates, so a stray click on the card does nothing.
  function openTripActions(tripUrl, extraButton) {
    if (!tripUrl && !extraButton) return null;
    const actions = document.createElement("div");
    actions.className = "hostos-result-actions";
    if (extraButton) actions.appendChild(extraButton);
    if (tripUrl) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open trip";
      button.addEventListener("click", (event) => { event.stopPropagation(); openTrip(tripUrl); });
      actions.appendChild(button);
    }
    return actions;
  }

  function cardHead(titleText, badgeText, badgeTone) {
    const head = document.createElement("div");
    head.className = "hostos-result-head";
    const title = document.createElement("b");
    title.textContent = titleText;
    head.appendChild(title);
    if (badgeText) {
      const badge = document.createElement("span");
      badge.className = "hostos-badge" + (badgeTone ? " hostos-badge-" + badgeTone : "");
      badge.textContent = badgeText;
      head.appendChild(badge);
    }
    return head;
  }

  // "Thu, Aug 27 · 4:30 PM → Sun, Aug 30 · 7:30 PM" — the full window on one
  // line, so the trip's shape is visible without opening it.
  function tripWindow(trip) {
    const start = formatWhen(trip.pickupDate);
    const end = formatWhen(trip.returnDate);
    if (start && end) return start + "  →  " + end;
    if (start) return "Starts " + start;
    if (end) return "Returns " + end;
    return "Dates unavailable";
  }

  function renderCard(trip, filter, fleetAvailability) {
    const card = document.createElement("article");
    card.className = "hostos-result";

    const isLicense = filter === "license";
    // Read from the stored flag rather than substring-matching the wording of
    // a risk reason, which silently stops working the moment that wording is
    // reworded.
    const hasZeroDeductible = !isLicense && Boolean(trip.premierProtection);
    const badge = isLicense
      ? "License unverified"
      : hasZeroDeductible ? (trip.protectionPlanName || "Premier") + " plan" : "Below $0.20/mi";

    card.appendChild(cardHead(trip.guestName || trip.vehicle || "Reservation", badge,
      isLicense ? "amber" : "red"));

    // The trip's identity, mirroring the email card. Without it a Profit Risk
    // card names only a guest and a date range: there is no way to search Turo
    // for the booking, quote it to a guest, or tell two trips by the same
    // guest apart. The head already shows the vehicle when there is no guest
    // name, so it is only repeated here when there is one.
    const identity = [
      trip.guestName ? trip.vehicle : null,
      trip.plate,
      trip.reservationId ? "#" + trip.reservationId : null
    ].filter(Boolean).join(" · ");
    if (identity) {
      const ident = document.createElement("p");
      ident.className = "hostos-ident";
      ident.textContent = identity;
      card.appendChild(ident);
    }

    const when = document.createElement("p");
    when.className = "hostos-when";
    when.textContent = tripWindow(trip);
    card.appendChild(when);

    // The one instruction that matters, given its own line above the figures
    // so it can't be lost among them.
    if (hasZeroDeductible) {
      const note = document.createElement("p");
      note.className = "hostos-note";
      note.textContent = "Consider canceling before pickup — you have no recourse to recoup damage.";
      card.appendChild(note);
    }

    // Red on Profit Risk cards: these are the figures a cancel-or-keep call
    // hangs on. The licence queue carries no money, so it stays neutral.
    const tone = isLicense ? null : "red";
    const rows = [];

    if (isLicense) {
      rows.push({ label: "Action", parts: ["Confirm the driver's license before pickup"] });
    } else {
      // Trip earnings come from the nightly rate the vehicle is listed at,
      // NOT from included miles × the overage rate. pricePerMile is what a
      // guest pays for each mile *beyond* the included allowance, so
      // multiplying it by the included miles produces a number with no
      // real-world meaning.
      const days = HostOS.dates.tripDayCount(trip);
      const estimate = estimateTripValue(trip, vehiclesByPlate(fleetAvailability).get(trip.plate));
      // Both rows are derived from ONE number. Previously "Earnings" showed the
      // gross nightly total while "Per mile" was computed from net earnings,
      // so a card could read $1,283 and $0.15/mi across 3,500 miles — figures
      // that cannot both describe the same trip ($1,283 ÷ 3,500 is $0.37).
      // Net is the honest one: it's what Matt actually receives, and it's the
      // number his receipt shows.
      // Read from storage, never recomputed here. The pricing sweep computes
      // this once and the risk rule tests the same stored rate, so the badge
      // and the figures on the card cannot contradict each other.
      const netEarnings = HostOS.parser.number(trip.estimatedEarnings);
      const netExtras = HostOS.parser.number(trip.earningsExtras) || 0;
      const netDelivery = HostOS.parser.number(trip.earningsDelivery) || 0;
      const miles = HostOS.parser.number(trip.includedMiles)
        || HostOS.parser.number(trip.estimatedMiles);

      if (netEarnings !== null && days) {
        const perDay = netEarnings / days;
        rows.push({ label: "Earnings", parts: [
          moneyNode(money(netEarnings), tone),
          " · " + pluralize(days, "day") + " · ~", moneyNode(money(perDay), tone), "/day",
          " · after discounts and Turo's cut" + (typeof trip.hostTakeRate === "number"
            ? " (" + Math.round(trip.hostTakeRate * 100) + " plan)" : "")
        ] });
        // Itemised, because the net total absorbs them invisibly. Without this
        // there's no way to tell a guest's add-on was counted — which reads as
        // "my extra is missing" even when it isn't.
        if (netExtras > 0) {
          rows.push({ label: "Extras", parts: [moneyNode(money(netExtras), tone),
            " · " + describeExtras(trip)] });
        } else if (!extrasChecked(trip)) {
          // Never show a derived money figure without its inputs: this trip's
          // earnings were computed with no extras because none are known, not
          // because the guest bought none.
          rows.push({ label: "Extras", parts: ["not read yet — earnings above are a minimum, the real figure can only be higher"] });
        } else {
          // Say "none" rather than rendering nothing. An absent row proves
          // nothing - it reads exactly like a card that simply does not show
          // extras - so there was no way to tell a checked-and-empty trip from
          // one where the row had failed to render. The whole point of
          // itemising extras is to prove they were accounted for, and that
          // needs an answer even when the answer is zero.
          rows.push({ label: "Extras", parts: ["None bought"] });
        }
        if (netDelivery > 0) {
          // Named, because these are two different kinds of number and only one
          // of them came from Turo.
          rows.push({ label: "Delivery", parts: [moneyNode(money(netDelivery), tone),
            trip.deliveryFeeSource === "standing"
              ? " fee · your standing rate, not read from Turo"
              : " fee"] });
        } else {
          rows.push({ label: "Delivery", parts: ["None"] });
        }
      } else if (estimate) {
        // The pricing sweep hasn't reached this trip, so the net chain can't be
        // built yet. Labelled gross rather than quietly passed off as take-home.
        const parts = [moneyNode(money(estimate.total), tone),
          " · " + pluralize(estimate.days, "day") + " · ~", moneyNode(money(estimate.avgDaily), tone), "/day"];
        if (estimate.extras > 0) parts.push(" + ", moneyNode(money(estimate.extras), tone), " extras");
        parts.push(" · gross, pricing not scanned yet");
        rows.push({ label: "Earnings", parts });
      } else {
        rows.push({ label: "Earnings", parts: [missingEstimateReason(trip, fleetAvailability)] });
      }

      // The number the $0.20 rule actually tests, shown with the allowance it
      // is divided by so it can be checked by hand. Recomputed from the same
      // `net` above rather than read from storage, so the two rows can never
      // drift apart on screen.
      const perMile = HostOS.parser.number(trip.earningsPerMile);
      if (perMile !== null && miles !== null) {
        rows.push({ label: "Per mile", parts: [
          moneyNode("$" + perMile.toFixed(2), tone),
          "/mi earned across " + miles.toLocaleString() + " mi included"
        ] });
      }

      // The overage rate stays visible because it's worth knowing, but it no
      // longer triggers anything — it's the penalty for exceeding the
      // allowance, not a measure of what the trip earns.
      const rate = HostOS.parser.number(trip.pricePerMile);
      if (rate !== null) {
        rows.push({ label: "Overage", parts: ["$" + rate.toFixed(2) + "/mi past the allowance"] });
      }
    }

    // The plan is the single biggest factor in what the host can recover if
    // the car comes back damaged, so it's on every card, not just Premier ones.
    rows.push({ label: "Plan", parts: describeProtection(trip, tone) });
    const guestParts = describeGuest(trip);
    if (guestParts) {
      // A poor or absent track record is bolded in the same red as the risk
      // figures, so it reads as part of the same decision rather than trivia.
      const concern = guestConcern(trip) && !isLicense;
      rows.push({ label: "Guest", parts: concern ? [moneyNode(guestParts.join(""), "red")] : guestParts });
    }
    card.appendChild(detailGrid(rows));

    let copyButton = null;
    if (isLicense) {
      copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "hostos-secondary";
      copyButton.textContent = "Copy reminder";
      copyButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const ok = await copyText(HostOS.constants.LICENSE_REMINDER_MESSAGE);
        copyButton.textContent = ok ? "Copied!" : "Copy failed";
        setTimeout(() => { copyButton.textContent = "Copy reminder"; }, 1800);
      });
    }
    const actions = openTripActions(trip.tripUrl, copyButton);
    if (actions) card.appendChild(actions);

    card.addEventListener("click", () => openTrip(trip.tripUrl));
    return card;
  }

  function chip(text, tone) {
    const node = document.createElement("span");
    node.className = "hostos-chip" + (tone ? " hostos-chip-" + tone : "");
    node.textContent = text;
    return node;
  }

  function monthYear(value) {
    const parsed = HostOS.dates.parseTime(value);
    return parsed === null ? "" : new Date(parsed).toLocaleDateString([], { month: "short", year: "numeric" });
  }

  // One completed trip waiting on Matt. Everything Turo knows is laid out as
  // named signals; everything Matt decides is a tap that writes his own record.
  // Nothing here submits a rating - Turo web gives a co-host no control for
  // it - so the card ends with the one thing he actually does: rate in the
  // app. Turo sends the guest the discount code itself after a 5.
  function renderReviewCard(trip, record, allRecords) {
    const card = document.createElement("article");
    card.className = "hostos-result hostos-review";
    const state = HostOS.reviews.state(trip, record);
    const left = HostOS.reviews.daysLeft(trip);

    // Matt rates back only once the guest has rated him. The badge says which
    // side of that line the trip is on; the window is secondary.
    const ready = HostOS.reviews.readiness(trip);
    const badge = ready.ready ? "Guest rated you"
      : left === null ? "Waiting on guest"
      : left <= 0 ? "Last day to rate"
      : left + (left === 1 ? " day left" : " days left");
    const tone = ready.ready ? "ok" : left !== null && left <= 2 ? "red" : left !== null && left <= 4 ? "amber" : "muted";
    card.appendChild(cardHead(trip.guestName || trip.vehicle || "Reservation", badge, tone));

    const identity = [trip.guestName ? trip.vehicle : null, trip.plate, trip.reservationId ? "#" + trip.reservationId : null]
      .filter(Boolean).join(" \u00b7 ");
    if (identity) {
      const ident = document.createElement("p");
      ident.className = "hostos-ident";
      ident.textContent = identity;
      card.appendChild(ident);
    }

    const when = document.createElement("p");
    when.className = "hostos-when";
    const ended = HostOS.reviews.endedAt(trip);
    const endedDays = ended === null ? null : Math.max(0, Math.floor((Date.now() - ended) / DAY_MS));
    const ago = endedDays === null ? ""
      : " \u00b7 ended " + (endedDays === 0 ? "today" : endedDays === 1 ? "yesterday" : endedDays + " days ago");
    when.textContent = tripWindow({ pickupDate: trip.pickupDate, returnDate: trip.completedAt || trip.returnDate }) + ago
      + (left !== null && state === "pending" ? " \u00b7 Turo's " + HostOS.constants.REVIEW_WINDOW_DAYS + "-day window" : "");
    card.appendChild(when);

    // What Turo's data says. A card with nothing to say says so, rather than
    // leaving an empty row that could mean "not checked".
    const signals = HostOS.reviews.signals(trip);
    const chips = document.createElement("div");
    chips.className = "hostos-chips";
    if (!trip.postTripCheckedAt) chips.appendChild(chip("Not checked yet", "muted"));
    else if (!signals.length) chips.appendChild(chip("No flags from Turo", "ok"));
    signals.forEach((signal) => chips.appendChild(chip(signal.label, "warn")));
    if (Number.isFinite(trip.milesDriven)) chips.appendChild(chip(Math.round(trip.milesDriven).toLocaleString() + " mi driven", "muted"));
    card.appendChild(chips);
    signals.filter((signal) => signal.detail).forEach((signal) => {
      const line = document.createElement("p");
      line.className = "hostos-quote";
      line.textContent = signal.label + ": " + signal.detail;
      card.appendChild(line);
    });

    // Where the guest stands, in their own words when they have said it.
    const standing = document.createElement("p");
    if (ready.ready) {
      standing.className = "hostos-quote hostos-quote-ok";
      standing.textContent = "Guest: \u201c" + ready.quote + "\u201d \u2014 rate them back now.";
    } else {
      standing.className = "hostos-when";
      standing.textContent = !trip.postTripCheckedAt ? "Thread not read yet."
        : "Waiting on the guest\u2019s 5-star review \u2014 nothing from them about it in the thread yet.";
    }
    card.appendChild(standing);

    const verdict = document.createElement("p");
    const setVerdict = () => {
      const rec = HostOS.reviews.recommendation(trip, record);
      verdict.className = rec.verdict === "clean" ? "hostos-note hostos-note-ok" : "hostos-note";
      verdict.textContent = rec.text;
    };
    setVerdict();
    // Once a rating exists the recommendation has been acted on; the line
    // would only nag.
    if (HostOS.reviews.ratingGiven(trip, record) === null) card.appendChild(verdict);

    // Problems, marked by exception. Each tap writes the record and the
    // recommendation line follows it.
    const hasMarks = Boolean(record && ((record.problems || []).length || (record.notes || "").trim()));
    const details = document.createElement("details");
    details.className = "hostos-disclosure";
    details.open = hasMarks;
    const summary = document.createElement("summary");
    summary.textContent = hasMarks ? "Problems & notes" : "Mark a problem or add a note";
    summary.addEventListener("click", (event) => event.stopPropagation());
    details.appendChild(summary);

    const toggles = document.createElement("div");
    toggles.className = "hostos-toggles";
    HostOS.reviews.PROBLEMS.forEach((problem) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hostos-toggle" + ((record && (record.problems || []).includes(problem.id)) ? " on" : "");
      button.textContent = problem.label;
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const current = new Set((record && record.problems) || []);
        if (current.has(problem.id)) current.delete(problem.id); else current.add(problem.id);
        button.classList.toggle("on", current.has(problem.id));
        record = { ...(record || {}), problems: [...current] };
        setVerdict();
        await saveReviewRecord(trip.reservationId, { problems: [...current], driverId: trip.driverId || null, guestName: trip.guestName || null });
      });
      toggles.appendChild(button);
    });
    details.appendChild(toggles);

    const notes = document.createElement("textarea");
    notes.className = "hostos-notes";
    notes.rows = 2;
    notes.placeholder = "Notes for next time \u2014 e.g. returned spotless, would host again";
    notes.value = (record && record.notes) || "";
    let notesTimer = null;
    notes.addEventListener("click", (event) => event.stopPropagation());
    // Flush on blur too, so a note is not lost to a queue close within the
    // debounce window.
    notes.addEventListener("blur", () => {
      clearTimeout(notesTimer);
      saveReviewRecord(trip.reservationId, { notes: notes.value.trim(), driverId: trip.driverId || null, guestName: trip.guestName || null });
    });
    notes.addEventListener("input", () => {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => saveReviewRecord(trip.reservationId, { notes: notes.value.trim(), driverId: trip.driverId || null, guestName: trip.guestName || null }), 600);
    });
    details.appendChild(notes);
    card.appendChild(details);

    // The same guest before, from Matt's own records. driverId is the join;
    // a guest with no earlier record simply has no line.
    const history = trip.driverId
      ? Object.values(allRecords || {}).filter((other) => other && other.driverId === trip.driverId
          && String(other.reservationId || "") !== String(trip.reservationId) && Number.isInteger(other.rating))
      : [];
    if (history.length) {
      const line = document.createElement("p");
      line.className = "hostos-history";
      line.textContent = "Your past reviews of this guest: " + history
        .sort((a, b) => HostOS.dates.parseTime(b.reviewedAt) - HostOS.dates.parseTime(a.reviewedAt))
        .map((other) => "\u2605" + other.rating + " " + monthYear(other.reviewedAt))
        .join(" \u00b7 ");
      card.appendChild(line);
    }

    // The rating. From Turo when Matt already gave it in the app; otherwise
    // five buttons. One tap records it and the trip leaves the list; Turo
    // sends the guest the discount code itself after a 5.
    const rating = HostOS.reviews.ratingGiven(trip, record);
    const ratingRow = document.createElement("div");
    ratingRow.className = "hostos-stars";
    const ratingLabel = document.createElement("span");
    ratingLabel.className = "hostos-key";
    ratingLabel.textContent = rating === null ? "Your rating" : trip.hostReviewRating && !(record && record.rating)
      ? "Rated in Turo" : "Rated";
    ratingRow.appendChild(ratingLabel);
    for (let star = 1; star <= 5; star += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hostos-star" + (rating !== null && star <= rating ? " on" : "");
      button.textContent = "\u2605";
      button.setAttribute("aria-label", star + (star === 1 ? " star" : " stars"));
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        button.blur();
        await saveReviewRecord(trip.reservationId, { rating: star, reviewedAt: new Date().toISOString(),
          driverId: trip.driverId || null, guestName: trip.guestName || null, vehicle: trip.vehicle || null, reservationId: trip.reservationId });
      });
      ratingRow.appendChild(button);
    }
    card.appendChild(ratingRow);
    if (rating !== null && !trip.hostReviewedAt) {
      const remind = document.createElement("p");
      remind.className = "hostos-when";
      remind.textContent = "Recorded here \u2014 give the " + rating + "-star rating in the Turo app too."
        + (rating >= 5 ? " Turo sends the guest the discount code itself." : "");
      card.appendChild(remind);
    }

    // Off the list without rating it, for the odd case.
    const extra = document.createElement("button");
    extra.type = "button";
    extra.className = "hostos-secondary";
    extra.textContent = "Dismiss";
    extra.title = "Take this trip off the list without rating it";
    extra.addEventListener("click", async (event) => {
      event.stopPropagation();
      extra.blur();
      await saveReviewRecord(trip.reservationId, { dismissedAt: new Date().toISOString(), reservationId: trip.reservationId });
    });
    const actions = openTripActions(trip.tripUrl, extra);
    if (actions) card.appendChild(actions);
    return card;
  }

  // Sits under the Earnings Estimator: every known vehicle, ordered by what
  // its current trip is estimated to bring in, so the best earners read first
  // and idle cars fall to the bottom. Deliberately no per-vehicle league
  // table of lifetime takings — this panel belongs to an ops assistant
  // working someone else's fleet, and ranking the owner's cars by total
  // revenue is not their business.
  function renderVehicles(container, trips, fleetAvailability) {
    const wrap = document.createElement("div");
    wrap.className = "hostos-vehicle-earnings";

    const heading = document.createElement("p");
    heading.className = "hostos-result-title";
    heading.textContent = "CARS MAKING MONEY";
    wrap.appendChild(heading);

    const vehicles = vehicleList(fleetAvailability);
    if (!vehicles.length) {
      const empty = document.createElement("div");
      empty.className = "hostos-empty-result";
      empty.textContent = "Visit the Turo Calendar page to scan the fleet.";
      wrap.appendChild(empty);
      container.appendChild(wrap);
      return;
    }

    // One active trip per vehicle, matched on plate — the only identifier
    // shared by a reservation card and a calendar row.
    const activeByPlate = new Map();
    trips.forEach((trip) => {
      if (trip.plate && HostOS.dates.isActive(trip)) activeByPlate.set(trip.plate, trip);
    });

    const rows = vehicles.map((entry) => {
      const trip = activeByPlate.get(entry.plate);
      return { entry, trip, estimate: trip ? estimateTripValue(trip, entry) : null };
    });
    // Highest estimated earnings first; anything unpriced (idle, or on a trip
    // whose length isn't known yet) sorts to the bottom, alphabetically.
    rows.sort((a, b) => {
      const aValue = a.estimate ? a.estimate.total : -1;
      const bValue = b.estimate ? b.estimate.total : -1;
      if (aValue !== bValue) return bValue - aValue;
      return String(a.entry.vehicle).localeCompare(String(b.entry.vehicle));
    });

    rows.forEach(({ entry, trip, estimate }) => {
      const card = document.createElement("article");
      card.className = "hostos-result hostos-vehicle-result";
      card.appendChild(cardHead(entry.vehicle + (entry.plate ? " · " + entry.plate : ""), null, null));

      const returnsAt = trip ? formatWhen(trip.returnDate) : null;
      const rows = [];
      if (estimate && returnsAt) {
        // A trip longer than the calendar window is priced by projecting the
        // nights we can see across its full length, so say so rather than
        // presenting an extrapolation as an observation.
        const observed = (entry.prices || []).length;
        const projected = estimate.days > observed && observed > 0;
        rows.push({ label: "Earnings", parts: [moneyNode("≈" + money(estimate.total), "green"),
          " on return " + returnsAt] });
        rows.push({ label: "Trip", parts: [pluralize(estimate.days, "day") + " · ~",
          moneyNode(money(estimate.avgDaily), "green"), "/day",
          projected ? " · projected from " + pluralize(observed, "day") + " of prices" : ""] });
        // Itemised rather than folded silently into the total. The total
        // already included extras, but with nothing on the tile naming them
        // there was no way to tell whether a guest's add-on had been counted —
        // which read as "my extra is missing" when it wasn't.
        if (estimate.extras > 0) {
          rows.push({ label: "Extras", parts: [moneyNode(money(estimate.extras), "green"),
            " · " + describeExtras(trip)] });
        }
      } else if (trip && returnsAt) {
        rows.push({ label: "Status", parts: ["On a trip · returns " + returnsAt] });
      } else {
        rows.push({ label: "Status", parts: ["Not on a trip"] });
      }
      const availability = availabilityLine(entry);
      if (availability) rows.push({ label: "Calendar", parts: [availability] });
      card.appendChild(detailGrid(rows));
      // Only when the vehicle is actually on a trip — an idle car has no
      // reservation page to open, and a dead button would be worse than none.
      const actions = trip ? openTripActions(trip.tripUrl) : null;
      if (actions) card.appendChild(actions);
      wrap.appendChild(card);
    });
    container.appendChild(wrap);
  }

  // The daily roll-up: every trip coming back today, what each is worth, and
  // the day's total. This is the number the ops assistant reports upward, so
  // it says "estimated" on every line and carries its own basis beneath the
  // total rather than presenting itself as a settled figure.
  // This week, this month, and everything booked ahead - net figures from the
  // pricing sweep, attributed to when each trip ends. Sits above today's
  // list so the day reads in the context of the month.
  function renderOutlook(container, trips) {
    const outlook = HostOS.outlook.compute(trips);
    const block = document.createElement("article");
    block.className = "hostos-result hostos-outlook";
    block.appendChild(cardHead("Earnings outlook", "net of Turo's cut", "muted"));
    const rows = [outlook.week, outlook.month, outlook.ahead].map((window) => ({
      label: window.label,
      parts: window.trips
        ? [moneyNode("\u2248" + money(window.total), "green"), " \u00b7 " + pluralize(window.trips)
            + (window.unpriced ? " \u00b7 " + window.unpriced + " not priced yet" : "")]
        : ["no trips"]
    }));
    block.appendChild(detailGrid(rows));
    const note = document.createElement("p");
    note.className = "hostos-when";
    note.textContent = "Each trip's own estimate, counted when it ends. A trip not yet priced is named, not counted as $0.";
    block.appendChild(note);
    container.appendChild(block);
  }

  function renderTodaysEarnings(container, trips, fleetAvailability) {
    const { entries, total, priced } = computeTodaysEarnings(trips, fleetAvailability);

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "hostos-empty-result";
      empty.textContent = "No trips are due back today.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(({ trip, estimate }) => {
      const card = document.createElement("article");
      card.className = "hostos-result hostos-vehicle-result";
      card.appendChild(cardHead(
        (trip.vehicle || "Vehicle") + (trip.plate ? " · " + trip.plate : ""),
        trip.reservationId ? "#" + trip.reservationId : null, "muted"));

      // Past tense once the return time has passed — most of this list is
      // already-completed trips by the afternoon, and "ends at 5:30 AM" reads
      // as though something is still pending.
      const endTime = HostOS.dates.parseTime(trip.returnDate);
      const returned = HostOS.dates.hasReturned(trip);
      const rows = [{ label: returned ? "Ended" : "Ends", parts: [
        endTime === null
          ? "today"
          : new Date(endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " today"
      ] }];

      if (estimate) {
        const parts = [moneyNode("≈" + money(estimate.total), "green"),
          " · " + pluralize(estimate.days, "day") + " · ~", moneyNode(money(estimate.avgDaily), "green"), "/day"];
        if (estimate.extras > 0) parts.push(" + ", moneyNode(money(estimate.extras), "green"), " extras");
        rows.push({ label: "Earnings", parts });
      } else {
        rows.push({ label: "Earnings", parts: [missingEstimateReason(trip, fleetAvailability)] });
      }
      card.appendChild(detailGrid(rows));
      const actions = openTripActions(trip.tripUrl);
      if (actions) card.appendChild(actions);
      container.appendChild(card);
    });

    const totalCard = document.createElement("article");
    totalCard.className = "hostos-daily-total";
    const totalTitle = document.createElement("b");
    totalTitle.textContent = "Total estimated earnings today";
    totalCard.appendChild(totalTitle);
    const totalValue = document.createElement("strong");
    totalValue.textContent = "≈" + money(total);
    totalCard.appendChild(totalValue);
    const basis = document.createElement("small");
    basis.textContent = priced === entries.length
      ? "Gross list value across " + pluralize(entries.length) + ", before Turo's cut"
      : priced + " of " + entries.length + " trips priced · gross, before Turo's cut";
    totalCard.appendChild(basis);
    container.appendChild(totalCard);
  }

  function renderQueue(container, trips, filter, fleetAvailability, extras = {}) {
    container.innerHTML = "";
    container.appendChild(queueHeader(container, LABELS[filter] || LABELS.earnings));

    if (filter === "today") {
      renderOutlook(container, trips);
      renderTodaysEarnings(container, trips, fleetAvailability);
      renderVehicles(container, trips, fleetAvailability);
      return;
    }

    const records = extras.reviewRecords || {};
    if (filter === "reviews") {
      const entries = HostOS.reviews.pending(trips, records).slice(0, 30);
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "hostos-empty-result";
        empty.textContent = "Nothing waiting for a review.";
        container.appendChild(empty);
        return;
      }
      entries.forEach((entry) => container.appendChild(renderReviewCard(entry.trip, entry.record, records)));
      return;
    }

    const groups = computeGroups(trips, records);
    const selected = (groups[filter] || groups.earnings).slice(0, 30);
    if (!selected.length) {
      const empty = document.createElement("div");
      empty.className = "hostos-empty-result";
      empty.textContent = "No matching reservations right now.";
      container.appendChild(empty);
      const held = filter === "earnings" ? unpriceable(trips) : [];
      if (held.length) {
        const note = document.createElement("div");
        note.className = "hostos-held-note";
        note.textContent = pluralize(held.length, "trip") + " read below $0.20/mile but could not be priced, so "
          + (held.length === 1 ? "it is" : "they are") + " not flagged — the figure is a floor and the real one can "
          + "only be higher. The nightly report names the missing inputs.";
        container.appendChild(note);
      }
    } else {
      selected.forEach((trip) => container.appendChild(renderCard(trip, filter, fleetAvailability)));
    }
  }

  // Both the popup/sidebar and the in-page widget report scan failures, and
  // their two hand-written copies of this wording drifted apart before. The
  // distinction matters: "no listener" is not a scan that went wrong, it is
  // a Booked tab whose content script is orphaned (Chrome disconnects every
  // already-open tab when the extension reloads, and only a page refresh
  // reconnects it). Telling someone to reload "the Booked tab" when several
  // are open sent them to refresh the one that was already working.
  function scanFailureText(result) {
    if (result && result.reason === "no-listener") {
      const tried = result.tabsTried || 1;
      return tried > 1
        ? "HostOS is not connected to any of the " + tried + " open Booked tabs. Refresh them all — a tab that was open when the extension last reloaded stays disconnected until it is."
        : "HostOS is not connected to the Booked tab. Refresh it — a tab that was open when the extension last reloaded stays disconnected until it is.";
    }
    return "Scan failed — try reloading the Booked tab.";
  }

  return { LABELS, computeGroups, computeActionCount, computeHeroSummary, tileSubtitles, statCells, renderStats, computeFleetStats, computeTodaysEarnings, availableVehicles, renderQueue, pluralize, money, openTrip, copyText, scanFailureText, extrasChecked, unpriceable, baseRentalFor, vehiclesByPlate, extrasValue, saveReviewRecord };
})();
