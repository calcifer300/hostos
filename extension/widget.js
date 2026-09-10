// widget.js
// The floating HostOS card, in the Turo page.
//
// Ported from the CC build's content/widget.js, which was the one surface of
// that extension the merge had left behind — and the reason its old extension
// was still installed alongside this one.
//
// Two substantive changes from the original:
//
//  1. The numbers come from HostOS, not from the page. CC recomputed its
//     queues in the content script, so the card and the dashboard each had
//     their own idea of how many trips needed attention and drifted apart the
//     moment either one's rules changed. This calls /api/companion/summary,
//     which runs the same risk engine /risk does.
//
//  2. The fleet name is read, not hardcoded. CC had one client's name in the
//     markup ("COLORADO CRUISERS"), which stopped being possible the moment
//     one deployment served many fleets.

(function () {
    "use strict";

    if (window.__hostosWidgetLoaded) return;
    window.__hostosWidgetLoaded = true;

    const WIDGET_ID = "hostos-widget";
    const COLLAPSED_KEY = "hostosWidgetCollapsed";
    const REFRESH_MS = 60_000;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    // ------------------------------------------------------------- markup

    const root = el("div");
    root.id = WIDGET_ID;

    // --- collapsed pill ---------------------------------------------------
    const pill = el("button", "hw-pill");
    pill.type = "button";
    pill.setAttribute("aria-expanded", "false");
    pill.setAttribute("aria-label", "Open HostOS");

    const pillMark = document.createElement("img");
    pillMark.className = "hw-pill-mark";
    pillMark.src = chrome.runtime.getURL("icon48.png");
    pillMark.alt = "";

    const pillText = el("span", "hw-pill-text");
    const pillTitle = el("b", null, "HostOS");
    const pillSummary = el("span", null, "Checking…");
    pillText.append(pillTitle, pillSummary);

    const pillCount = el("span", "hw-pill-count");
    pillCount.hidden = true;

    pill.append(pillMark, pillText, pillCount);

    // --- expanded panel ---------------------------------------------------
    const panel = el("div", "hw-panel");
    panel.hidden = true;

    const header = el("div", "hw-header");
    const brand = el("div", "hw-brand");
    const mark = document.createElement("img");
    mark.className = "hw-mark";
    // An extension file needs an absolute URL inside a page, and must be
    // listed in web_accessible_resources or the page cannot load it at all.
    mark.src = chrome.runtime.getURL("icon48.png");
    mark.alt = "";
    const brandText = el("div");
    const eyebrow = el("p", "hw-eyebrow", "HostOS");
    brandText.append(eyebrow, el("h2", null, "HostOS"));
    brand.append(mark, brandText);

    const status = el("div", "hw-status");
    const statusLabel = el("span", null, "Monitoring");
    status.append(el("i"), statusLabel);

    const collapse = el("button", "hw-collapse", "×");
    collapse.type = "button";
    collapse.setAttribute("aria-label", "Collapse HostOS");

    header.append(brand, status, collapse);

    const hero = el("div", "hw-hero");
    hero.append(el("p", "hw-eyebrow", "Action required"));
    const heroCount = el("strong", null, "—");
    hero.append(heroCount, el("span", null, "items need attention"));

    function summaryCard(path, icon, label, extraClass) {
        const card = el("button", "hw-card" + (extraClass ? " " + extraClass : ""));
        card.type = "button";
        card.dataset.path = path;
        card.append(el("span", "hw-icon", icon));
        const wrap = el("span");
        const value = el("b", null, label);
        const detail = el("small", null, "—");
        wrap.append(value, detail);
        card.appendChild(wrap);
        card.detailEl = detail;
        return card;
    }

    const cards = el("div", "hw-cards");
    const licenseCard = summaryCard("/risk", "!", "Unverified licences", "hw-danger");
    const profitCard = summaryCard("/risk", "$", "Profit risk", "hw-profit");
    const earnCard = summaryCard("/board", "↩", "Returning today", "hw-earn");
    cards.append(licenseCard, profitCard, earnCard);

    const scan = el("button", "hw-scan", "Sync now");
    scan.type = "button";
    const scanStatus = el("p", "hw-scan-status");
    scanStatus.setAttribute("aria-live", "polite");

    const footer = el("p", "hw-footer");
    const dashLink = el("a", null, "Open dashboard");
    dashLink.href = "#";
    footer.append(dashLink);

    panel.append(header, hero, cards, scan, scanStatus, footer);
    root.append(pill, panel);

    // documentElement, not body: Turo re-renders its own body on navigation,
    // and a node parented there gets swept away with it.
    document.documentElement.appendChild(root);

    // ------------------------------------------------------------ open/shut

    function setOpen(open) {
        panel.hidden = !open;
        pill.setAttribute("aria-expanded", String(open));
        root.classList.toggle("hw-open", open);
        try {
            chrome.storage.local.set({ [COLLAPSED_KEY]: !open });
        } catch {
            // Storage unavailable — the widget still works, it just won't
            // remember this between page loads.
        }
        if (open) refresh();
    }

    pill.addEventListener("click", () => setOpen(true));
    collapse.addEventListener("click", () => setOpen(false));

    // Escape closes it, like any other overlay on someone else's page.
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });

    // ---------------------------------------------------------------- data

    function setStatus(text, kind) {
        scanStatus.textContent = text || "";
        scanStatus.className = "hw-scan-status" + (kind ? " hw-" + kind : "");
    }

    function setOffline(offline, label) {
        status.classList.toggle("hw-offline", offline);
        statusLabel.textContent = label;
    }

    /**
     * Everything needing the pairing key or a cross-origin fetch goes through
     * the service worker.
     *
     * This code runs inside Turo's page. It has no business holding the
     * pairing key, and its fetches answer to the page's CORS rules rather than
     * the extension's host permissions. sync.js is unavailable here for the
     * same reason — it drives chrome.tabs and chrome.alarms, which a content
     * script cannot touch.
     */
    function ask(type, extra) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(Object.assign({ type }, extra || {}), (response) => {
                    // A sleeping worker, or an extension reloaded since this
                    // page loaded, resolves undefined and sets lastError.
                    // Reading it is also what stops Chrome logging it as an
                    // unchecked error.
                    if (chrome.runtime.lastError || !response) {
                        resolve({ ok: false, error: "HostOS Companion isn't responding — reload the page." });
                        return;
                    }
                    resolve(response);
                });
            } catch {
                resolve({ ok: false, error: "HostOS Companion isn't available on this page." });
            }
        });
    }

    async function fetchSummary() {
        const res = await ask("hostos:summary");
        if (!res.ok) throw new Error(res.error || "Couldn't load the summary.");
        return res;
    }

    let refreshing = false;

    async function refresh() {
        if (refreshing) return;
        refreshing = true;

        try {
            const data = await fetchSummary();

            if (data.notPaired) {
                setOffline(true, "Not paired");
                eyebrow.textContent = "HostOS";
                heroCount.textContent = "—";
                pillSummary.textContent = "Not paired";
                pillCount.hidden = true;
                setStatus("Open the side panel’s Sync tab to pair.", "err");
                return;
            }

            setOffline(false, "Monitoring");

            // Clear a stale ERROR, but never a message an action just wrote.
            // A refresh follows every successful sync, and clearing
            // unconditionally wiped "Synced 9 trip(s)" the instant it
            // appeared — the confirmation existed for about 40ms.
            if (scanStatus.classList.contains("hw-err")) setStatus("");

            eyebrow.textContent = data.fleetName || "HostOS";

            const total = Number(data.actionRequired) || 0;
            heroCount.textContent = String(total);
            hero.classList.toggle("hw-clear", total === 0);

            pillTitle.textContent = data.fleetName || "HostOS";
            pillSummary.textContent = total === 0 ? "All clear" : "needs attention";
            pillCount.textContent = total > 99 ? "99+" : String(total);
            pillCount.hidden = total === 0;

            const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
            licenseCard.detailEl.textContent = plural(data.licenses ?? 0, "trip", "trips");
            profitCard.detailEl.textContent = plural(data.profitRisk ?? 0, "trip", "trips");

            // A confident $0 is worse than saying the prices aren't in yet.
            earnCard.detailEl.textContent = data.pricingUnavailable
                ? plural(data.returningToday ?? 0, "trip", "trips") + " · not priced"
                : plural(data.returningToday ?? 0, "trip", "trips") +
                  ` · ≈$${(data.estimatedToday ?? 0).toLocaleString()}`;
        } catch (err) {
            setOffline(true, "Offline");
            pillSummary.textContent = "Can’t reach HostOS";
            pillCount.hidden = true;
            setStatus(err && err.message ? err.message : "Couldn’t reach HostOS.", "err");
        } finally {
            refreshing = false;
        }
    }

    // -------------------------------------------------------------- actions

    scan.addEventListener("click", async () => {
        scan.disabled = true;
        setStatus("Syncing trips…");

        try {
            const result = await ask("hostos:sync");
            if (result && result.ok) {
                setStatus(`Synced ${result.tripsProcessed ?? 0} trip(s).`, "ok");
                await refresh();
            } else {
                setStatus((result && result.error) || "Sync failed.", "err");
            }
        } catch (err) {
            setStatus(err && err.message ? err.message : "Sync failed.", "err");
        } finally {
            scan.disabled = false;
        }
    });

    function openDashboard(path) {
        // Opened by the worker, which already knows the configured URL — this
        // page never learns it.
        return ask("hostos:open", { path: path || "" });
    }

    [licenseCard, profitCard, earnCard].forEach((card) => {
        card.addEventListener("click", () => openDashboard(card.dataset.path));
    });
    dashLink.addEventListener("click", (e) => {
        e.preventDefault();
        openDashboard("/");
    });

    // ---------------------------------------------------------------- start

    try {
        chrome.storage.local.get([COLLAPSED_KEY], (stored) => {
            // Collapsed by default: this draws on top of Turo's own page, and
            // an overlay nobody asked for should start out of the way.
            setOpen(stored && stored[COLLAPSED_KEY] === false);
        });
    } catch {
        setOpen(false);
    }

    // Keep the pill's count current even while collapsed — it is the only
    // thing on screen when the panel is shut, so a stale number there is the
    // one number most likely to be believed.
    refresh();
    setInterval(() => {
        if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
})();
