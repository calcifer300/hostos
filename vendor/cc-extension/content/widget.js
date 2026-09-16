window.HostOS = window.HostOS || {};

(() => {
  if (document.getElementById("hostos-widget")) return;
  // Skip entirely in a tab the background opened for a silent detail scan
  // — it's unfocused and closes in seconds, so a UI panel here would just
  // be wasted work nobody ever sees.
  if (new URLSearchParams(location.search).get("hostos_bg") === "1") return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatAgo(isoValue) {
    const ms = Date.now() - new Date(isoValue).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "just now";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return seconds + "s ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    return Math.round(minutes / 60) + "h ago";
  }

  const root = el("div");
  root.id = "hostos-widget";

  const pill = el("button", "hostos-widget-pill");
  pill.type = "button";
  pill.setAttribute("aria-expanded", "false");
  pill.setAttribute("aria-label", "Open HostOS action summary");
  const pillTitle = el("b", null, "HostOS");
  const pillSummary = el("span", null, "0 action items");
  pill.append(pillTitle, pillSummary);

  const panel = el("div", "hostos-widget-panel");
  panel.hidden = true;

  const header = el("div", "hostos-widget-header");
  const headerLeft = el("div", "hostos-widget-brand");
  // Extension resources need an absolute URL inside a page, and the file must
  // be listed in web_accessible_resources or the page can't load it.
  // The hostOS wordmark John supplied (2026-09-12) is the product name, so it
  // stands in for both the old car mark and the "HostOS" heading. The
  // company eyebrow stays above it. A heading is kept for assistive tech.
  const wordmark = document.createElement("img");
  wordmark.className = "hostos-widget-wordmark";
  wordmark.src = chrome.runtime.getURL("assets/hostos-wordmark.svg");
  wordmark.alt = "hostOS";
  wordmark.height = 24;
  const heading = el("h2", "hostos-visually-hidden", "HostOS");
  const headerText = el("div");
  headerText.append(el("p", "hostos-widget-eyebrow", "COLORADO CRUISERS"), wordmark, heading);
  headerLeft.append(headerText);
  // Doubles as the pause control. Pausing stops background tabs only — the
  // JSON-API work (protection plans, activity feed, Premier alerts) keeps
  // running, so the label says "Tabs paused" rather than a bare "Paused".
  const status = el("button", "hostos-widget-status");
  status.type = "button";
  const statusLabel = el("span", null, "Monitoring");
  status.append(el("i"), statusLabel);
  const collapseButton = el("button", "hostos-widget-collapse", "×");
  collapseButton.type = "button";
  collapseButton.setAttribute("aria-label", "Collapse HostOS panel");
  header.append(headerLeft, status, collapseButton);

  const hero = el("div", "hostos-widget-hero");
  hero.append(el("p", "hostos-widget-eyebrow", "ACTION REQUIRED"));
  const actionCount = el("strong", null, "0");
  const heroLabel = el("span", null, "items need attention");
  const heroSub = el("p", "hostos-widget-hero-sub", "");
  hero.append(actionCount, heroLabel, heroSub);

  function summaryCard(filter, iconText, label, extraClass) {
    const card = el("button", "hostos-widget-card" + (extraClass ? " " + extraClass : ""));
    card.type = "button";
    card.dataset.filter = filter;
    card.append(el("span", "hostos-widget-icon", iconText));
    const textWrap = el("span");
    textWrap.append(el("b", null, label), el("small", null, "0 trips"));
    card.appendChild(textWrap);
    return card;
  }

  const cards = el("div", "hostos-widget-cards");
  const premierCard = summaryCard("premier", "\u26a0", "Premier Plan Bookings", "hostos-widget-premier");
  const licenseCard = summaryCard("license", "!", "Unverified Licenses", "hostos-widget-danger");
  const earningsCard = summaryCard("earnings", "$", "Profit Risk", "hostos-widget-earnings");
  const reviewsCard = summaryCard("reviews", "★", "Pending Reviews", "hostos-widget-reviews");
  const todayCard = summaryCard("today", "↩", "Earnings Estimator", "hostos-widget-today");
  cards.append(premierCard, licenseCard, earningsCard, reviewsCard, todayCard);

  const scanButton = el("button", "hostos-widget-scan-now", "Scan now");
  scanButton.type = "button";
  const scanStatus = el("p", "hostos-widget-scan-status");
  scanStatus.setAttribute("aria-live", "polite");

  const results = el("div", "hostos-results");
  results.setAttribute("aria-live", "polite");
  const stats = el("div", "hostos-widget-stats");
  stats.hidden = true;
  const footer = el("p", "hostos-widget-footer", "Open Turo to begin monitoring.");
  const lastAttemptEl = el("p", "hostos-widget-footer");
  lastAttemptEl.setAttribute("aria-live", "polite");

  panel.append(header, hero, cards, scanButton, scanStatus, results, stats, footer, lastAttemptEl);
  root.append(pill, panel);
  document.documentElement.appendChild(root);

  function setExpanded(expanded) {
    panel.hidden = !expanded;
    pill.setAttribute("aria-expanded", String(expanded));
    root.classList.toggle("hostos-widget-expanded", expanded);
  }

  pill.addEventListener("click", () => setExpanded(panel.hidden));
  collapseButton.addEventListener("click", () => setExpanded(false));

  const PAUSE_ON_TITLE = "Background tabs are open for business. Click to pause them.";
  const PAUSE_OFF_TITLE = "Background tabs are paused. Protection-plan checks and Premier alerts still run — they don't need a tab. Click to resume.";

  function renderPauseState(paused) {
    status.classList.toggle("paused", paused);
    status.setAttribute("aria-pressed", String(paused));
    statusLabel.textContent = paused ? "Tabs paused" : "Monitoring";
    status.title = paused ? PAUSE_OFF_TITLE : PAUSE_ON_TITLE;
  }

  status.addEventListener("click", async () => {
    const { hostosPaused } = await chrome.storage.local.get("hostosPaused");
    const next = !hostosPaused;
    await chrome.storage.local.set({ hostosPaused: next });
    renderPauseState(next);
  });

  cards.addEventListener("click", (event) => {
    const card = event.target.closest(".hostos-widget-card");
    if (!card) return;
    results.dataset.filter = card.dataset.filter;
    HostOS.queueView.renderQueue(results, latestTrips, card.dataset.filter, latestFleet, latestExtras);
    results.classList.add("visible");
  });

  // Split into label and note so the reservation number sits directly after
  // the noun it belongs to, instead of being pushed behind a parenthetical.
  const ATTEMPT_LABELS = {
    "in-progress": { label: "checking reservation" },
    success: { label: "successfully scanned reservation" },
    incomplete: { label: "partially scanned reservation", note: "the dates didn't load in time, so it will retry soon" },
    "timed-out": { label: "timed out on reservation", note: "the page never showed its data in time" },
    "tab-failed-to-open": { label: "couldn't open a background tab for reservation" },
    "closed-early": { label: "background tab closed early for reservation", note: "it will retry" }
  };

  function renderLastAttempt(lastAttempt) {
    if (!lastAttempt) { lastAttemptEl.textContent = ""; lastAttemptEl.className = "hostos-widget-footer"; return; }
    const attempt = ATTEMPT_LABELS[lastAttempt.result] || { label: lastAttempt.result };
    lastAttemptEl.textContent = "Last background scan: " + attempt.label + " #" + lastAttempt.reservationId
      + (attempt.note ? " (" + attempt.note + ")" : "") + " · " + formatAgo(lastAttempt.at);
    lastAttemptEl.className = "hostos-widget-footer" + (lastAttempt.result === "success" ? " hostos-widget-scan-ok" : lastAttempt.result === "in-progress" || lastAttempt.result === "incomplete" ? "" : " hostos-widget-scan-error");
  }

  let latestTrips = [];
  let latestFleet = null;
  let latestExtras = {};

  async function render() {
    const { hostosTrips: trips = [], hostosLastScan: lastScan, hostosDetailStatus: detailStatus = {}, hostosFleetAvailability: fleetAvailability = null, hostosPaused = false,
      hostosReviews: reviewRecords = {} } = await chrome.storage.local.get(["hostosTrips", "hostosLastScan", "hostosDetailStatus", "hostosFleetAvailability", "hostosPaused", "hostosReviews"]);
    renderPauseState(Boolean(hostosPaused));
    latestTrips = trips;
    latestFleet = fleetAvailability;
    latestExtras = { reviewRecords };
    const groups = HostOS.queueView.computeGroups(trips, reviewRecords);
    const fleet = HostOS.queueView.computeFleetStats(trips);
    const available = HostOS.queueView.availableVehicles(fleetAvailability);
    // The hero counts deadline-bound work; reviews ride underneath. Tile
    // subtitles carry the rule each count is of.
    const hero = HostOS.queueView.computeHeroSummary(groups);
    pillSummary.textContent = hero.urgent + (hero.urgent === 1 ? " action item" : " action items")
      + (hero.reviews ? " · " + hero.reviews + " reviews" : "");
    actionCount.textContent = String(hero.urgent);
    heroLabel.textContent = hero.label;
    heroSub.textContent = hero.headline + " · " + hero.sub;
    renderLastAttempt(detailStatus.lastAttempt);
    const subtitles = HostOS.queueView.tileSubtitles(groups, trips, fleetAvailability);
    premierCard.querySelector("small").textContent = subtitles.premier;
    premierCard.classList.toggle("hostos-widget-alert", groups.premier.length > 0);
    licenseCard.querySelector("small").textContent = subtitles.license;
    earningsCard.querySelector("small").textContent = subtitles.earnings;
    reviewsCard.querySelector("small").textContent = subtitles.reviews;
    todayCard.querySelector("small").textContent = subtitles.today;

    // Never rebuild the queue out from under a hand that is in it. hostosTrips
    // changes every few seconds on a Turo page and this runs every 15s
    // besides; the review queue has a notes box and toggles, and rebuilding
    // it mid-sentence threw the focus (and the unsaved words) away. Actions
    // that should remove a card blur themselves first, so their rebuild
    // still happens.
    const handInQueue = results.contains(document.activeElement);
    if (results.classList.contains("visible") && !handInQueue) HostOS.queueView.renderQueue(results, trips, results.dataset.filter || "earnings", fleetAvailability, latestExtras);

    // "scanned" reflects the list scan, which refreshes almost continuously
    // on Turo's page — it can't tell you if the background detail-scan
    // queue is actually running. "queue" (hostosDetailStatus.updatedAt) is
    // the real signal: if it's stuck far behind "scanned", the detail-scan
    // queue itself has stalled even though the page is still being read.
    const queueAge = detailStatus.updatedAt ? formatAgo(detailStatus.updatedAt) : "never run";
    stats.hidden = !lastScan;
    if (lastScan) HostOS.queueView.renderStats(stats, HostOS.queueView.statCells(fleet, available.length, detailStatus, formatAgo(lastScan), queueAge));
    footer.hidden = Boolean(lastScan);
    footer.textContent = lastScan ? "" : "Open Turo to begin monitoring.";
  }

  function setScanStatus(text, className) {
    scanStatus.textContent = "";
    scanStatus.className = "hostos-widget-scan-status" + (className ? " " + className : "");
    if (typeof text === "string") { scanStatus.textContent = text; return; }
    scanStatus.appendChild(text);
  }

  // Explicit, on-demand scan with real feedback — checks whether Turo's
  // Booked page is actually open before doing anything, rather than
  // silently depending on the passive mutation-observer/alarm timers.
  scanButton.addEventListener("click", async () => {
    scanButton.disabled = true;
    setScanStatus("Checking for the Turo Booked page…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "HOSTOS_RUN_SCAN" });
      if (result && result.ok) {
        setScanStatus("Scanned — " + HostOS.queueView.pluralize(result.tripsFound || 0, "reservation") + " found on screen.", "hostos-widget-scan-ok");
      } else if (result && result.reason === "no-booked-tab") {
        const message = document.createElement("span");
        message.textContent = "Turo's Booked page isn't open. ";
        const openLink = document.createElement("a");
        openLink.href = "#";
        openLink.textContent = "Open it";
        openLink.addEventListener("click", (event) => {
          event.preventDefault();
          HostOS.queueView.openTrip("https://turo.com/us/en/trips/booked");
        });
        message.appendChild(openLink);
        setScanStatus(message, "hostos-widget-scan-error");
      } else {
        setScanStatus(HostOS.queueView.scanFailureText(result), "hostos-widget-scan-error");
      }
    } catch (error) {
      setScanStatus("Couldn't reach the extension background — try reloading the extension.", "hostos-widget-scan-error");
    } finally {
      scanButton.disabled = false;
    }
  });

  chrome.storage.onChanged.addListener(render);
  render();
  // Re-renders periodically so the "Xs/m ago" text keeps ticking even when
  // nothing new has been scanned, visibly proving the panel is alive.
  setInterval(render, 15000);
})();
