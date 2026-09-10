// sync.js
// Shared HostOS Companion sync logic. Loaded by BOTH the background service
// worker (via importScripts, driving the 60-second alarm) and popup.js (via
// a <script> tag, driving the "Sync HostOS" / "Sync Now" buttons) — one
// implementation of "scrape, build a payload, POST it to HostOS" regardless
// of what triggered it.
//
// Change detection (what used to be tripWatch.js's local snapshot diffing)
// now happens server-side: this always sends the full current scrape, and
// HostOS compares it against what it already has on file.

const HOSTOS_STORAGE_KEYS = {
    url: "hostosUrl",
    apiKey: "hostosApiKey",
    lastSync: "hostosLastSync",
    inboxThreadState: "hostosInboxThreadState"
};

// Where HostOS lives, unless the operator points this somewhere else.
//
// Pairing used to require typing a URL as well as pasting a key, and a URL
// typed by hand is a URL typed wrong — a trailing slash, a missing scheme, or
// http:// against an https:// deployment all fail as "not connected" with
// nothing saying which part was wrong. Almost everyone is syncing to the
// hosted app, so that is the default and the field is only there for people
// running their own instance or a localhost build.
const HOSTOS_DEFAULT_URL = "https://hostos-ten.vercel.app";

// Re-entrancy guard. performSync/performSyncMessages/performSyncInbox each
// have a 1-minute alarm, but nothing ever bounded how long one run could
// take — performSyncMessages alone walks every eligible reservation
// sequentially (up to dozens, each opening its own background tab with
// real throttled delays), which routinely exceeds 60 seconds. Without this,
// the next alarm fires while the previous run is still mid-flight and
// starts a second, fully independent pass opening its own batch of tabs on
// top of the first — compounding every cycle it stays behind, which is
// exactly the "opening a lot of tabs" pileup. Concurrent calls to the same
// function now just report {ok:true, skipped:true} instead of doing the
// work twice; the next alarm after the first one finishes runs normally.
const RUNNING = new Set();
function withGuard(name, fn) {
    return async function guarded(...args) {
        if (RUNNING.has(name)) {
            return { ok: true, skipped: true, reason: `${name} already running`, at: Date.now() };
        }
        RUNNING.add(name);
        try {
            return await fn(...args);
        } finally {
            RUNNING.delete(name);
        }
    };
}

// Hard circuit breaker on top of the tab-leak fix above (see
// performSyncMessages/performLicenseCheckSync loops and performSyncInbox) —
// belt and suspenders against opening enough background tabs to hang the
// browser, whether from a bug not yet found or a genuinely huge fleet.
// openSyncTab() is the only place any of these loops should create a tab.
const MAX_CONCURRENT_SYNC_TABS = 6;
let openSyncTabCount = 0;

function openSyncTab(url) {
    return new Promise((resolve, reject) => {
        if (openSyncTabCount >= MAX_CONCURRENT_SYNC_TABS) {
            reject(new Error(`Refusing to open another tab — ${openSyncTabCount} sync tabs already open (cap: ${MAX_CONCURRENT_SYNC_TABS}).`));
            return;
        }
        chrome.tabs.create({ url, active: false }, (createdTab) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            openSyncTabCount += 1;
            resolve(createdTab);
        });
    });
}

async function closeSyncTab(tab) {
    if (!tab) return;
    openSyncTabCount = Math.max(0, openSyncTabCount - 1);
    try {
        await chrome.tabs.remove(tab.id);
    } catch (_removeErr) {
        // Tab may already be gone — nothing more to do.
    }
}

function getHostOSConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            [HOSTOS_STORAGE_KEYS.url, HOSTOS_STORAGE_KEYS.apiKey],
            (result) => {
                resolve({
                    // Only the pairing key decides whether we're connected.
                    // The URL falling back to the default means a host who
                    // pastes their key and nothing else is already syncing.
                    url: result[HOSTOS_STORAGE_KEYS.url] || HOSTOS_DEFAULT_URL,
                    apiKey: result[HOSTOS_STORAGE_KEYS.apiKey] || ""
                });
            }
        );
    });
}

function saveHostOSConfig(url, apiKey) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [HOSTOS_STORAGE_KEYS.url]: url, [HOSTOS_STORAGE_KEYS.apiKey]: apiKey },
            resolve
        );
    });
}

function saveLastSyncResult(result) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [HOSTOS_STORAGE_KEYS.lastSync]: result }, resolve);
    });
}

function loadLastSyncResult() {
    return new Promise((resolve) => {
        chrome.storage.local.get([HOSTOS_STORAGE_KEYS.lastSync], (result) => {
            resolve(result[HOSTOS_STORAGE_KEYS.lastSync] || null);
        });
    });
}

function findTuroTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: ["*://turo.com/*", "*://*.turo.com/*"] }, (tabs) => {
            resolve(tabs && tabs.length > 0 ? tabs[0] : null);
        });
    });
}

function scanTuroTab(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "scanTrips" }, (response) => {
            if (chrome.runtime.lastError) {
                resolve(null);
                return;
            }
            resolve(response || null);
        });
    });
}

// Best-guess trips list URL — inferred from the reservation-detail URL
// pattern already used elsewhere in this file (turo.com/us/en/reservation/
// <id>), not confirmed against Turo's live routing. If auto-sync starts
// reporting "No trip cards found" despite a Turo tab being open, this is
// the first thing to check — update it to whatever URL your Trips list
// actually loads at.
const TURO_TRIPS_URL = "https://turo.com/us/en/trips";

function looksLikeTuroTripsUrl(url) {
    return /turo\.com\/[^/]+\/[^/]+\/(trips|bookings)\b/i.test(url || "");
}

