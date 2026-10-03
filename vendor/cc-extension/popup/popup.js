const $ = (id) => document.getElementById(id);

let latestTrips = [];
let latestFleet = null;

function formatAgo(isoValue) {
  const ms = Date.now() - new Date(isoValue).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  return Math.round(minutes / 60) + "h ago";
}

// Split into label and note so the reservation number sits directly after the
// noun it belongs to, instead of being pushed behind a parenthetical.
const ATTEMPT_LABELS = {
  "in-progress": { label: "checking reservation" },
  success: { label: "successfully scanned reservation" },
  incomplete: { label: "partially scanned reservation", note: "the dates didn't load in time, so it will retry soon" },
  "timed-out": { label: "timed out on reservation", note: "the page never showed its data in time" },
  "tab-failed-to-open": { label: "couldn't open a background tab for reservation" },
  "closed-early": { label: "background tab closed early for reservation", note: "it will retry" }
};

// A silent zero is the dangerous failure: Turo changes its markup, the
// scanner finds nothing, and the panel calmly reports an empty fleet as
// though all were well. Only raised on the Booked page, which should never
// legitimately be empty for this account.
function renderScanHealth(health) {
  const el = $("scanHealth");
  if (!el) return;
  const broken = health && health.onBookedPage && health.cardsFound === 0;
  el.textContent = broken
    ? "No trip cards found on the Booked page — Turo may have changed its layout. Check content/selectors.js."
    : "";
  el.className = "footer" + (broken ? " attempt-error" : "");
}

function renderLastAttempt(lastAttempt) {
  const el = $("lastAttempt");
  if (!lastAttempt) { el.textContent = ""; el.className = "footer"; return; }
  const attempt = ATTEMPT_LABELS[lastAttempt.result] || { label: lastAttempt.result };
  el.textContent = "Last background scan: " + attempt.label + " #" + lastAttempt.reservationId
    + (attempt.note ? " (" + attempt.note + ")" : "") + " · " + formatAgo(lastAttempt.at);
  el.className = "footer" + (lastAttempt.result === "success" ? " attempt-success" : lastAttempt.result === "in-progress" || lastAttempt.result === "incomplete" ? "" : " attempt-error");
}

let latestExtras = {};
function showQueue(filter) {
  const root = $("results");
  HostOS.queueView.renderQueue(root, latestTrips, filter, latestFleet, latestExtras);
  root.classList.add("visible");
  root.dataset.filter = filter;
}

async function render() {
  const { hostosTrips: trips = [], hostosLastScan: lastScan, hostosDetailStatus: detailStatus = {}, hostosFleetAvailability: fleetAvailability = null, hostosPaused = false, hostosScanHealth = null,
    hostosReviews: reviewRecords = {} } = await chrome.storage.local.get(["hostosTrips", "hostosLastScan", "hostosDetailStatus", "hostosFleetAvailability", "hostosPaused", "hostosScanHealth", "hostosReviews"]);
  renderPauseState(Boolean(hostosPaused));
  latestExtras = { reviewRecords };
  const groups = HostOS.queueView.computeGroups(trips, reviewRecords);
  const fleet = HostOS.queueView.computeFleetStats(trips);
  const available = HostOS.queueView.availableVehicles(fleetAvailability);
  const subtitles = HostOS.queueView.tileSubtitles(groups, trips, fleetAvailability);
  $("premierCount").textContent = subtitles.premier;
  document.querySelector(".card.premier").classList.toggle("alert", groups.premier.length > 0);
  $("licenseCount").textContent = subtitles.license;
  $("earningsCount").textContent = subtitles.earnings;
  $("reviewsCount").textContent = subtitles.reviews;
  $("todayCount").textContent = subtitles.today;
  const hero = HostOS.queueView.computeHeroSummary(groups);
  $("actionCount").textContent = String(hero.urgent);
  $("heroLabel").textContent = hero.label;
  $("heroSub").textContent = hero.headline + " · " + hero.sub;
  latestTrips = trips;
  latestFleet = fleetAvailability;
  // Same guard as the in-page panel: the review queue has inputs, and a
  // rebuild while one is focused throws the focus away.
  if ($("results").classList.contains("visible") && !$("results").contains(document.activeElement)) showQueue($("results").dataset.filter || "earnings");
  renderLastAttempt(detailStatus.lastAttempt);
  renderScanHealth(hostosScanHealth);
  if (lastScan) {
    // "scanned" reflects the list scan, which refreshes almost continuously
    // on Turo's page — it can't tell you if the background detail-scan
    // queue is actually running. "queue" (hostosDetailStatus.updatedAt) is
    // the real signal: if it's stuck far behind "scanned", the detail-scan
    // queue itself has stalled even though the page is still being read.
    const queueAge = detailStatus.updatedAt ? formatAgo(detailStatus.updatedAt) : "never run";
    HostOS.queueView.renderStats($("stats"), HostOS.queueView.statCells(fleet, available.length, detailStatus, formatAgo(lastScan), queueAge));
    $("stats").hidden = false;
    $("lastUpdated").hidden = true;
  } else {
    $("stats").hidden = true;
    $("lastUpdated").hidden = false;
    $("lastUpdated").textContent = "Open Turo to begin monitoring.";
  }
}

