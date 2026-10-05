window.HostOS = window.HostOS || {};

HostOS.scanner = (() => {
  // Turo links to a reservation from several places and not all of them are
  // the trip page. The activity feed links to /reservation/{id}/receipt, which
  // a co-host account cannot open at all - it renders "Error loading receipt".
  // The link selector matches ANY /reservation/ anchor, so one of those was
  // stored as a trip URL, and the background scanner then opened it forever:
  // the page never renders, the scan reports incomplete, and an incomplete
  // scan deliberately bypasses the rescan cooldown. The queue is single-flight,
  // so one unopenable receipt starved every other trip of detail scans.
  //
  // The reservation id is authoritative, so rebuild the canonical trip URL from
  // it rather than trusting whichever anchor happened to match. This also
  // strips hostos_bg=1 when a detail scan reads its own address.
  function canonicalTripUrl(id, fallback) {
    return /^d+$/.test(String(id))
      ? "https://turo.com/us/en/reservation/" + id
      : fallback;
  }

  function buildTrip(element, sectionDate) {
    const link = element.matches("a") ? element : element.querySelector(HostOS.selectors.tripLinks);
    const text = HostOS.parser.text(element);
    const url = link ? new URL(link.href, location.origin).href : null;
    const vehicleMatch = text.match(/([A-Z][A-Za-z0-9-]*(?:\s+[A-Za-z0-9-]+){1,6}\s+(?:19|20)\d{2})/);
    const guestMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)?)\s+#(\d{5,})/);
    const timeMatch = text.match(/\b(Ended|Ending|Starting|Starts?|Pickup|Return)\s+(?:at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    // The reservation URL's numeric path segment matches the detail page's
    // "Reservation #" id exactly, so prefer it over text guesses (a naive
    // split-on-"/" would also break if Turo ever adds a query string).
    const urlId = url && new URL(url).pathname.match(/\/reservation\/(\d+)/);
    const id = (urlId && urlId[1]) || HostOS.parser.reservationId(text) ||
      (guestMatch && guestMatch[2]) || [vehicleMatch && vehicleMatch[1], timeMatch && timeMatch[2], text.slice(0, 80)].filter(Boolean).join("|");

    // The reservation URL is authoritative. Keep the card even if Turo
    // changes its vehicle-title formatting; details can be filled later.
    if (!id) return null;

    // The license plate is the last <p> in the card — verified against all
    // 149 live cards, every one of which ended with one. Turo gives it no
    // data-testid and only a hashed css class, so position plus a shape check
    // is the stable read. Observed shapes: DJIF67, DXZQO1, EOD073 — always 6
    // mixed alphanumerics, never purely letters or digits. The plate is the
    // only join key between a reservation and its fleet-calendar row (the
    // calendar's reservation bars carry no reservation id, and this fleet has
    // six "Nissan Pathfinder 2024"s, so the model name cannot identify a row).
    const paragraphs = element.querySelectorAll ? [...element.querySelectorAll("p")] : [];
    const lastParagraph = paragraphs.length ? HostOS.parser.text(paragraphs[paragraphs.length - 1]) : "";
    const plate = /^[A-Z0-9]{5,8}$/.test(lastParagraph) && /[A-Z]/.test(lastParagraph) && /\d/.test(lastParagraph)
      ? lastParagraph
      : null;

    const ending = timeMatch && /^(ended|ending)$/i.test(timeMatch[1]);
    const starting = timeMatch && /^(starting|starts?|pickup)$/i.test(timeMatch[1]);
    const eventTime = timeMatch ? HostOS.parser.dateAt(sectionDate || new Date(), timeMatch[2]) : null;

    return {
      reservationId: id,
      guestName: guestMatch ? guestMatch[1] : null,
      guestProfile: null,
      vehicle: vehicleMatch ? vehicleMatch[1] : "Vehicle unavailable",
      plate,
      pickupDate: starting ? eventTime : null,
      pickupTime: starting && timeMatch ? timeMatch[2].toUpperCase().replace(/\s+/g, " ") : null,
      returnDate: ending ? eventTime : null,
      returnTime: ending && timeMatch ? timeMatch[2].toUpperCase().replace(/\s+/g, " ") : null,
      tripStatus: ending ? (eventTime && new Date(eventTime).getTime() > Date.now() ? "ending" : "ended") : (starting ? "starting" : /in progress/i.test(text) ? "in_progress" : "booked"),
      tripUrl: canonicalTripUrl(id, url),
      licenseVerified: null,
      // null (not false) so a later list rescan can't clobber a value the
      // detail scraper already learned — mergeTrip only overwrites fields
      // that are non-null on the incoming object.
      protectionLevel: null,
      protectionPlanName: null,
      guestMaxOutOfPocket: null,
      estimatedMiles: null,
      pricePerMile: null,
      riskReasons: [],
      scannedAt: new Date().toISOString(),
      rawText: text.slice(0, 1000)
    };
  }

  function findTripElements() {
    const found = new Set();
    HostOS.selectors.tripCards.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => found.add(element));
    });

    document.querySelectorAll("a[href*='/reservation/']").forEach((element) => found.add(element));

    // Turo's booked-trip cards may not include a direct trip anchor. Their
    // human-readable time and model-year vehicle label are stable fallbacks.
    const timePattern = /\b(?:Ended|Ending|Starting|Starts?|Pickup|Return)\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM)/i;
    const vehiclePattern = /\b(?:19|20)\d{2}\b/;
    const walker = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!timePattern.test(node.nodeValue || "")) continue;
      let candidate = node.parentElement;
      for (let depth = 0; candidate && depth < 8; depth += 1, candidate = candidate.parentElement) {
        const candidateText = HostOS.parser.text(candidate);
        if (candidateText.length < 1800 && vehiclePattern.test(candidateText)) {
          found.add(candidate);
          break;
        }
      }
    }
    return [...found];
  }

  // Finds a ".detailsSection-label" by its exact text (e.g. "Total Miles
  // Included") and returns the text of that section's description block.
  // This walks Turo's real section structure instead of guessing where a
  // label sits in the page's raw text.
  function sectionValue(root, labelText) {
    const label = [...root.querySelectorAll(HostOS.selectors.detailsSectionLabel)]
      .find((element) => HostOS.parser.text(element).toLowerCase() === labelText.toLowerCase());
    if (!label) return null;
    const section = label.closest(".detailsSection");
    const description = section && section.querySelector(HostOS.selectors.detailsSectionDescription);
    return description ? HostOS.parser.text(description) : null;
  }

  // Turo's schedule-date text omits the year (e.g. "Mon, Aug 24"). Infer it
  // from today's date, rolling forward a year only if that would otherwise
  // land nearly a year in the past — a real December-booked-for-January
  // trip reads as ~360 days "in the past" if parsed with the current year,
  // nothing close to that for an ordinary trip. The old 24-hour threshold
  // was far too sensitive: it rolled ANY recently-past date (e.g. a trip
  // that simply happened a few days ago) a full year into the future,
  // which then made it look like a genuinely upcoming trip.
  function scheduleDateTime(root, index) {
    const dateEl = root.querySelectorAll(HostOS.selectors.scheduleDates)[index];
    const timeEl = root.querySelectorAll(HostOS.selectors.scheduleTimes)[index];
    const dateText = dateEl && HostOS.parser.text(dateEl);
    const timeText = timeEl && HostOS.parser.text(timeEl);
    if (!dateText || !timeText) return null;
    const now = new Date();
    let parsed = new Date(dateText + ", " + now.getFullYear() + " " + timeText);
    const YEAR_WRAP_THRESHOLD_MS = 270 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(parsed.getTime()) && parsed.getTime() < now.getTime() - YEAR_WRAP_THRESHOLD_MS) {
      parsed = new Date(dateText + ", " + (now.getFullYear() + 1) + " " + timeText);
    }
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  // Extras a guest bought on top of the trip (EV recharge, booster seat, and
  // so on). Each is billed either once for the whole trip or per day, and
  // Turo prints which — "$55" and "/trip" as separate elements — so the unit
  // is read rather than assumed. Quantity is captured too, since a guest can
  // buy more than one of the same extra.
  function buildExtras(root) {
    const parsed = [...root.querySelectorAll(HostOS.selectors.extraDetails)].map((node) => {
      const details = HostOS.parser.text(node.querySelector(HostOS.selectors.extraDetailsPrice));
      const priceMatch = details.match(/\$([\d,]+(?:\.\d{1,2})?)\s*\/\s*(trip|day)/i);
      if (!priceMatch) return null;
      const quantityMatch = HostOS.parser.text(node.querySelector(HostOS.selectors.extraDetailsQuantity))
        .match(/Quantity:\s*(\d+)/i);
      const nameNode = node.querySelector("p");
      return {
        name: nameNode ? HostOS.parser.text(nameNode) : "Extra",
        price: Number(priceMatch[1].replace(/,/g, "")),
        // "trip" = charged once for the booking, "day" = charged per day.
        unit: priceMatch[2].toLowerCase(),
        quantity: quantityMatch ? Number(quantityMatch[1]) : 1
      };
    }).filter(Boolean);
    if (parsed.length) return parsed;
    // Confirmed live by polling a loading reservation page: Turo renders the
    // whole details block in one pass — all 12 section labels, the mileage
    // figure and any extras appeared together between 5.5s and 6.5s, never
    // partially. So once any section label exists, an absent extras block
    // genuinely means the guest bought none, and [] is the honest answer.
    //
    // Before that, report unknown (null) instead, so mergeTrip won't wipe
    // extras an earlier scan already captured. This matters on the 15-second
    // fallback path in content.js, which scans whether or not the page ever
    // finished rendering.
    const rendered = root.querySelectorAll(HostOS.selectors.detailsSectionLabel).length > 0;
    return rendered ? [] : null;
  }

  function buildDetailTrip(root = document, url = location.href) {
    const urlMatch = new URL(url).pathname.match(/\/reservation\/(\d+)/);
    const textMatch = HostOS.parser.text(root.body || root).match(/Reservation #(\d+)/i);
    const id = (urlMatch && urlMatch[1]) || (textMatch && textMatch[1]);
    if (!id) return null;

    // Strip the background-scan marker (added by the service worker to
    // tell this tab it's an invisible scraping window) before storing —
    // otherwise it would end up saved as part of tripUrl and get carried
    // into "Open trip" links and future background-scan requests.
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete("hostos_bg");
    url = cleanUrl.toString();

    const tripLabel = [...root.querySelectorAll(HostOS.selectors.detailsSectionLabel)]
      .map((element) => HostOS.parser.text(element))
      .find((value) => /['’]s trip$/i.test(value));
    const guestName = tripLabel ? tripLabel.replace(/['’]s trip$/i, "").trim() : null;

    const licenseText = HostOS.parser.text(root.querySelector(HostOS.selectors.licenseStatus));
    const licenseVerified = licenseText ? /confirmed/i.test(licenseText) : null;

    const milesText = sectionValue(root, "Total Miles Included");
    const milesMatch = milesText && milesText.match(/([\d,]+)\s*miles/i);

    // The per-mile overage rate ("can be charged $0.30 for every mile over
    // the total included") is the only per-mile dollar figure Turo actually
    // shows on the reservation page, and is what hosts use for the
    // $0.20/mile economics check.
    const overageText = HostOS.parser.text(root.querySelector(HostOS.selectors.mileageOverage));
    const overageMatch = overageText.match(/\$([\d.]+)\s*for every mile over/i);

    // "Damage responsibility" here is the HOST's own deductible under Matt's
    // chosen earnings plan — NOT the guest's protection plan. Confirmed on
    // reservation 57760996, which reads $2,750.00 in this section while the
    // guest held a $0 Premier plan; the words "Premier", "protection plan"
    // and "out-of-pocket" appear nowhere on this page. It was previously
    // misread as the guest's deductible, which meant the zero-deductible
    // risk check could never fire for any trip.
    //
    // Kept because the host's exposure per trip is genuinely useful, but
    // stored under an honest name. The guest's plan is read separately in
    // content/protectionScanner.js.
    const earningsText = sectionValue(root, "Earnings plan");
    const damageMatch = earningsText && earningsText.match(/Damage responsibility:\s*\$([\d,.]+)/i);
    const hostDamageResponsibility = damageMatch ? Number(damageMatch[1].replace(/,/g, "")) : null;

    // Only bubbles NOT wrapped in the "sent" marker are the guest's own
    // messages; that marker was confirmed present on every host-authored
    // bubble in a live thread.
    const guestMessages = [...root.querySelectorAll(HostOS.selectors.messageBubbles)]
      .filter((bubble) => !bubble.closest(HostOS.selectors.messageSentMarker))
      .map((bubble) => HostOS.parser.text(bubble))
      .join(" \n ")
      .slice(0, 12000);

    const pickupDate = scheduleDateTime(root, 0);
    const returnDate = scheduleDateTime(root, 1);

    // Headings only, on purpose. The page also carries the guest's messages,
    // and "cancelled trip" in a guest's own words about some other booking
    // must not cancel this one. The heading is Turo's statement.
    const cancelled = [...root.querySelectorAll(HostOS.selectors.pageHeadings)]
      .some((element) => /^cancel+ed trip$/i.test(HostOS.parser.text(element)));

    const detail = {
      reservationId: id,
      guestName,
      tripUrl: canonicalTripUrl(id, url),
      pickupDate,
      returnDate,
      licenseVerified,
      hostDamageResponsibility,
      estimatedMiles: milesMatch ? Number(milesMatch[1].replace(/,/g, "")) : null,
      pricePerMile: overageMatch ? Number(overageMatch[1]) : null,
      // An empty array survives mergeTrip's null/"" filter, so a reservation
      // that genuinely has no extras still clears a stale list — extras can
      // be removed from a booking. buildExtras returns null (not []) while
      // the page is still blank, which mergeTrip does skip.
      extras: buildExtras(root),
      guestMessages,
      scannedAt: new Date().toISOString(),
      detailScannedAt: new Date().toISOString(),
      detailScanVersion: HostOS.constants.DETAIL_SCAN_VERSION,
      // Neither date element rendered in time (e.g. a trip that's about to
      // end may show an "ends in X minutes" banner instead of the normal
      // schedule layout) — this scan still merges whatever it did capture,
      // but shouldn't count as fully up to date the way a complete scan
      // does, so the background knows to retry it soon rather than waiting
      // out the normal cooldown on stale/missing dates.
      // A cancelled page has nothing further to give - its dates render struck
      // through, or not at all - so it counts as complete rather than sitting
      // in the retry loop an unrenderable page gets.
      detailScanComplete: cancelled || Boolean(pickupDate || returnDate)
    };
    if (cancelled) {
      detail.cancelled = true;
      detail.cancelledSignal = "page heading";
      detail.cancelledSeenAt = new Date().toISOString();
    }
    return HostOS.riskEngine.enrich(detail);
  }

  function mergeTrip(existing, fresh) {
    const merged = { ...(existing || {}) };
    Object.entries(fresh).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") merged[key] = value;
    });
    return HostOS.riskEngine.enrich(merged);
  }

  // Matches "Monday, August 25, 2026" exactly — a full weekday name, month
  // name, day, and 4-digit year. Deliberately strict: the previous version
  // accepted any short leaf-element text that merely happened to parse as
  // a valid Date and contain 4 digits, which meant something as unrelated
  // as a lone vehicle-year badge ("2026") could get misidentified as a
  // date-section header — and new Date("2026") parses as January 1, 2026,
  // corrupting the pickup/return date of every card anchored beneath it.
  const DATE_HEADER_PATTERN = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/;

  function findDateSections() {
    const root = document.querySelector("main") || document.body;
    return [...root.querySelectorAll("*")].flatMap((element) => {
      // Date labels are short, standalone text (for example, "Today" or
      // "Monday, August 24, 2026"). Avoid card content and parent containers.
      const label = HostOS.parser.text(element);
      if (element.children.length || label.length > 40) return [];
      if (/^today$/i.test(label)) return [{ element, date: new Date() }];
      if (!DATE_HEADER_PATTERN.test(label)) return [];
      const parsed = new Date(label);
      return Number.isFinite(parsed.getTime()) ? [{ element, date: parsed }] : [];
    });
  }

  function dateForCard(card, sections) {
    let date = null;
    sections.forEach((section) => {
      if (section.element.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) date = section.date;
    });
    return date;
  }

  // Trips are kept for a while after they end — the Earnings Estimator reports
  // on trips that finished today, and a just-returned trip may still need a
  // detail scan. Beyond that they're dead weight: the array is read and
  // rewritten on every scan, and it only ever grew.
  const TRIP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  function pruneFinished(trips) {
    const cutoff = Date.now() - TRIP_RETENTION_MS;
    const cancelledCutoff = Date.now() - HostOS.constants.CANCELLED_RETENTION_MS;
    return trips.filter((trip) => {
      // A cancelled reservation is kept, flagged, for a while - so that a
      // stray rediscovery merges onto the flag instead of standing up a fresh
      // live-looking record - and then let go.
      if (HostOS.dates.isCancelled(trip)) {
        const seen = HostOS.dates.parseTime(trip.cancelledSeenAt);
        return seen === null || seen >= cancelledCutoff;
      }
      const ret = HostOS.dates.parseTime(trip.returnDate);
      // Anything without a known return date is kept — an unscanned or
      // in-flight trip must never be dropped just for being incomplete.
      if (ret === null) return true;
      return ret >= cutoff;
    });
  }

  async function scan() {
    try {
      const savedTrips = await HostOS.storage.getTrips();
      const detailTrip = buildDetailTrip();
      if (detailTrip) {
        const byId = new Map(savedTrips.map((trip) => [trip.reservationId, trip]));
        // Counted so a page that can never render stops being retried on every
        // pass. An incomplete scan bypasses the cooldown on purpose - a trip
        // whose dates were merely slow deserves another look straight away -
        // but that is only true while the failure might be transient.
        const previous = byId.get(detailTrip.reservationId);
        detailTrip.detailScanFailures = detailTrip.detailScanComplete === false
          ? (HostOS.parser.number(previous && previous.detailScanFailures) || 0) + 1
          : 0;
        byId.set(detailTrip.reservationId, mergeTrip(byId.get(detailTrip.reservationId), detailTrip));
        const enrichedTrips = [...byId.values()];
        await HostOS.storage.saveTrips(enrichedTrips);
        HostOS.logger.info("Reservation detail scanned.", { reservationId: detailTrip.reservationId });
        return enrichedTrips;
      }
      // Turo's Booked list only renders the cards currently scrolled into
      // view (it's virtualized), so this scan only ever sees a subset of
      // all known reservations. Merge onto the FULL saved set rather than
      // replacing it — otherwise every scan would silently delete detail
      // data (license/earnings) already learned for any trip not currently
      // on screen, including ones the background detail-scan just finished.
      const dateSections = findDateSections();
      const trips = findTripElements().map((element) => buildTrip(element, dateForCard(element, dateSections))).filter(Boolean);
      const byId = new Map(savedTrips.map((trip) => [trip.reservationId, trip]));
      trips.forEach((trip) => byId.set(trip.reservationId, mergeTrip(byId.get(trip.reservationId), trip)));
      // Repairs URLs written before canonicalTripUrl existed - the activity
      // feed's /receipt link above all, which could never be opened and so was
      // retried forever. New records cannot get one; this rewrites the ones
      // already saved, so the card's "Open trip" goes to the right place too.
      const uniqueTrips = pruneFinished([...byId.values()]).map((trip) => {
        const canonical = canonicalTripUrl(trip.reservationId, trip.tripUrl);
        return canonical === trip.tripUrl ? trip : { ...trip, tripUrl: canonical };
      });
      await HostOS.storage.saveTrips(uniqueTrips);
      HostOS.logger.info("Scan completed.", { tripsFound: trips.length, totalKnown: uniqueTrips.length });
      // If a page that should be full of trip cards yields none, Turo has
      // almost certainly changed its markup. Recorded so the panel can say so
      // out loud — the alternative is the extension quietly reporting an empty
      // fleet and looking like everything is fine.
      await chrome.storage.local.set({
        hostosScanHealth: {
          cardsFound: trips.length,
          onBookedPage: /\/trips\/booked/i.test(location.pathname),
          at: new Date().toISOString()
        }
      });
      // Detail scanning (license/mileage/protection) now runs from the
      // background service worker via real background tabs, not from here —
      // see background/service-worker.js's detail-scan queue.
      return uniqueTrips;
    } catch (error) {
      HostOS.logger.warn("Scan skipped because the page could not be read.", error);
      return [];
    }
  }

  return { scan, buildDetailTrip };
})();