function isTabActive(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                resolve(false);
                return;
            }
            resolve(!!tab.active);
        });
    });
}

function waitForTabComplete(tabId, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error("Timed out waiting for tab to load"));
        }, timeoutMs);

        function listener(updatedTabId, changeInfo) {
            if (updatedTabId === tabId && changeInfo.status === "complete") {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Refreshes the Turo tab before scanning it, so a tab that's been sitting
// open for a while actually reflects trips that arrived since it was last
// loaded — but only when it's safe to: a tab the user isn't currently
// looking at. Reloading (or worse, navigating) a tab someone is actively
// using — typing a reply, reading a reservation — would be disruptive and
// could lose unsaved work, so an active/focused tab is left alone for this
// cycle rather than force-refreshed.
async function refreshTuroTabIfSafe(tab) {
    const active = await isTabActive(tab.id);
    if (active) return tab;

    try {
        if (!looksLikeTuroTripsUrl(tab.url)) {
            await new Promise((resolve, reject) => {
                chrome.tabs.update(tab.id, { url: TURO_TRIPS_URL }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve();
                });
            });
        } else {
            await new Promise((resolve, reject) => {
                chrome.tabs.reload(tab.id, {}, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve();
                });
            });
        }
        await waitForTabComplete(tab.id, 15000);
        // Turo's own client-side render finishes a moment after the
        // browser's "complete" event fires.
        await delay(1200);
    } catch (err) {
        console.error("[HostOS] Failed to refresh Turo tab before sync:", err);
    }

    return tab;
}

// Turns one generateCards() entry into a sync payload trip. `isSkipped`
// entries (generated.skipped) have a different, thinner shape than
// checkin/checkout/unmatched entries — no dateStr/fleet/ownTs at the top
// level — see generator.js. Skipped entries matter here specifically
// because a cancellation is a skip entry, and HostOS's server-side diff
// needs to see that transition to ever report "trip was cancelled".
function entryToTripPayload(entry, isSkipped) {
    const parsed = entry.parsed;
    if (!parsed || !parsed.reservation) return null;

    const fleet = isSkipped ? null : (entry.fleet || null);
    const dateLabel = isSkipped ? null : (entry.dateStr || null);
    const ownTs = isSkipped ? null : (entry.ownTs || null);

    return {
        reservation: parsed.reservation,
        action: parsed.action || null,
        skipReason: parsed.skipReason || null,
        guestName: parsed.guest || null,
        plate: parsed.plate || null,
        vehicleMake: (fleet && fleet.make) || parsed.vehicleMake || null,
        vehicleModel: (fleet && fleet.model) || parsed.vehicleModel || null,
        vehicleYear: (fleet && fleet.year != null ? String(fleet.year) : null) || parsed.vehicleYear || null,
        extras: parsed.extras || [],
        dateLabel: dateLabel,
        startTs: parsed.action === "checkin" ? ownTs : null,
        endTs: parsed.action === "checkout" ? ownTs : null,
        // Raw "10:00 AM" reading straight off the card, same string the
        // popup's own cardText already displays correctly. Sent alongside
        // ownTs so HostOS can derive a timestamp server-side if ownTs came
        // back null — see resolvePacificTimestamp on the HostOS side.
        time: isSkipped ? null : (parsed.time || null)
    };
}

// Builds the sync payload by reusing the exact same generateCards() /
// matchFleet() / getAllFleetEntries() pipeline that powers the Operations
// tab — one parsing pipeline, two consumers (render locally, sync to HostOS).
function buildSyncPayload(rawTrips, fleetRoster) {
    const generated = generateCards(rawTrips);

    // A "Priority Turnaround" is one vehicle handing off from one guest to the
    // next. generateCards() pulls BOTH of its entries out of generated.checkins
    // and generated.checkouts so the popup can render a single merged card
    // instead of two — but this payload read only those two (now-thinner)
    // lists, so every paired trip vanished from the sync entirely.
    //
    // On a busy fleet almost every check-in follows a check-out on the same
    // plate, which is why HostOS held 196 checkouts and ZERO check-ins. That in
    // turn left start_ts null on every row, and the license sweep
    // (isLicenseCheckEligible needs action === "checkin" AND a numeric startTs)
    // could never match a single trip. Both halves are sent here, so the two
    // most operationally urgent trips on the board stop being the two HostOS
    // never hears about.
    // The two halves are always different reservations (the pairing requires
    // the check-in to start at or after the check-out ends, which a single
    // reservation can never satisfy against itself). A trip that both ends and
    // begins inside the board window can still surface twice across different
    // pairs, though, so the check-in is emitted first and the check-out second:
    // HostOS's ingest dedupes last-wins, and a check-out card is the more
    // current state of the same reservation.
    const turnarounds = (generated.priorityTurnarounds || []).flatMap((t) => [
        entryToTripPayload(t.checkinEntry, false),
        entryToTripPayload(t.checkoutEntry, false)
    ]);

    const trips = []
        .concat(
            generated.checkins.map((e) => entryToTripPayload(e, false)),
            generated.checkouts.map((e) => entryToTripPayload(e, false)),
            turnarounds,
            generated.unmatched.map((e) => entryToTripPayload(e, false)),
            generated.skipped.map((e) => entryToTripPayload(e, true))
        )
        .filter(Boolean);

    // Two roster sources, merged by plate:
    //
    //  1. getAllFleetEntries() — vehicles entered by hand through the popup.
    //     These carry lockbox codes and parking permits, which exist nowhere on
    //     Turo, and represent a deliberate human decision. They win every field
    //     they actually specify.
    //  2. The Fleet Calendar scrape (performFleetCalendarSync) — the full roster
    //     with plates, which is the only place Turo lists every vehicle.
    //
    // Scraped entries fill in the vehicles nobody has typed in; hand-entered
    // values are never overwritten by a scrape.
    const byPlate = {};

    Object.values(fleetRoster || {}).forEach((v) => {
        if (!v || !v.plate) return;
        byPlate[v.plate] = {
            plate: v.plate,
            year: v.year != null ? String(v.year) : null,
            color: null,
            make: v.make || null,
            model: v.model || null,
            lockbox: null,
            permit: null,
            // Index 0 is today. These are what the earnings estimate is built
            // from — the calendar tracks the booked rate far better than a
            // fresh quote, which reflects today s asking price rather than what
            // was locked in at booking.
            dailyPrices: Array.isArray(v.prices) ? v.prices : null,
            bookedDayFlags: Array.isArray(v.bookedDayFlags) ? v.bookedDayFlags : null,
            calendarScannedAt: v.scannedAt || null
        };
    });

    getAllFleetEntries().forEach((v) => {
        if (!v || !v.plate) return;
        const plate = String(v.plate).trim().toUpperCase();
        const scraped = byPlate[plate] || {};
        byPlate[plate] = {
            plate: plate,
            year: v.year != null ? String(v.year) : (scraped.year || null),
            color: v.color || scraped.color || null,
            make: v.make || scraped.make || null,
            model: v.model || scraped.model || null,
            lockbox: v.lockbox || null,
            permit: v.permit || null
        };
    });

    const fleet = Object.values(byPlate);

    return { trips, fleet };
}

