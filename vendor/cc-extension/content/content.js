(() => {
  // The service worker marks the reservation URLs it loads for background
  // detail scanning with this query param (see
  // background/service-worker.js's backgroundScanUrl). A normal visit —
  // yours or a guest's — never has it.
  const isBackgroundScan = new URLSearchParams(location.search).get("hostos_bg") === "1";

  if (isBackgroundScan) {
    // Turo is a client-rendered app — the license/mileage/protection data
    // this exists to read loads via API calls *after* document_idle fires,
    // not with the initial page. A normal visit works because you
    // naturally give the page a moment before looking at anything, and the
    // mutation observer keeps re-scanning as data streams in; this path
    // used to skip the observer for speed, so it very likely read a
    // still-loading, empty page every time — and still marked the trip
    // "recently scanned" regardless, so it wouldn't even retry for another
    // 30 minutes.
    //
    // A setTimeout-based poll isn't reliable here either: Chrome throttles
    // JS timers in background (unfocused) tabs — exactly what this tab is,
    // from the moment it's created — so a "poll every 400ms" loop could
    // silently run far slower in real time than intended. A
    // MutationObserver reacts to actual DOM changes directly and isn't
    // subject to that same timer throttling, so it's used as the primary
    // signal; the fallback timer is deliberately generous since even it
    // could be delayed by the same throttling.
    const isReady = () => {
      const licenseEl = document.querySelector(HostOS.selectors.licenseStatus);
      const hasLicenseText = licenseEl && HostOS.parser.text(licenseEl).length > 0;
      const hasSections = document.querySelectorAll(HostOS.selectors.detailsSectionLabel).length > 0;
      // The pickup/return date elements load separately from the license
      // section and sections list — without checking them too, a scan could
      // finish with correct license/mileage data but a null pickupDate,
      // which (correctly) can't overwrite a stale date from an earlier bad
      // capture, leaving the wrong date displayed indefinitely.
      const hasScheduleDates = document.querySelectorAll(HostOS.selectors.scheduleDates).length > 0
        && document.querySelectorAll(HostOS.selectors.scheduleTimes).length > 0;
      return hasLicenseText && hasSections && hasScheduleDates;
    };
    // "complete" vs. "gave up after 15s and read whatever was there" have to
    // be reported differently — otherwise a trip whose schedule section
    // never rendered in time (e.g. Turo shows an "ends in X minutes" banner
    // instead of the normal two-date layout for a trip about to end) gets
    // marked "successfully scanned" exactly like a real success, and then
    // sits untouched for a full cooldown period despite never having
    // actually captured its date.
    const finish = (complete) => {
      HostOS.scanner.scan().finally(() => {
        chrome.runtime.sendMessage({ type: "HOSTOS_DETAIL_SCAN_DONE", complete }).catch(() => {});
      });
    };
    if (isReady()) {
      finish(true);
    } else {
      let settled = false;
      const settle = (complete) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(fallbackTimer);
        finish(complete);
      };
      const observer = new MutationObserver(() => { if (isReady()) settle(true); });
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      const fallbackTimer = setTimeout(() => settle(false), 15000);
    }
    return;
  }

  // Registered FIRST, before any of the bootstrap work below. This listener
  // is what the sidebar's "Scan now" button ultimately reaches (the popup
  // asks the background, which relays here with chrome.tabs.sendMessage) —
  // it lets the panel trigger an on-demand scan of whichever tab actually
  // has the Booked page open, instead of only relying on this tab's passive
  // mutation-observer/fallback timers.
  //
  // It used to be the LAST thing in this file, after a chain of unguarded
  // top-level calls. If any one of them threw, the IIFE aborted before this
  // line and the tab silently lost the ability to answer a manual scan for
  // the rest of its life — while the widget (a separate content script that
  // had already run) carried on rendering stored data, so the panel still
  // looked alive. That surfaced as "Scan failed — try reloading the Booked
  // tab", and reloading never helped, because the same call threw again on
  // the next load. Registering first means a manual scan still works even
  // when some other subsystem is broken.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "HOSTOS_RUN_SCAN") return;
    // Every path here must call sendResponse exactly once. If none does, the
    // port closes with no reply and the background cannot tell "this scan
    // failed" apart from "no content script in this tab at all" — they need
    // different advice, so they must not collapse into one error.
    try {
      HostOS.scanner.scan()
        .then((trips) => sendResponse({ tripsFound: Array.isArray(trips) ? trips.length : 0 }))
        .catch((error) => sendResponse({ error: String((error && error.message) || error) }));
    } catch (error) {
      sendResponse({ error: String((error && error.message) || error) });
    }
    return true;
  });

  // One failing subsystem must not take out the others. These are separate
  // scrapers over separate parts of Turo, and before this a throw in any of
  // them stopped every line after it.
  const step = (name, run) => {
    try { run(); } catch (error) { HostOS.logger.warn("Bootstrap step failed: " + name, error); }
  };

  step("scan", () => HostOS.scanner.scan());
  step("fleetScanner", () => HostOS.fleetScanner?.scanAndSave());
  step("observer", () => HostOS.observer.start());

  // Guest protection plans, via a same-origin JSON fetch rather than a page
  // render — cheap enough to check every known trip, so a Premier booking is
  // caught when it is made rather than when it enters the 72-hour detail
  // window. Runs shortly after load so it does not compete with the first
  // scan, then every few minutes while a Turo tab is open.
  const protectionSweep = () => step("protectionScanner", () => HostOS.protectionScanner?.run());
  setTimeout(protectionSweep, 4000);
  setInterval(protectionSweep, 90 * 1000);

  // Turo's own notification feed, polled for new bookings so a Premier plan
  // is caught within about a minute of booking instead of waiting for the
  // reservation to work through the normal scan queue. Runs ahead of the
  // protection sweep because it is a single small request.
  const activitySweep = () => step("activityScanner", () => HostOS.activityScanner?.run());
  setTimeout(activitySweep, 2000);
  setInterval(activitySweep, 90 * 1000);

  // Trips that have come back: how they went, and whether Matt has rated the
  // guest yet. Two small JSON requests per trip, a handful of trips a day.
  // Runs last of the three so the Premier path is never queued behind it.
  const reviewSweep = () => step("reviewScanner", () => HostOS.reviewScanner?.run());
  setTimeout(reviewSweep, 8000);
  setInterval(reviewSweep, 90 * 1000);
})();
