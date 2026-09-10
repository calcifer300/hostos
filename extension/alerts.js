// alerts.js
// Native OS notifications for things that need a person now.
//
// Merged from Karl's browser-content-scanner. His version polled every open
// tab on a timer, injected a content script into all of them, and matched
// keywords against the rendered text — which works, and costs a scripting
// pass over every tab in the browser every interval.
//
// This keeps his rule model (keyword sets, severity, sound, badge count) and
// drops the polling. The Companion already knows what changed: performSync
// diffs each scrape against HostOS and gets back the events it created. So
// alerts are raised from sync results the extension already has, and the
// keyword scanner is kept only for the case sync cannot see — a Turo tab the
// host is looking at right now, which may show a request minutes before the
// next sync cycle lands.

const ALERT_KEYS = {
  rules: "hostosAlertRules",
  settings: "hostosAlertSettings",
  seen: "hostosAlertSeen",
};

/**
 * Karl's default rules, unchanged in substance.
 *
 * `severity` decides whether a notification makes a sound: a new trip request
 * has a booking window measured in minutes, a status change does not.
 */
const DEFAULT_ALERT_RULES = [
    {
        id: "turo-trip-request",
        name: "New trip request",
        keywords: ["Requested", "Instant Book", "Approval Needed", "Trip request", "Pending approval"],
        severity: "critical",
        sound: true,
        enabled: true,
    },
    {
        id: "turo-messages",
        name: "Guest message",
        keywords: ["New message", "sent a message", "Unread message", "Guest chat"],
        severity: "high",
        sound: true,
        enabled: true,
    },
    {
        id: "turo-status",
        name: "Trip status change",
        keywords: ["Trip Started", "Trip Ended", "Trip Completed", "Cancelled", "Booking modified"],
        severity: "medium",
        sound: false,
        enabled: true,
    },
];

const DEFAULT_ALERT_SETTINGS = {
    enabled: true,
    sound: true,
    // What HostOS's risk engine reports (see alertOnSummary).
    onNewMessage: true,
    onLicenceOverdue: true,
    onPremierBooking: true,
    // Below $0.20 per included mile — the host's own rule, via Karl's build.
    onProfitRisk: true,
};

function loadAlertConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get([ALERT_KEYS.rules, ALERT_KEYS.settings], (result) => {
            resolve({
                rules: result[ALERT_KEYS.rules] || DEFAULT_ALERT_RULES,
                settings: { ...DEFAULT_ALERT_SETTINGS, ...(result[ALERT_KEYS.settings] || {}) },
            });
        });
    });
}

function saveAlertConfig(rules, settings) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [ALERT_KEYS.rules]: rules, [ALERT_KEYS.settings]: settings },
            resolve
        );
    });
}

/**
 * Notifications already shown, so a rule that keeps matching the same page
 * doesn't fire once a minute forever.
 *
 * Kept in session storage rather than local: "already told you about this"
 * should last as long as the browser session and reset with it, because after
 * a restart the host has lost the notification and wants it again.
 */
function loadSeen() {
    return new Promise((resolve) => {
        chrome.storage.session.get([ALERT_KEYS.seen], (result) => {
            resolve(new Set(result[ALERT_KEYS.seen] || []));
        });
    });
}

function saveSeen(seen) {
    return new Promise((resolve) => {
        // Bounded: a long session would otherwise grow this without limit.
        const trimmed = [...seen].slice(-300);
        chrome.storage.session.set({ [ALERT_KEYS.seen]: trimmed }, resolve);
    });
}

/** Raises one OS notification, unless this exact thing was already raised. */
async function raiseAlert({ key, title, body, severity, url }) {
    const { settings } = await loadAlertConfig();
    if (!settings.enabled) return false;

    const seen = await loadSeen();
    if (seen.has(key)) return false;

    seen.add(key);
    await saveSeen(seen);

    const notificationId = `hostos_${key}`.slice(0, 200);

    try {
        chrome.notifications.create(notificationId, {
            type: "basic",
            iconUrl: chrome.runtime.getURL("icon128.png"),
            title,
            message: body,
            // Critical alerts stay on screen until dismissed. A booking request
            // that auto-dismissed after eight seconds while the host was in
            // another room is the whole reason this exists.
            requireInteraction: severity === "critical",
            silent: !(settings.sound && severity !== "medium"),
        });
    } catch (err) {
        console.error("[HostOS] Could not raise notification:", err);
        return false;
    }

    if (url) {
        const { notifTargets = {} } = await chrome.storage.session.get("notifTargets");
        notifTargets[notificationId] = url;
        await chrome.storage.session.set({ notifTargets });
    }

    await bumpBadge();
    return true;
}

/** Unread alert count on the toolbar icon. */
async function bumpBadge() {
    const { alertBadge = 0 } = await chrome.storage.session.get("alertBadge");
    const next = alertBadge + 1;
    await chrome.storage.session.set({ alertBadge: next });

    try {
        chrome.action.setBadgeText({ text: next > 99 ? "99+" : String(next) });
        chrome.action.setBadgeBackgroundColor({ color: "#D70015" });
    } catch {
        // Badge APIs are unavailable in some contexts; not worth failing over.
    }
}

async function clearBadge() {
    await chrome.storage.session.set({ alertBadge: 0 });
    try {
        chrome.action.setBadgeText({ text: "" });
    } catch {
        // As above.
    }
}

/**
 * Turns the events HostOS returned from a sync into notifications.
 *
 * This is the replacement for polling every tab. performSync already posts the
 * scrape and gets back the changes HostOS recorded, so the interesting events
 * are in hand — no second pass over the DOM, and no guessing from keywords
 * what a diff already states exactly.
 */