async function postJson(url, apiKey, path, payload) {
    const endpoint = url.replace(/\/+$/, "") + path;
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error((data && data.error) || ("HostOS returned " + res.status));
    }

    return data;
}

async function postSyncPayload(url, apiKey, payload) {
    return postJson(url, apiKey, "/api/turo/sync", payload);
}

// The single sync routine — called by the background alarm every minute,
// and by popup.js's manual buttons. Always resolves (never throws); the
// result is both returned and persisted so any UI can read the latest
// status without having triggered the sync itself.
const performSync = withGuard("performSync", async function performSync() {
    const { url, apiKey } = await getHostOSConfig();

    if (!url || !apiKey) {
        const result = {
            ok: false,
            error: "Not connected. Enter your HostOS URL and pairing key in the Synchronization tab.",
            at: Date.now()
        };
        await saveLastSyncResult(result);
        return result;
    }

    const tab = await findTuroTab();
    if (!tab) {
        const result = { ok: false, error: "No open Turo tab found.", at: Date.now() };
        await saveLastSyncResult(result);
        return result;
    }

    await refreshTuroTabIfSafe(tab);

    const rawTrips = await scanTuroTab(tab.id);
    if (!rawTrips || rawTrips.length === 0) {
        const result = { ok: false, error: "No trip cards found on the Turo tab.", at: Date.now() };
        await saveLastSyncResult(result);
        return result;
    }

    try {
        const payload = buildSyncPayload(rawTrips, await loadFleetRoster());
        const response = await postSyncPayload(url, apiKey, payload);
        const result = {
            ok: true,
            at: Date.now(),
            tripsProcessed: response.tripsProcessed || 0,
            eventsCreated: response.eventsCreated || 0,
            events: Array.isArray(response.events) ? response.events : [],
            // Kept so performSyncMessages() (a separate, less frequent
            // cadence — see background.js) knows which reservations are
            // worth opening without re-scanning the trips list itself.
            trips: payload.trips
        };
        await saveLastSyncResult(result);

        // Raise OS notifications from the events HostOS just recorded. This
        // is why the merged extension does not need Karl scanner polling
        // every tab: the diff already names exactly what changed, so there is
        // nothing to infer from keywords. alerts.js is loaded only in the
        // service worker, so this is a no-op when sync runs from the popup.
        if (typeof alertOnSyncEvents === "function") {
            try {
                await alertOnSyncEvents(result);
            } catch (alertErr) {
                // A failed notification must never fail the sync that earned it.
                console.error("[HostOS] Alerting failed:", alertErr);
            }
        }

        return result;
    } catch (err) {
        const result = { ok: false, error: err.message || "Sync failed.", at: Date.now() };
        await saveLastSyncResult(result);
        return result;
    }
});

// Trips worth opening a message thread for: active now, or starting/ending
// within the next week. Bounds how many background tabs get opened per
// cycle — a fleet with dozens of far-future bookings shouldn't mean
// dozens of tab opens every few minutes for reservations nobody's
// messaging about yet.
const MESSAGE_SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Turo renders every card/date/time in Pacific, regardless of where the
// browser doing the scraping physically sits — confirmed by the extension's
// own sync summary ("Today: 8/9 (PT)") and by pacificDateTimeToTimestamp
// below already producing correct results for the trips-list pipeline. The
// two functions below (roughTimestampFromDateLabel, scheduleToTimestamp)
// used to build a plain `new Date(year, month, day, hour, minute)`, which
// JS interprets in whatever timezone the *computer running this code*
// happens to be set to — correct only by coincidence if that machine is
// also on Pacific time, and silently wrong by exactly the Pacific/local gap
// otherwise (confirmed live: every "today" checkout was off by exactly 1
// hour from Turo's own displayed time). This is the same
// find-the-real-offset-via-Intl technique as pacificDateTimeToTimestamp,
// factored out so both date-only and date+time callers share one correct
// implementation instead of two diverging "close enough" ones.
function pacificZonedTimestamp(year, month, day, hour, minute) {
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute);

    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });

    const formatted = dtf.formatToParts(new Date(guessUtc)).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    const asUtc = Date.UTC(
        parseInt(formatted.year, 10),
        parseInt(formatted.month, 10) - 1,
        parseInt(formatted.day, 10),
        parseInt(formatted.hour, 10),
        parseInt(formatted.minute, 10),
        parseInt(formatted.second, 10)
    );

    const offset = asUtc - guessUtc;
    return guessUtc - offset;
}

