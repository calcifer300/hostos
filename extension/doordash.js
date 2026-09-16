// doordash.js
// Content module for the DoorDash Merchant Portal.
//
// Reads two things the portal shows and HostOS cannot otherwise know: which
// store is on screen (the id in the URL) and whether it is currently taking
// orders (the status control the portal renders). Reports both to the
// service worker, which posts them to /api/companion/restaurants/status
// with the pairing key — this script never sees the key.
//
// Everything here is best-effort against DoorDash's markup, which is not a
// contract. When nothing readable is found, nothing is reported; a guess
// about a store's state would be worse than silence.

(function () {
    "use strict";

    if (window.__hostosDoorDashLoaded) return;
    window.__hostosDoorDashLoaded = true;

    const REPORT_EVERY_MS = 60_000;
    const BADGE_ID = "hostos-dd-badge";
    let lastReport = { storeId: null, status: null, at: 0 };

    function storeIdFromUrl() {
        // merchant-portal.doordash.com/merchant/<store-id>/… or ?store_id=…
        const url = new URL(window.location.href);
        const q = url.searchParams.get("store_id") || url.searchParams.get("storeId");
        if (q) return q;
        const m = url.pathname.match(/\/(?:merchant|store|stores)\/(\d{4,})/i) || url.pathname.match(/\/(\d{5,})(?:\/|$)/);
        return m ? m[1] : null;
    }

    // The status control's text, wherever the portal happens to render it.
    function readStatus() {
        const candidates = Array.from(document.querySelectorAll("button, [role='button'], [data-testid*='status'], [class*='StoreStatus'], [class*='store-status'], span, div"))
            .slice(0, 4000)
            .map((n) => (n.textContent || "").trim())
            .filter((t) => t.length > 0 && t.length < 60);

        for (const t of candidates) {
            if (/\b(deactivated|permanently closed)\b/i.test(t)) return { status: "deactivated", detail: t };
            if (/\b(paused|pause orders|temporarily unavailable|not accepting orders)\b/i.test(t)) return { status: "paused", detail: t };
            if (/\b(store is closed|closed now|currently closed)\b/i.test(t)) return { status: "closed", detail: t };
            if (/\b(accepting orders|store is open|open now|currently open)\b/i.test(t)) return { status: "open", detail: t };
        }
        return null;
    }

    function report(force) {
        const storeId = storeIdFromUrl();
        const reading = readStatus();
        if (!storeId || !reading) return;
        const now = Date.now();
        const same = lastReport.storeId === storeId && lastReport.status === reading.status;
        if (same && !force && now - lastReport.at < REPORT_EVERY_MS * 10) return;

        lastReport = { storeId, status: reading.status, at: now };
        chrome.runtime.sendMessage({ type: "hostos:doordash-status", storeId, status: reading.status, detail: reading.detail, storeName: document.title.replace(/\s*[|·-]\s*DoorDash.*$/i, "").trim() }, (res) => {
            if (chrome.runtime.lastError) return;
            renderBadge(res && res.ok ? res : null, storeId);
        });
    }

    function renderBadge(result, storeId) {
        let badge = document.getElementById(BADGE_ID);
        if (!badge) {
            badge = document.createElement("a");
            badge.id = BADGE_ID;
            badge.target = "_blank";
            badge.rel = "noreferrer";
            badge.style.cssText =
                "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#131316;color:#f5f5f7;font:500 12px/1 -apple-system,Segoe UI,Inter,sans-serif;border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 32px -12px rgba(0,0,0,.7);text-decoration:none;transition:transform .2s cubic-bezier(.16,1,.3,1)";
            badge.onmouseenter = () => (badge.style.transform = "translateY(-2px)");
            badge.onmouseleave = () => (badge.style.transform = "");
            const dot = document.createElement("span");
            dot.style.cssText = "width:7px;height:7px;border-radius:999px;background:#30d158";
            const text = document.createElement("span");
            badge.append(dot, text);
            document.body.appendChild(badge);
        }
        const text = badge.lastChild;
        const dot = badge.firstChild;
        if (result && result.known) {
            text.textContent = "HostOS · watching " + result.name;
            dot.style.background = "#30d158";
            badge.href = result.href || "#";
        } else {
            text.textContent = "HostOS · add store " + storeId + " to monitor";
            dot.style.background = "#ff9f0a";
            badge.href = result && result.link ? result.link : "#";
        }
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "hostos:doordash-report") report(true);
    });

    // First read after the SPA settles, then on a timer and on navigation.
    setTimeout(() => report(true), 3000);
    setInterval(() => report(false), REPORT_EVERY_MS);
    let lastHref = location.href;
    new MutationObserver(() => {
        if (location.href !== lastHref) {
            lastHref = location.href;
            setTimeout(() => report(true), 2000);
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