/**
 * Raises the alerts HostOS says are outstanding.
 *
 * THIS EXISTS BECAUSE alertOnSyncEvents COULD NOT DO IT.
 *
 * That function reads syncResult.events, whose kinds are only created /
 * rescheduled / cancelled / plate_changed. Its tests for "licen" and
 * "premier" therefore matched nothing and those alerts never fired, however
 * the toggles were set; profit risk had no test at all. The three things a
 * host actually wants to be told about were the three that could not happen.
 *
 * The risk engine already knows all of them, so the server decides WHAT is
 * wrong and this decides WHETHER to show it. raiseAlert de-dupes on the key,
 * so an alert that stays outstanding is announced once, not every cycle.
 */
async function alertOnSummary(summary) {
    if (!summary || !Array.isArray(summary.alerts)) return 0;

    const { settings } = await loadAlertConfig();
    if (!settings.enabled) return 0;

    const allowed = {
        licence: settings.onLicenceOverdue !== false,
        premier: settings.onPremierBooking !== false,
        profit: settings.onProfitRisk !== false,
    };

    let raised = 0;
    for (const alert of summary.alerts) {
        if (!alert || !allowed[alert.kind]) continue;

        const raisedOne = await raiseAlert({
            key: alert.key,
            title: alert.title,
            body: alert.body,
            severity: alert.severity,
        });
        if (raisedOne) raised++;
    }

    return raised;
}

async function alertOnSyncEvents(syncResult) {
    if (!syncResult || !syncResult.ok || !Array.isArray(syncResult.events)) return 0;

    const { settings } = await loadAlertConfig();
    if (!settings.enabled) return 0;

    let raised = 0;

    for (const event of syncResult.events) {
        const kind = (event.kind || "").toLowerCase();
        const description = event.description || "Something changed on a trip.";

        let title = null;
        let severity = "medium";

        if (kind.includes("message") && settings.onNewMessage) {
            title = "New guest message";
            severity = "high";
        } else if (kind.includes("licen") && settings.onLicenceOverdue) {
            title = "Licence still unverified";
            severity = "critical";
        } else if ((kind.includes("premier") || kind.includes("protection")) && settings.onPremierBooking) {
            title = "Zero-deductible booking";
            severity = "critical";
        } else if (kind.includes("cancel")) {
            title = "Trip cancelled";
            severity = "high";
        }

        if (!title) continue;

        const raisedOne = await raiseAlert({
            key: `${kind}:${event.tripId || description}`.slice(0, 120),
            title,
            body: description,
            severity,
        });
        if (raisedOne) raised++;
    }

    return raised;
}

/**
 * Karl's keyword scan, kept for the one case sync cannot cover: the Turo tab
 * the host is looking at right now, which can show a request several minutes
 * before the next sync cycle picks it up.
 *
 * Only the ACTIVE tab, and only on turo.com — his version scripted every tab
 * in the browser on a timer.
 */
async function scanActiveTuroTab() {
    const { settings, rules } = await loadAlertConfig();
    if (!settings.enabled) return 0;

    const enabled = rules.filter((r) => r.enabled);
    if (enabled.length === 0) return 0;

    let tabs;
    try {
        tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch {
        return 0;
    }

    const tab = tabs && tabs[0];
    if (!tab || !tab.id || !tab.url || !/^https?:\/\/([a-z0-9-]+\.)?turo\.com\//i.test(tab.url)) {
        return 0;
    }

    let text = "";
    try {
        const [injection] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body ? document.body.innerText.slice(0, 20000) : "",
        });
        text = (injection && injection.result) || "";
    } catch {
        // The tab moved, closed, or is a page we may not script.
        return 0;
    }

    if (!text) return 0;

    const haystack = text.toLowerCase();
    let raised = 0;

    for (const rule of enabled) {
        const hit = (rule.keywords || []).find((k) => haystack.includes(String(k).toLowerCase()));
        if (!hit) continue;

        const raisedOne = await raiseAlert({
            // Keyed on the rule and the tab's URL, so revisiting the same page
            // does not re-fire, but the same rule on a different trip does.
            key: `scan:${rule.id}:${tab.url}`,
            title: rule.name,
            body: `“${hit}” on the Turo page you have open.`,
            severity: rule.severity || "medium",
            url: tab.url,
        });
        if (raisedOne) raised++;
    }

    return raised;
}

// Clicking a notification opens the tab it came from.
//
// Registered in the SERVICE WORKER only. This file is also loaded by the side
// panel so its config helpers are available there, and a listener registered
// from a panel would be a second handler that dies the moment the panel closes
// — handling every click twice while it is open, and clearing the badge from a
// context that no longer exists. Service workers have no global document;
// panels do.
if (
  typeof document === "undefined" &&
  typeof chrome !== "undefined" &&
  chrome.notifications &&
  chrome.notifications.onClicked
) {
    chrome.notifications.onClicked.addListener(async (notificationId) => {
        try {
            const { notifTargets = {} } = await chrome.storage.session.get("notifTargets");
            const url = notifTargets[notificationId];
            if (url) {
                const existing = await chrome.tabs.query({ url });
                if (existing.length > 0) {
                    await chrome.tabs.update(existing[0].id, { active: true });
                    await chrome.windows.update(existing[0].windowId, { focused: true });
                } else {
                    await chrome.tabs.create({ url });
                }
            }
            await chrome.notifications.clear(notificationId);
            await clearBadge();
        } catch (err) {
            console.error("[HostOS] Notification click failed:", err);
        }
    });
}