// Best-effort date-only fallback for trips whose exact ownTs never resolved
// (the checkout-time scraping gap — see HostOS PROJECT_STATE.md) so they
// aren't silently dropped from message-sync eligibility just because an
// exact clock time never scraped. Anchors to noon Pacific on the given M/D,
// rolling into next year if that date is more than ~9 months in the past (a
// trip synced near a year boundary), since a raw M/D label carries no year.
function roughTimestampFromDateLabel(dateLabel) {
    if (!dateLabel) return null;
    const parts = String(dateLabel).split("/");
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    if (!month || !day) return null;

    const now = Date.now();
    let year = new Date().getFullYear();
    let candidate = pacificZonedTimestamp(year, month, day, 12, 0);
    if (candidate < now - 270 * 24 * 60 * 60 * 1000) {
        year += 1;
        candidate = pacificZonedTimestamp(year, month, day, 12, 0);
    }
    return candidate;
}

function isMessageSyncEligible(trip) {
    if (!trip || !trip.reservation) return false;
    const now = Date.now();
    const start = trip.startTs;
    const end = trip.endTs;
    if (typeof start === "number" && Math.abs(start - now) <= MESSAGE_SYNC_WINDOW_MS) return true;
    if (typeof end === "number" && Math.abs(end - now) <= MESSAGE_SYNC_WINDOW_MS) return true;
    // A trip already under way (an "in progress"/"started" skip entry) has
    // neither timestamp populated — see entryToTripPayload() — but is
    // exactly the case messages matter most for, so it's eligible by
    // default rather than excluded for lack of a timestamp.
    if (!start && !end && trip.skipReason && /^(started|in progress)/i.test(trip.skipReason)) return true;
    if (!start && !end && trip.dateLabel) {
        const rough = roughTimestampFromDateLabel(trip.dateLabel);
        if (rough !== null && Math.abs(rough - now) <= MESSAGE_SYNC_WINDOW_MS) return true;
    }
    return false;
}

const SCHEDULE_MONTH_ABBR = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

// "Wed, Aug 5" -> { month: 8, day: 5 } — the reservation detail page's own
// date format (see scrapeReservationScheduleTimes in content.js), which
// carries no year, same as the trips-list dateLabel.
function parseScheduleDate(dateStr) {
    if (!dateStr) return null;
    const m = dateStr.trim().match(/^[A-Za-z]{3},\s*([A-Za-z]{3})\s+(\d{1,2})$/);
    if (!m) return null;
    const month = SCHEDULE_MONTH_ABBR[m[1]];
    if (!month) return null;
    return { month, day: parseInt(m[2], 10) };
}

// "2:00 PM" -> { hour: 14, minute: 0 } (24-hour). Returns null if unparseable.
function parseScheduleTime(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const isPM = /PM/i.test(m[3]);
    if (hour === 12) hour = 0;
    if (isPM) hour += 12;
    return { hour, minute };
}

// Same "roll into next year if this date is far in the past" logic as
// roughTimestampFromDateLabel above, but with an exact time — this is what
// actually fixes the missing checkout/return time, not just a fallback for
// eligibility. Pacific-corrected via pacificZonedTimestamp, same as every
// other Turo-scraped time in this file — a prior version built a plain
// local Date here and was confirmed live to be off by exactly the gap
// between Pacific and whatever timezone the scraping machine was set to.
function scheduleToTimestamp(dateStr, timeStr) {
    const date = parseScheduleDate(dateStr);
    if (!date) return null;
    const time = parseScheduleTime(timeStr) || { hour: 12, minute: 0 };

    const now = Date.now();
    let year = new Date().getFullYear();
    let candidate = pacificZonedTimestamp(year, date.month, date.day, time.hour, time.minute);
    if (candidate < now - 270 * 24 * 60 * 60 * 1000) {
        year += 1;
        candidate = pacificZonedTimestamp(year, date.month, date.day, time.hour, time.minute);
    }
    return candidate;
}

// Converts scrapeReservationScheduleTimes()'s { pickup, return } (see
// content.js) into the same { startTs, endTs, dateLabel } shape
// entryToTripPayload() sends from the trips-list pipeline, so
// /api/turo/messages can patch trips with whichever side resolved.
function resolveScheduleTimestamps(schedule) {
    const result = { startTs: null, endTs: null };
    if (!schedule) return result;
    if (schedule.pickup) result.startTs = scheduleToTimestamp(schedule.pickup.date, schedule.pickup.time);
    if (schedule.return) result.endTs = scheduleToTimestamp(schedule.return.date, schedule.return.time);
    return result;
}

// Same backgrounded-tab race sendToTab (below) exists to absorb — a
// freshly created `active: false` tab's content script may not have
// registered its listener yet even after waitForTabComplete resolves.
function scanReservationMessages(tabId) {
    return sendToTab(tabId, { action: "scanReservationMessages" });
}

