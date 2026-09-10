// background.js
// Makes clicking the toolbar icon open the side panel (which stays open
// across tab switches and outside clicks) instead of a transient popup.
// Also runs three Companion sync loops. See sync.js for the shared
// implementation also used by popup.js's manual buttons — one set of
// routines, multiple triggers.
//
//  - hostosSync (every 1 min): scrape the open Turo tab's trips list,
//    push to HostOS. Refreshes the tab first if it's safe to (see
//    refreshTuroTabIfSafe in sync.js).
//  - hostosMessageSync (every 1 min): open each near-term reservation's
//    detail page in the background and pull its guest message thread.
//    Matches the trip sync's cadence so a new guest message shows up in
//    HostOS within about a minute rather than up to five.
//  - hostosInboxSync (every 1 min, plus once ~20s after every browser
//    startup/extension reload): walks turo.com/us/en/inbox/messages — the
//    real guest/host conversation history, distinct from the reservation
//    page's canned instructions panel above. Matches the other loops' 60s
//    cadence now that performSyncInbox() only opens a tab for a thread
//    that's unread, new, or changed since last cycle (see
//    loadInboxThreadState in sync.js) — a steady-state minute with nothing
//    new opens zero tabs instead of up to 20.
//  - hostosFleetCalendar (every 6 h, plus once a minute after startup):
//    opens turo.com/us/en/trips/calendar in a background tab and scrolls
//    through its virtualized grid to recover the full vehicle roster with
//    plates. The `fleet` payload previously came only from hand-entered
//    vehicles, so a fleet nobody had typed in synced 5 vehicles while its own
//    trips referenced 45 plates. Slow cadence because a roster changes when a
//    car is bought or retired, not hourly.
//  - hostosEnrichment (every 10 min): the guest's protection plan and track
//    record, from Turo's JSON APIs (see enrichment.js). A Premier booking has
//    a $0 out-of-pocket cap, so damage can't be billed to the guest — the one
//    thing worth knowing before a trip starts. Opens NO background tab: these
//    are same-origin fetches issued from whatever Turo tab is already open,
//    which is why it can cover every trip rather than a short window.
//  - hostosLicenseCheck (every 15 min): for check-ins starting within the
//    next 24h, opens each reservation's detail page and reads whether the
//    guest has confirmed their driver's license yet. Used to be a
//    popup-only manual button — moved here because a popup closing (losing
//    focus, Chrome reclaiming it) kills any JS running inside it, which is
//    almost certainly why it "didn't work" reliably. 15 minutes rather
//    than matching the 1-minute loops since license status doesn't change
//    that often and this bounds how many background tabs open per hour.

importScripts("fleet.js", "fleetStore.js", "matcher.js", "parser.js", "formatter.js", "availability.js", "generator.js", "sync.js", "replyMatcher.js", "alerts.js");

function ensureAlarms() {
    chrome.alarms.create("hostosSync", { periodInMinutes: 1 });
    chrome.alarms.create("hostosMessageSync", { periodInMinutes: 1 });
    chrome.alarms.create("hostosInboxSync", { periodInMinutes: 1 });
    chrome.alarms.create("hostosInboxSyncKickoff", { delayInMinutes: 0.33 });
    chrome.alarms.create("hostosLicenseCheck", { periodInMinutes: 15 });
    chrome.alarms.create("hostosLicenseCheckKickoff", { delayInMinutes: 0.5 });
    chrome.alarms.create("hostosFleetCalendar", { periodInMinutes: 360 });
    chrome.alarms.create("hostosFleetCalendarKickoff", { delayInMinutes: 1 });
    chrome.alarms.create("hostosEnrichment", { periodInMinutes: 10 });
    chrome.alarms.create("hostosAlertPoll", { periodInMinutes: 5 });
    chrome.alarms.create("hostosAlertPollKickoff", { delayInMinutes: 0.75 });
    // Keyword scan of the Turo tab the host is looking at RIGHT NOW. Sync
    // covers everything else and covers it better, but a booking request can
    // appear on screen minutes before the next cycle picks it up. See
    // alerts.js for why this is the active tab only.
    chrome.alarms.create("hostosAlertScan", { periodInMinutes: 2 });
    chrome.alarms.create("hostosEnrichmentKickoff", { delayInMinutes: 1.5 });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((err) => console.error("Failed to set side panel behavior:", err));

    ensureAlarms();
});

// Alarms persist across browser restarts, but re-creating on startup is
// idempotent (same name replaces the existing schedule) and cheap
// insurance against ever losing any loop silently.
chrome.runtime.onStartup.addListener(ensureAlarms);