// Pausing stops background tabs only. The wording says so rather than just
// "Paused", so nobody assumes the Premier alerts to Matt have stopped too —
// those run over the JSON APIs and need no tab.
const PAUSE_ON_TITLE = "Background tabs are open for business. Click to pause them.";
const PAUSE_OFF_TITLE = "Background tabs are paused. Protection-plan checks and Premier alerts still run — they don't need a tab. Click to resume.";

function renderPauseState(paused) {
  const button = $("pauseToggle");
  button.classList.toggle("paused", paused);
  button.setAttribute("aria-pressed", String(paused));
  button.querySelector("span").textContent = paused ? "Tabs paused" : "Monitoring";
  button.title = paused ? PAUSE_OFF_TITLE : PAUSE_ON_TITLE;
}

async function togglePause() {
  const { hostosPaused } = await chrome.storage.local.get("hostosPaused");
  const next = !hostosPaused;
  await chrome.storage.local.set({ hostosPaused: next });
  renderPauseState(next);
}

function setScanStatus(text, className) {
  const el = $("scanStatus");
  el.textContent = "";
  el.className = "scan-status" + (className ? " " + className : "");
  if (typeof text === "string") { el.textContent = text; return; }
  el.appendChild(text);
}

// Explicit, on-demand scan with real feedback — checks whether Turo's
// Booked page is actually open before doing anything, rather than silently
// depending on the passive mutation-observer/alarm timers the user has to
// take on faith.
async function runScanNow() {
  const button = $("scanNow");
  button.disabled = true;
  setScanStatus("Checking for the Turo Booked page…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "HOSTOS_RUN_SCAN" });
    if (result && result.ok) {
      setScanStatus("Scanned — " + HostOS.queueView.pluralize(result.tripsFound || 0, "reservation") + " found on screen.", "scan-ok");
    } else if (result && result.reason === "no-booked-tab") {
      const message = document.createElement("span");
      message.textContent = "Turo's Booked page isn't open. ";
      const openLink = document.createElement("a");
      openLink.href = "#";
      openLink.textContent = "Open it";
      openLink.addEventListener("click", (event) => {
        event.preventDefault();
        chrome.tabs.create({ url: "https://turo.com/us/en/trips/booked" });
      });
      message.appendChild(openLink);
      setScanStatus(message, "scan-error");
    } else {
      setScanStatus(HostOS.queueView.scanFailureText(result), "scan-error");
    }
  } catch (error) {
    setScanStatus("Couldn't reach the extension background — try reloading the extension.", "scan-error");
  } finally {
    button.disabled = false;
  }
}

render();
setInterval(render, 15000);
chrome.storage.onChanged.addListener(render);
document.querySelectorAll(".card[data-filter]").forEach((card) => {
  card.addEventListener("click", () => showQueue(card.dataset.filter));
});
$("scanNow").addEventListener("click", runScanNow);
$("pauseToggle").addEventListener("click", togglePause);