// Opens each eligible reservation's detail page in a background tab, one
// at a time (same throttled, sequential pattern popup.js already uses for
// fetching extras quantities — Turo gets one request at a time, not a
// burst), scrapes its message thread, and posts everything found to
// HostOS in one batch at the end.
const performSyncMessages = withGuard("performSyncMessages", async function performSyncMessages() {
    const { url, apiKey } = await getHostOSConfig();
    if (!url || !apiKey) {
        return { ok: false, error: "Not connected.", at: Date.now() };
    }

    const lastSync = await loadLastSyncResult();
    const trips = (lastSync && Array.isArray(lastSync.trips)) ? lastSync.trips : [];
    const eligible = trips.filter(isMessageSyncEligible);

    if (eligible.length === 0) {
        return { ok: true, at: Date.now(), reservationsScanned: 0, messagesFound: 0 };
    }

    const reservations = [];

    for (let i = 0; i < eligible.length; i++) {
        const trip = eligible[i];
        // `tab` declared outside the try so a failure anywhere after
        // creation (waitForTabComplete timing out is common for a
        // backgrounded tab, especially once several are already open
        // competing for resources) still lets `finally` close it. It used
        // to only close on the success path — every timeout orphaned a
        // tab permanently, and each orphan made the next tab more likely
        // to time out too, a runaway pileup that could hang the browser.
        let tab = null;
        try {
            const detailUrl = "https://turo.com/us/en/reservation/" + encodeURIComponent(trip.reservation);
            tab = await openSyncTab(detailUrl);

            await waitForTabComplete(tab.id, 15000);
            await delay(1200 + Math.floor(Math.random() * 500));

            const scan = await scanReservationMessages(tab.id);
            const hasMessages = !!(scan && Array.isArray(scan.messages) && scan.messages.length > 0);
            const schedule = resolveScheduleTimestamps(scan && scan.schedule);
            const hasSchedule = schedule.startTs !== null || schedule.endTs !== null;

            if (hasMessages || hasSchedule) {
                reservations.push({
                    reservation: trip.reservation,
                    guestName: (scan && scan.guestName) || trip.guestName || null,
                    plate: trip.plate || null,
                    messages: hasMessages ? scan.messages : [],
                    scheduleStartTs: schedule.startTs,
                    scheduleEndTs: schedule.endTs
                });
            }
        } catch (err) {
            console.error("[HostOS] Failed to scan messages for reservation", trip.reservation, err);
        } finally {
            await closeSyncTab(tab);
        }

        await delay(700 + Math.floor(Math.random() * 500));
    }

    if (reservations.length === 0) {
        return { ok: true, at: Date.now(), reservationsScanned: eligible.length, messagesFound: 0 };
    }

    try {
        const response = await postJson(url, apiKey, "/api/turo/messages", { reservations });
        return {
            ok: true,
            at: Date.now(),
            reservationsScanned: eligible.length,
            messagesFound: response.messagesStored || 0
        };
    } catch (err) {
        return { ok: false, error: err.message || "Message sync failed.", at: Date.now() };
    }
});

// ---------------------------------------------------------------------
// License-status check — was a popup-only manual button
// (renderLicenseCheck/fetchLicenseStatusForEntries), which meant it only
// ever ran while a human had the popup open and didn't navigate away
// mid-check; a popup closing (losing focus, Chrome reclaiming it) kills
// whatever JS was running inside it. Moved here so it runs from the
// persistent background service worker on its own alarm instead — same
// throttled one-tab-at-a-time pattern as performSyncMessages(), scraped
// via content.js's existing scanReservationLicenseStatus handler.
// ---------------------------------------------------------------------
const LICENSE_CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

function isLicenseCheckEligible(trip) {
    if (!trip || !trip.reservation || trip.action !== "checkin") return false;
    if (typeof trip.startTs !== "number") return false;
    const msUntilStart = trip.startTs - Date.now();
    return msUntilStart >= 0 && msUntilStart <= LICENSE_CHECK_WINDOW_MS;
}

function scanReservationLicenseStatus(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "scanReservationLicenseStatus" }, (response) => {
            if (chrome.runtime.lastError) {
                resolve(null);
                return;
            }
            resolve(response || null);
        });
    });
}

const performLicenseCheckSync = withGuard("performLicenseCheckSync", async function performLicenseCheckSync() {
    const { url, apiKey } = await getHostOSConfig();
    if (!url || !apiKey) {
        return { ok: false, error: "Not connected.", at: Date.now() };
    }

    const lastSync = await loadLastSyncResult();
    const trips = (lastSync && Array.isArray(lastSync.trips)) ? lastSync.trips : [];
    const eligible = trips.filter(isLicenseCheckEligible);

    if (eligible.length === 0) {
        return { ok: true, at: Date.now(), reservationsScanned: 0, licensesChecked: 0 };
    }

    const licenseStatuses = [];

    for (let i = 0; i < eligible.length; i++) {
        const trip = eligible[i];
        // See performSyncMessages' loop above for why `tab` is declared
        // outside the try and closed in `finally` — a waitForTabComplete
        // timeout used to skip the close entirely and leak the tab.
        let tab = null;
        try {
            const detailUrl = "https://turo.com/us/en/reservation/" + encodeURIComponent(trip.reservation);
            tab = await openSyncTab(detailUrl);

            await waitForTabComplete(tab.id, 15000);
            await delay(1200 + Math.floor(Math.random() * 500));

            const status = await scanReservationLicenseStatus(tab.id);
            if (status && status.found) {
                licenseStatuses.push({
                    reservation: trip.reservation,
                    submitted: status.submitted,
                    statusText: status.statusText || null,
                    // Captured opportunistically — this page is already open for
                    // the licence check, and the host s own deductible is only
                    // available from rendered markup, never from the JSON sweep.
                    hostDamageResponsibility:
                        typeof status.hostDamageResponsibility === "number"
                            ? status.hostDamageResponsibility
                            : null
                });
            }
        } catch (err) {
            console.error("[HostOS] Failed to check license status for reservation", trip.reservation, err);
        } finally {
            // Closes itself the moment its data is captured — never left
            // open, whether the scan found something, failed, or timed out.
            await closeSyncTab(tab);
        }

        await delay(700 + Math.floor(Math.random() * 500));
    }

    if (licenseStatuses.length === 0) {
        return { ok: true, at: Date.now(), reservationsScanned: eligible.length, licensesChecked: 0 };
    }

    try {
        const response = await postJson(url, apiKey, "/api/turo/license-status", { licenseStatuses });
        return {
            ok: true,
            at: Date.now(),
            reservationsScanned: eligible.length,
            licensesChecked: response.updated || 0
        };
    } catch (err) {
        return { ok: false, error: err.message || "License check sync failed.", at: Date.now() };
    }
});