// Belt and suspenders: onInstalled doesn't reliably fire for every manual
// "reload" of an unpacked extension (behavior has varied across Chrome
// versions/build channels depending on whether anything in the manifest
// changed) — if it doesn't fire, ensureAlarms() above never runs and every
// sync loop silently stops existing, with no error anywhere to point at.
// Calling it unconditionally here means every service-worker activation
// (reload, browser restart, or Chrome waking the worker back up after it
// was suspended for being idle — MV3 workers re-run this top-level code
// each time) re-asserts all three alarms. chrome.alarms.create() is
// idempotent per name, so this is cheap and safe to call repeatedly.
ensureAlarms();

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "hostosSync") {
        performSync().catch((err) => console.error("[HostOS] Background sync failed:", err));
        return;
    }
    if (alarm.name === "hostosMessageSync") {
        performSyncMessages().catch((err) => console.error("[HostOS] Background message sync failed:", err));
        return;
    }
    if (alarm.name === "hostosInboxSync" || alarm.name === "hostosInboxSyncKickoff") {
        performSyncInbox().catch((err) => console.error("[HostOS] Background inbox sync failed:", err));
        return;
    }
    if (alarm.name === "hostosLicenseCheck" || alarm.name === "hostosLicenseCheckKickoff") {
        performLicenseCheckSync().catch((err) => console.error("[HostOS] Background license check failed:", err));
        return;
    }
    if (alarm.name === "hostosFleetCalendar" || alarm.name === "hostosFleetCalendarKickoff") {
        performFleetCalendarSync().catch((err) => console.error("[HostOS] Background fleet calendar sync failed:", err));
        return;
    }
    if (alarm.name === "hostosAlertPoll" || alarm.name === "hostosAlertPollKickoff") {
        // Licences, zero-deductible bookings and thin margins, as the risk
        // engine sees them. raiseAlert de-dupes per trip and kind, so a
        // problem that stays outstanding is announced once, not every cycle.
        fetchWidgetSummary()
            .then((summary) => (summary && summary.ok ? alertOnSummary(summary) : 0))
            .catch((err) => console.error("[HostOS] Alert poll failed:", err));
        // Independent of the desktop notification above — see the note there.
        notifyAlertsByEmail();
        return;
    }
    if (alarm.name === "hostosEnrichment" || alarm.name === "hostosEnrichmentKickoff") {
        performEnrichmentSync().catch((err) => console.error("[HostOS] Background enrichment sync failed:", err));
        return;
    }
    if (alarm.name === "hostosAlertScan") {
        scanActiveTuroTab().catch((err) => console.error("[HostOS] Alert scan failed:", err));
    }
});

// ---------------------------------------------------------------- drafting
//
// The bridge between assist.js (running on a Turo/mail/chat page) and HostOS.
// The content script never sees the pairing key — it posts a message here,
// this reads the key from extension storage and makes the call. A key exposed
// to a content script is a key exposed to every script on that page.

async function draftReplyViaHostOS(message) {
    const { url, apiKey } = await getHostOSConfig();

    if (!apiKey) {
        return {
            ok: false,
            error: "Not paired with HostOS yet. Open the side panel's Sync tab and paste your pairing key.",
        };
    }

    let response;
    try {
        response = await fetch(url.replace(/\/+$/, "") + "/api/companion/draft", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + apiKey,
            },
            body: JSON.stringify({ message }),
        });
    } catch (err) {
        return { ok: false, error: "Couldn't reach HostOS. Check your connection and try again." };
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        return {
            ok: false,
            // The route's own message is written for a person to read, so it
            // is passed through rather than replaced with a status code.
            error: (payload && payload.error) || `HostOS returned ${response.status}.`,
        };
    }

    return { ok: true, ...payload };
}

/**
 * The in-page widget's counts.
 *
 * Fetched HERE rather than in the content script for two reasons: the pairing
 * key never has to enter a page the extension does not control, and the worker
 * already holds the host permission for the HostOS origin — a content script
 * reaching a different origin is a CORS problem waiting to happen.
 */
/**
 * Asks HostOS to email this fleet's outstanding alerts.
 *
 * Fire-and-forget alongside the desktop notification: the two are independent
 * on purpose, so someone can want a ping on their own machine and email going
 * to a co-host, or either without the other. HostOS decides whether email is
 * on for this fleet, who it goes to, and — via alert_deliveries — whether each
 * alert has already been sent.
 */
async function notifyAlertsByEmail() {
    const { url, apiKey } = await getHostOSConfig();
    if (!apiKey) return;

    try {
        const res = await fetch(url.replace(/\/+$/, "") + "/api/companion/alerts/notify", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey }
        });
        if (!res.ok) {
            console.warn("[HostOS] Alert email dispatch responded", res.status);
            return;
        }
        const data = await res.json();
        if (data && data.sent > 0) {
            console.log("[HostOS] Emailed " + data.sent + " alert(s).");
        }
    } catch (err) {
        // A failed dispatch is retried on the next poll; nothing is lost,
        // because alert_deliveries only records what actually sent.
        console.warn("[HostOS] Couldn't dispatch alert email:", err);
    }
}

async function fetchWidgetSummary() {
    const { url, apiKey } = await getHostOSConfig();
    if (!apiKey) return { ok: true, notPaired: true };

    const res = await fetch(url.replace(/\/+$/, "") + "/api/companion/summary", {
        headers: { Authorization: "Bearer " + apiKey },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `HostOS responded ${res.status}` };
    }

    return { ok: true, ...(await res.json()) };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return false;

    // Every branch returns true to keep the message channel open for the
    // async reply — returning false here closes it and the caller sees
    // undefined, which is the classic silent-failure in MV3 messaging.
    const reply = (promise) => {
        promise
            .then(sendResponse)
            .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
        return true;
    };

    switch (msg.type) {
        case "hostos:draft":
            return reply(draftReplyViaHostOS(msg.message));

        case "hostos:summary":
            return reply(fetchWidgetSummary());

        // The widget's own "Sync now". Runs in the worker so it survives the
        // page navigating away mid-sync, which a content script would not.
        case "hostos:sync":
            return reply(performSync().then((r) => ({ ok: true, ...r })));

        case "hostos:open":
            return reply(
                getHostOSConfig().then(({ url }) => {
                    chrome.tabs.create({ url: url.replace(/\/+$/, "") + (msg.path || "") });
                    return { ok: true };
                })
            );

        default:
            return false;
    }
});

// Alt+R from the manifest. The content script registers the same shortcut for
// iframes, which chrome.commands does not reach into.
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "generate_reply") return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "hostos:draft-here" });
    } catch (err) {
        console.error("[HostOS] Could not trigger draft:", err);
    }
});