// ---------------------------------------------------------------------
// Fleet roster sync — the whole vehicle list, from Turo's Fleet Calendar.
//
// The `fleet` half of the sync payload came only from getAllFleetEntries(),
// i.e. vehicles typed in by hand through the popup, because fleet.js is
// deliberately empty. On a fleet nobody had hand-entered that meant HostOS
// held 5 vehicles while its own trips referenced 45 distinct plates, and
// everything keyed off the vehicles table — the Fleet page, occupancy,
// "available now" — was working from a 5-car roster.
//
// The calendar is the only Turo surface listing the whole fleet with plates
// attached. Its grid is virtualized (~15 of 40+ rows exist in the DOM at any
// moment), so this scrolls and rescans, merging by plate, rather than trusting
// one pass. See fleetCalendar.js for the DOM reasoning.
// ---------------------------------------------------------------------

const FLEET_CALENDAR_URL = "https://turo.com/us/en/trips/calendar";
const FLEET_ROSTER_KEY = "hostosFleetRoster";
// Ceiling on scroll-and-rescan passes. 12 x ~15 rows covers a fleet several
// times over; the loop normally exits earlier on the no-new-plates check.
const MAX_FLEET_SCROLL_PASSES = 12;

function loadFleetRoster() {
    return new Promise((resolve) => {
        chrome.storage.local.get(FLEET_ROSTER_KEY, (result) => {
            const stored = result && result[FLEET_ROSTER_KEY];
            resolve((stored && stored.vehicles) || {});
        });
    });
}

function saveFleetRoster(vehicles) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [FLEET_ROSTER_KEY]: { vehicles: vehicles, scannedAt: new Date().toISOString() } },
            resolve
        );
    });
}

const performFleetCalendarSync = withGuard("performFleetCalendarSync", async function performFleetCalendarSync() {
    // Merged into whatever previous passes already found, never replaced —
    // a virtualized grid only ever reports the rows currently on screen, and
    // replacing would discard every vehicle not scrolled into view.
    const roster = await loadFleetRoster();
    const before = Object.keys(roster).length;

    let tab = null;
    let passes = 0;
    let lastReason = null;

    try {
        tab = await openSyncTab(FLEET_CALENDAR_URL);
        await waitForTabComplete(tab.id, 20000);
        // The grid renders after the page reports complete; without this the
        // first scan reliably returns grid_not_ready.
        await delay(2500);

        for (passes = 0; passes < MAX_FLEET_SCROLL_PASSES; passes++) {
            const result = await sendToTab(tab.id, { action: "scanFleetCalendar" });

            if (result && result.ok) {
                Object.entries(result.vehicles || {}).forEach(([plate, entry]) => {
                    roster[plate] = entry;
                });
            } else if (result) {
                lastReason = result.reason || null;
                // "not_showing_today" means the host paged the calendar
                // backwards, so every column is misaligned — scrolling won't
                // fix that, and storing those prices would file real money
                // against the wrong days.
                if (result.reason === "not_calendar_page" || result.reason === "not_showing_today") break;
            }

            const scrolled = await sendToTab(tab.id, { action: "scrollFleetCalendar" });
            if (!scrolled || !scrolled.moved) break;
            await delay(900);
        }
    } catch (err) {
        console.error("[HostOS] Fleet calendar sync failed:", err);
        return { ok: false, error: err.message || "Fleet calendar sync failed.", at: Date.now() };
    } finally {
        // Same finally-close discipline as the loops above: a timeout must
        // never leak the tab.
        await closeSyncTab(tab);
    }

    const after = Object.keys(roster).length;
    if (after > 0) await saveFleetRoster(roster);

    return {
        ok: after > 0,
        at: Date.now(),
        vehiclesKnown: after,
        vehiclesAdded: after - before,
        passes: passes,
        reason: after > 0 ? null : lastReason
    };
});

// ---------------------------------------------------------------------
// Enrichment sync — the guest's protection plan and track record.
//
// These are risk signals HostOS has no other source for: a Premier ($0
// out-of-pocket) booking means damage can't be billed to the guest, and a
// first-time or badly-rated guest on one is the case worth acting on before
// pickup. Both come from Turo's JSON APIs — see enrichment.js for why the
// reservation page's own "Damage responsibility" figure is the WRONG number.
//
// Unlike every other loop here this opens no background tab: the lookups are
// same-origin fetches issued from whatever Turo tab is already open, so the
// sweep can cover every known trip rather than only a short window.
// ---------------------------------------------------------------------

const ENRICHMENT_STATE_KEY = "hostosEnrichmentState";
// Protection can change while a booking is still cancellable, so it is
// re-checked; a guest's history barely moves over the life of a trip, so their
// rating is fetched once and left alone.
const ENRICHMENT_RECHECK_MS = 6 * 60 * 60 * 1000;
const ENRICHMENT_PER_CYCLE = 15;

function loadEnrichmentState() {
    return new Promise((resolve) => {
        chrome.storage.local.get(ENRICHMENT_STATE_KEY, (result) => {
            resolve((result && result[ENRICHMENT_STATE_KEY]) || {});
        });
    });
}

function saveEnrichmentState(state) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [ENRICHMENT_STATE_KEY]: state }, resolve);
    });
}

const performEnrichmentSync = withGuard("performEnrichmentSync", async function performEnrichmentSync() {
    const { url, apiKey } = await getHostOSConfig();
    if (!url || !apiKey) {
        return { ok: false, error: "Not connected.", at: Date.now() };
    }

    const tab = await findTuroTab();
    if (!tab) {
        return { ok: false, error: "No open Turo tab found.", at: Date.now() };
    }

    const lastSync = await loadLastSyncResult();
    const trips = (lastSync && Array.isArray(lastSync.trips)) ? lastSync.trips : [];
    if (trips.length === 0) {
        return { ok: true, at: Date.now(), enriched: 0, reason: "no_trips_known" };
    }

    const state = await loadEnrichmentState();
    const now = Date.now();

    // Never checked, or the check has gone stale. Oldest first, so a large
    // backfill works through the fleet evenly instead of re-checking the same
    // handful every cycle.
    const due = trips
        .map((t) => t && t.reservation)
        .filter((id) => id && /^\d+$/.test(String(id)))
        .filter((id) => {
            const seen = state[id];
            return !seen || !seen.at || now - seen.at > ENRICHMENT_RECHECK_MS;
        })
        .sort((a, b) => ((state[a] && state[a].at) || 0) - ((state[b] && state[b].at) || 0))
        .slice(0, ENRICHMENT_PER_CYCLE);

    if (due.length === 0) {
        return { ok: true, at: Date.now(), enriched: 0, reason: "nothing_due" };
    }

    // Only ask for the rating on trips we've never resolved one for.
    const withGuestIds = due.filter((id) => !state[id] || !state[id].guest);

    // The vehicle-pricing endpoint quotes a rate for specific dates, so it
    // needs each trip s own window. The reservation payload carries
    // tripStart/tripEnd but both come back null, so they come from the trips
    // list scan instead.
    const tripWindows = {};
    trips.forEach((t) => {
        if (!t || !t.reservation) return;
        const start = typeof t.startTs === "number" ? new Date(t.startTs).toISOString() : null;
        const end = typeof t.endTs === "number" ? new Date(t.endTs).toISOString() : null;
        if (start || end) tripWindows[String(t.reservation)] = { start: start, end: end };
    });

    const scan = await sendToTab(tab.id, {
        action: "enrichReservations",
        reservationIds: due,
        withGuestIds: withGuestIds,
        tripWindows: tripWindows
    });

    const results = (scan && Array.isArray(scan.results)) ? scan.results : [];
    if (results.length === 0) {
        return {
            ok: false,
            error: "No enrichment data returned.",
            at: Date.now(),
            requested: due.length,
            failures: (scan && scan.failures) || due.length
        };
    }

    try {
        const response = await postJson(url, apiKey, "/api/turo/enrichment", { reservations: results });

        // Stamped only after HostOS has actually accepted the batch, so a
        // failed POST is retried next cycle rather than being marked done.
        results.forEach((entry) => {
            const previous = state[entry.reservation] || {};
            state[entry.reservation] = {
                at: now,
                guest: previous.guest || entry.guestRating !== undefined
            };
        });
        await saveEnrichmentState(state);

        return {
            ok: true,
            at: Date.now(),
            requested: due.length,
            enriched: response.updated || 0,
            failures: (scan && scan.failures) || 0
        };
    } catch (err) {
        return { ok: false, error: err.message || "Enrichment sync failed.", at: Date.now() };
    }
});

// ---------------------------------------------------------------------
// Inbox sync — the real guest/host conversation history, from
// turo.com/us/en/inbox/messages, not the reservation detail page's canned
// trip-instructions panel performSyncMessages() above reads. See
// content.js's scrapeInboxThreadList/scrapeInboxThreadMessages for the
// scraping itself (confirmed against a live screenshot on 2026-08-06).
// ---------------------------------------------------------------------

const INBOX_URL = "https://turo.com/us/en/inbox/messages";
// Safety ceiling on pages walked even if pagination detection misbehaves
// (e.g. keeps reporting "more pages" on a layout this wasn't built from).
const MAX_INBOX_PAGES = 20;
// Bounds how many full conversations get opened — and therefore how many
// background tabs — per sync cycle. Unread threads are prioritized, so a
// large inbox catches up on the messages that matter first and fills in
// the rest gradually over subsequent cycles rather than one very long run.
const MAX_INBOX_THREADS_PER_CYCLE = 20;

function sendToTabOnce(tabId, message) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ error: chrome.runtime.lastError.message });
                return;
            }
            resolve({ response: response || null });
        });
    });
}

// A tab performSyncInbox just created with `active: false` (backgrounded,
// never focused) can still be showing "connecting..." — or its content
// script mid-injection, listener not registered yet — well after
// waitForTabComplete's "complete" event fires, since Chrome throttles
// rendering/timers in tabs that never become active. The first message
// sent right after tab creation would silently come back
// "Could not establish connection: receiving end does not exist" and
// sendToTab used to swallow that as a plain null, indistinguishable from
// "the page really has nothing" — which is exactly what made
// performSyncInbox quietly report zero threads found forever, no error
// anywhere. Retrying absorbs that race without needing to guess a safe
// fixed delay for every machine.
async function sendToTab(tabId, message, attempts = 2) {
    for (let i = 0; i < attempts; i++) {
        const result = await sendToTabOnce(tabId, message);
        if (!result.error) return result.response;
        if (i < attempts - 1) await delay(500);
    }
    return null;
}

// Per-thread { preview, unread } snapshot from the last cycle that actually
// opened it, keyed by threadId — lets performSyncInbox skip re-opening a
// full conversation tab for a thread that's read and hasn't changed since
// last time. Without this, running the inbox scan every 60s would mean
// opening up to MAX_INBOX_THREADS_PER_CYCLE background tabs every single
// minute forever, whether or not anything new arrived.
function loadInboxThreadState() {
    return new Promise((resolve) => {
        chrome.storage.local.get([HOSTOS_STORAGE_KEYS.inboxThreadState], (result) => {
            resolve(result[HOSTOS_STORAGE_KEYS.inboxThreadState] || {});
        });
    });
}

function saveInboxThreadState(state) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [HOSTOS_STORAGE_KEYS.inboxThreadState]: state }, resolve);
    });
}

// Walks every page of the Inbox thread list, clicking "next" between each
// — cheap relative to opening a tab per conversation, since it's the same
// tab being paged through.
async function collectAllInboxThreads(tabId) {
    const all = [];
    const seen = new Set();

    for (let page = 1; page <= MAX_INBOX_PAGES; page++) {
        const result = await sendToTab(tabId, { action: "scanInboxThreadList" });
        if (!result || !Array.isArray(result.threads)) break;

        for (const t of result.threads) {
            if (t.threadId && !seen.has(t.threadId)) {
                seen.add(t.threadId);
                all.push(t);
            }
        }

        const pagination = result.pagination || {};
        if (!pagination.totalPages || pagination.currentPage >= pagination.totalPages) break;

        const nav = await sendToTab(tabId, { action: "clickInboxNextPage" });
        if (!nav || !nav.ok) break;

        await delay(900 + Math.floor(Math.random() * 400));
    }

    return all;
}

// Opens the Inbox in a background tab, collects every conversation in the
// list (all pages), then opens the full thread for a bounded, unread-first
// subset and posts what it finds to HostOS. Content written here lands in
// the same trip_messages table performSyncMessages() writes to — HostOS
// dedupes on (trip_id, body) server-side, so the two sources overlapping
// on a message is harmless.
//
// Assumes an Inbox thread ID doubles as the Turo reservation number (both
// are 8-digit numbers in the same range in every sample seen so far, and
// HostOS keys trip_messages.trip_id on the reservation number specifically
// to join against the trips table for vehicle-name enrichment) — if a
// synced conversation never shows a vehicle name in HostOS despite the
// guest clearly having a real trip, that assumption is the first thing to
// check.
const performSyncInbox = withGuard("performSyncInbox", async function performSyncInbox() {
    const { url, apiKey } = await getHostOSConfig();
    if (!url || !apiKey) {
        return { ok: false, error: "Not connected.", at: Date.now() };
    }

    let tab = null;
    try {
        tab = await openSyncTab(INBOX_URL);

        await waitForTabComplete(tab.id, 15000);
        await delay(1500);

        const allThreads = await collectAllInboxThreads(tab.id);
        const priorState = await loadInboxThreadState();

        // A thread is worth opening a tab for only when something might
        // actually be new: never synced before, currently unread, or its
        // list-view preview text has changed since the last time it was
        // opened (a new message landed). A read, unchanged thread is
        // skipped outright — that's what makes a 60s cycle affordable.
        const changed = allThreads.filter((t) => {
            const prior = priorState[t.threadId];
            if (!prior) return true;
            if (t.unread) return true;
            if ((t.preview || "") !== (prior.preview || "")) return true;
            return false;
        });

        const prioritized = changed
            .slice()
            .sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0));
        const toOpen = prioritized.slice(0, MAX_INBOX_THREADS_PER_CYCLE);

        const reservations = [];
        const strategyCounts = {};
        let firstDebugSample = null;
        const nextState = Object.assign({}, priorState);
        for (const t of toOpen) {
            const clicked = await sendToTab(tab.id, { action: "clickInboxThread", threadId: t.threadId });
            if (!clicked || !clicked.ok) continue;
            await delay(900 + Math.floor(Math.random() * 400));

            const scan = await sendToTab(tab.id, { action: "scanInboxThreadMessages" });
            if (scan && Array.isArray(scan.messages) && scan.messages.length > 0) {
                strategyCounts[scan.strategy || "unknown"] = (strategyCounts[scan.strategy || "unknown"] || 0) + 1;
                reservations.push({
                    reservation: t.threadId,
                    guestName: scan.guestName || t.guestName || null,
                    plate: null,
                    messages: scan.messages
                });
            } else if (scan) {
                // This used to fail completely silently: the old caption-regex
                // scraper matched nothing on the live account, so across 577
                // stored rows not one carried a timestamp and nobody could see
                // why. Record the reason and one sample so a future breakage is
                // visible from the sync result instead of needing a hand repro.
                const reason = scan.reason || "no_messages";
                strategyCounts[reason] = (strategyCounts[reason] || 0) + 1;
                if (!firstDebugSample && scan.debugSample) firstDebugSample = scan.debugSample;
            }

            nextState[t.threadId] = { preview: t.preview || "", unread: !!t.unread, syncedAt: Date.now() };
        }

        await closeSyncTab(tab);
        tab = null;

        await saveInboxThreadState(nextState);

        if (reservations.length === 0) {
            return {
                ok: true,
                at: Date.now(),
                threadsFound: allThreads.length,
                threadsScanned: 0,
                messagesFound: 0,
                // Opening threads and reading nothing out of any of them is a
                // broken scraper, not an empty inbox. Say which step failed and
                // keep one sample of the markup, so this is diagnosable from
                // the sync result rather than only by hand.
                strategies: strategyCounts,
                debugSample: firstDebugSample
            };
        }

        const response = await postJson(url, apiKey, "/api/turo/messages", { reservations });
        return {
            ok: true,
            at: Date.now(),
            threadsFound: allThreads.length,
            threadsScanned: reservations.length,
            messagesFound: response.messagesStored || 0,
            strategies: strategyCounts
        };
    } catch (err) {
        await closeSyncTab(tab);
        return { ok: false, error: err.message || "Inbox sync failed.", at: Date.now() };
    }
});
