console.log("✅ Turo VA Ops Tool loaded.");

// Recognizes Turo's date section headers: "Today", "Yesterday", "Tomorrow",
// or a full date like "Thursday, July 2, 2026".
function isDateHeaderText(text) {
    if (!text) return false;
    const t = text.trim();
    if (/^Today$/i.test(t)) return true;
    if (/^Yesterday$/i.test(t)) return true;
    if (/^Tomorrow$/i.test(t)) return true;
    if (/^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(t)) return true;
    return false;
}

function scrapeTrips() {
    // The trip list container. Falls back to document.body if Turo changes
    // this class name, so scraping doesn't silently break.
    const container =
        document.querySelector(".tripsList.tripsList--trips") || document.body;

    // Date header elements (e.g. "Today", "Thursday, July 2, 2026").
    const headerEls = Array.from(container.querySelectorAll('[class*="boxStyles"]'))
        .filter(el => isDateHeaderText(el.innerText));

    // Trip card elements.
    const cardEls = Array.from(container.querySelectorAll('[data-testid="baseTripCard"]'));

    // Merge headers + cards and sort into actual page order, so we can walk
    // through them and know which date section each card belongs to.
    const items = [
        ...headerEls.map(el => ({ type: "header", el })),
        ...cardEls.map(el => ({ type: "card", el }))
    ].sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
    });

    let currentDateLabel = null;
    const trips = [];
    let index = 0;

    items.forEach(item => {
        if (item.type === "header") {
            currentDateLabel = item.el.innerText.trim();
            return;
        }

        index += 1;

        const lines = item.el.innerText
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);

        trips.push({
            id: index,
            dateLabel: currentDateLabel, // e.g. "Today" or "Thursday, July 2, 2026"
            lines: lines
        });
    });

    return trips;
}

// Known Turo extras as they render on an individual reservation detail page
// (turo.com/us/en/reservation/<id>), under the "EXTRAS" heading, e.g.:
//   EXTRAS
//   Child safety seat
//   $3/day   Quantity: 1
//
// NOTE: keep this list in sync with KNOWN_EXTRAS in parser.js — they
// describe the same set of Turo add-ons, just scraped from two different
// page layouts (trips list chip vs. reservation detail page).
const DETAIL_KNOWN_EXTRAS = [
    "Child safety seat",
    "Pet fee",
    "Pet",
    "Additional driver",
    "Unlimited mileage",
    "Unlimited miles",
    "Prepaid refueling",
    "Prepaid refuel",
    "Delivery",
    "Ski rack",
    "Bike rack",
    "Roadside assistance",
    "GPS"
];

// Scrapes the "Quantity: N" for each known extra visible on a reservation
// detail page. Searches for each label's nearest "Quantity:" number that
// follows it in the page's text, rather than assuming exact DOM structure
// (which is more fragile against Turo's own markup changes).
function scrapeReservationExtras() {
    const text = document.body.innerText || "";
    const lowerText = text.toLowerCase();
    const found = [];

    DETAIL_KNOWN_EXTRAS.forEach(label => {
        const idx = lowerText.indexOf(label.toLowerCase());
        if (idx === -1) return;

        // Look within a short window after the label for its quantity —
        // avoids picking up an unrelated "Quantity:" further down the page.
        const windowText = text.slice(idx, idx + 200);
        const qMatch = windowText.match(/Quantity:\s*(\d+)/i);

        found.push({
            label: label,
            quantity: qMatch ? parseInt(qMatch[1], 10) : 1
        });
    });

    return found;
}

// Scrapes the driver's-license confirmation status from a reservation
// detail page, under the "CONFIRM DRIVER'S LICENSE" heading, e.g.:
//   CONFIRM DRIVER'S LICENSE
//   Awaiting license   View        <- not submitted yet
// or:
//   CONFIRM DRIVER'S LICENSE
//   ✓ License confirmed   View     <- guest has submitted it
// Turo has also been seen phrasing the confirmed state as "License ready",
// so both are treated as submitted. Anything else is reported as unknown
// rather than guessed, so the popup can flag it for a manual look instead
// of silently mis-messaging someone.

// The HOST's own per-trip deductible, from the reservation page's "Earnings
// plan" section. Ported from the CC build's scanner.js:230.
//
// This is emphatically NOT the guest's protection plan — reservation 57760996
// shows $2,750 here while the guest held a $0 Premier plan, and an earlier
// build that read this as the guest's deductible could never fire its
// zero-deductible check for any trip. Kept under an honest name because the
// host's own exposure IS useful: the Premier workflow is to swap this plan to a
// lower tier and have the guest rebook, and seeing both figures side by side is
// what makes the mismatch concrete.
//
// Only available from the rendered detail page, unlike protectionLevel and the
// guest rating which come from JSON for every trip. So it is captured
// opportunistically, whenever a detail page is already open for another reason.
function scrapeHostDamageResponsibility() {
    const labels = [...document.querySelectorAll(".detailsSection-label")];
    const label = labels.find((el) => (el.textContent || "").trim().toLowerCase() === "earnings plan");
    const section = label && label.closest(".detailsSection");
    const description = section && section.querySelector(".detailsSection-description");
    const text = description ? (description.textContent || "").replace(/\s+/g, " ").trim() : "";

    const match = text.match(/Damage responsibility:\s*\$([\d,.]+)/i);
    if (!match) return null;

    const amount = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(amount) ? amount : null;
}

function scrapeReservationLicenseStatus() {
    const rawText = document.body.innerText || "";

    // Normalize curly/smart apostrophes (’ U+2019, ‘ U+2018, ʼ U+02BC) and
    // non-breaking spaces to their plain-ASCII equivalents before matching.
    // Turo's rendered text uses a curly apostrophe in "DRIVER'S LICENSE",
    // not the straight one — the old regex only matched the straight
    // apostrophe, so idx was always -1 and every card came back as
    // "couldn't find license section," regardless of the real status.
    const text = rawText
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/\u00A0/g, " ");

    // ".?" (instead of "'") tolerates zero or one arbitrary character
    // between DRIVER and S, so this also survives a missing apostrophe
    // entirely or an em/en-dash-style variant, not just curly vs straight.
    const idx = text.search(/CONFIRM\s+DRIVER.?S\s+LICENSE/i);

    if (idx === -1) {
        // Still nothing — include a text sample so a future mismatch (e.g.
        // Turo renaming the heading) can be diagnosed from the popup's
        // console instead of guessing blind again.
        return {
            found: false,
            submitted: null,
            statusText: null,
            debugSample: text.slice(0, 500)
        };
    }

    // Short window right after the heading — enough to catch the status
    // line without risking a match further down the page.
    const windowText = text.slice(idx, idx + 250);

    const hostDamageResponsibility = scrapeHostDamageResponsibility();

    if (/Awaiting license/i.test(windowText)) {
        return { found: true, submitted: false, statusText: "Awaiting license", hostDamageResponsibility };
    }

    const confirmedMatch = windowText.match(/License (confirmed|ready)/i);
    if (confirmedMatch) {
        return { found: true, submitted: true, statusText: confirmedMatch[0], hostDamageResponsibility };
    }

    // Unrecognized phrasing — don't guess either way.
    const firstLines = windowText.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 3).join(" ");
    return { found: true, submitted: null, statusText: firstLines || null };
}

// Types a message into the reservation detail page's message box and
// clicks Send. Same philosophy as scrapeTrelloBoard() in trello.js: Turo
// doesn't publish a DOM contract, so every selector has a fallback, and a
// debug sample always comes back so a failure can be diagnosed without
// opening devtools on a live tab mid-batch.
//
// From the reservation page layout: the compose box is a plain
// <textarea> near the bottom of the page (placeholder like "Write a
// message..."), with a send button (paper-plane icon) immediately to its
// right, usually inside the same form/container.
function queryComposeBox() {
    // Prefer an explicit placeholder match first.
    let el = document.querySelector('textarea[placeholder*="message" i]');
    if (el) return el;

    // Fallback: a contenteditable message box, if Turo ever swaps away
    // from a plain textarea.
    el = document.querySelector('div[contenteditable="true"][role="textbox"]');
    if (el) return el;

    // Last resort: the last textarea on the page — the compose box is
    // typically the only (or last) one on a reservation detail page.
    const textareas = Array.from(document.querySelectorAll("textarea"));
    return textareas.length ? textareas[textareas.length - 1] : null;
}

function querySendButton(composeEl) {
    if (!composeEl) return null;

    const container =
        composeEl.closest("form") ||
        (composeEl.parentElement && composeEl.parentElement.parentElement) ||
        document.body;

    let btn = container.querySelector('button[aria-label*="send" i], button[type="submit"]');
    if (btn) return btn;

    // Fallback: last <button> inside the same container as the compose box
    // — on the reservation page this is the send arrow immediately beside it.
    const buttons = Array.from(container.querySelectorAll("button"));
    return buttons.length ? buttons[buttons.length - 1] : null;
}

// React (and similar frameworks) track <textarea>/<input> value via an
// internal property setter, so setting .value directly doesn't trigger
// their change detection — this goes through the native setter instead,
// then fires input/change events so the framework picks it up.
function setNativeTextValue(el, value) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
        el.focus();
        document.execCommand("insertText", false, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

// Scrapes the guest/host message thread on a reservation detail page
// (turo.com/.../reservation/<id>) — the "Messages" panel visible on that
// page. Turo doesn't publish a DOM contract for this any more than it does
// for the rest of the site, so this is a best-effort, structure-agnostic
// scrape rather than a fixed set of class-name selectors: it looks for
// small avatar images (the message-bubble marker on this page) and reads
// the text/timestamp sitting next to each one, the same "search for the
// pattern, not a class name" philosophy as scrapeReservationExtras() and
// scrapeReservationLicenseStatus() above.
//
// UNVERIFIED against Turo's live markup — this was written from a
// screenshot, not a DOM inspection. If `messages` comes back empty on a
// reservation that visibly has messages, open DevTools on that page,
// right-click one message bubble → Inspect, and send the resulting HTML
// back so the selectors here can be corrected precisely instead of
// guessed again.
// Reads the reservation detail page's own structured pickup/return
// schedule — [data-testid="schedule-date"] / [data-testid="schedule-time"],
// e.g. "Wed, Aug 5" / "2:00 PM" — confirmed against a live DevTools
// inspection on 2026-08-06. This is far more reliable than the trips-list
// card text parser.js depends on, which only captures a time for cards
// Turo renders with an "Ending at .../Starting at ..." countdown line —
// something it apparently doesn't do for every checkout. The detail page
// always shows the full date range with exact times, in DOM order:
// pickup pair first, return pair second. Runs for free on every reservation
// page performSyncMessages() already opens for message scraping — no extra
// tab, no extra page load.
function scrapeReservationScheduleTimes() {
    const dateEls = Array.from(document.querySelectorAll('[data-testid="schedule-date"]'));
    const timeEls = Array.from(document.querySelectorAll('[data-testid="schedule-time"]'));

    const pairs = dateEls.map((el, i) => ({
        date: (el.innerText || "").trim() || null,
        time: timeEls[i] ? (timeEls[i].innerText || "").trim() || null : null
    }));

    return {
        pickup: pairs[0] || null,
        return: pairs[1] || null
    };
}

function scrapeReservationMessages() {
    // The compose box's placeholder names the guest ("Write your message
    // to Theresa") — the most reliable guest-name signal on this page,
    // and it comes for free from the same element sendReservationMessage()
    // already targets.
    const composeEl = queryComposeBox();
    let guestName = null;
    if (composeEl && composeEl.placeholder) {
        const m = composeEl.placeholder.match(/to\s+(.+?)\s*$/i);
        if (m) guestName = m[1].trim();
    }

    const TIME_RE = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
    const DATE_HEADER_RE = /^[A-Z]{3},\s+[A-Z]{3}\s+\d{1,2},\s+\d{4}$/i;

    // Small avatar images are the one visual constant across both guest
    // and host bubbles in the screenshot this was built from.
    const avatars = Array.from(document.querySelectorAll("img")).filter((img) => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        return w > 0 && w <= 64 && h > 0 && h <= 64;
    });

    const messages = [];
    const seenContainers = new Set();
    let currentDateHeader = null;

    // Asked ONCE for the whole thread, not per bubble. If Turo marks the
    // host's own messages anywhere here, then a bubble without the marker is
    // genuinely the guest's. If the marker appears nowhere, the page is not
    // telling us who wrote anything and no per-message check can change that.
    const threadHasSentMarkers = Boolean(document.querySelector("[data-testid='message-is-sent']"));

    // Messages the page gave no author for. Reported rather than guessed.
    let unattributed = 0;

    avatars.forEach((avatar) => {
        // Walk up from the avatar to a container sized like "one message"
        // rather than the whole thread — the exact depth varies by
        // markup, so this stops as soon as it finds a small-enough block
        // of text instead of assuming a fixed number of parent hops.
        let container = avatar.parentElement;
        for (let i = 0; i < 5 && container; i++) {
            const text = (container.innerText || "").trim();
            if (text && text.length > 0 && text.length < 2000) break;
            container = container.parentElement;
        }
        if (!container || seenContainers.has(container)) return;
        seenContainers.add(container);

        const text = (container.innerText || "").trim();
        if (!text) return;

        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const timeLine = lines.find((l) => TIME_RE.test(l));
        const dateLine = lines.find((l) => DATE_HEADER_RE.test(l));
        if (dateLine) currentDateHeader = dateLine;

        // Joined with a real newline, not a space — Turo's canned
        // messages (return instructions, checklists) are numbered/bulleted
        // multi-line text, and flattening them to one long line destroyed
        // that structure on the HostOS side even though whitespace-pre-wrap
        // there was ready to render it correctly.
        const body = lines
            .filter((l) => l !== timeLine && l !== dateLine && !TIME_RE.test(l) && !DATE_HEADER_RE.test(l))
            .join("\n")
            .trim();
        // Rejects page furniture as well as empty text — the live table held 8
        // rows whose entire body was the nav label "Menu".
        if (!isLikelyMessageBody(body)) return;

        // WHO WROTE THIS, ASKED IN ORDER OF HOW MUCH THE PAGE ACTUALLY SAYS.
        //
        // This was geometry alone — the avatar's x against half the window
        // width — under a comment admitting it was unverified. It was flipped
        // once when everything came back tagged as the guest, then failed the
        // other way: 570 of 578 synced messages were marked host-authored,
        // guest replies included.
        //
        // Geometry cannot work here. The side panel narrows the page so "half
        // the window" moves, and a thread rendered as one column has every
        // avatar on the left regardless of who wrote the message.
        //
        // Turo states the author twice, and both are consulted before any
        // guessing happens:
        //   1. data-testid="message-is-sent" wraps the host's own bubbles —
        //      the same signal the inbox scraper below already relies on.
        //   2. The caption reads "2:30 PM - MATTHEW (Host)". Turo writes the
        //      word; there is nothing left to infer.
        const captionLine = lines.find((l) => INBOX_CAPTION_RE.test(l));

        let fromHost;
        if (avatar.closest("[data-testid='message-is-sent']")) {
            fromHost = true;
        } else if (captionLine) {
            fromHost = INBOX_CAPTION_RE.exec(captionLine)[3].toLowerCase() === "host";
        } else if (threadHasSentMarkers) {
            // The thread does use the marker, and this bubble is not inside
            // one. That is a real negative, not a missing signal.
            fromHost = false;
        } else {
            // Neither signal is present anywhere in this thread, so the page
            // simply does not say who wrote this. The message is dropped
            // rather than guessed at: `from_host` is NOT NULL on the server,
            // so a guess is indistinguishable from a fact once stored, and
            // guessing is what produced 570 mislabelled rows. The count is
            // reported so this shows up as a number to fix instead of silence.
            unattributed++;
            return;
        }

        messages.push({
            body,
            time: timeLine || null,
            dateLabel: currentDateHeader,
            fromHost
        });
    });

    return {
        guestName,
        messages,
        // Non-zero means Turo changed its markup: neither the "message-is-sent"
        // marker nor a "(Host)" caption was found. Sync reports it so the
        // failure is a visible number instead of quietly missing messages.
        unattributed,
        schedule: scrapeReservationScheduleTimes(),
        debugSample: messages.length === 0 ? (document.body.innerText || "").slice(0, 1000) : null
    };
}

// ---------------------------------------------------------------------
// Turo Inbox scraping (turo.com/us/en/inbox/messages...) — the real guest
// back-and-forth, distinct from scrapeReservationMessages() above (which
// only ever sees the reservation detail page's canned trip-instructions
// panel, not the actual Messages inbox). Confirmed against a live
// screenshot + DevTools Elements panel of this page on 2026-08-06:
//   - Each message is captioned directly beneath it in plain text, e.g.
//     "6:30 PM – MATTHEW (Host)" / "10:44 PM – Tanner (Guest)" — an
//     explicit, unambiguous sender+role label, unlike the reservation
//     page's avatar-position guess.
//   - The thread list (left column) lives inside
//     [data-testid="messageThreadWrapper"]; each row is an <a> to
//     /inbox/messages/thread/<id> and shows "GuestName (HOST's vehicle)".
//   - The open conversation (right column) is a sibling element whose
//     class contains "MessageThreadConversationContainer".
//   - Pagination shows numbered pages ("1 2 3 ... 12") with the current
//     one visually distinct — no confirmed selector for "next", so
//     clickInboxNextPage() tries a few strategies and reports failure
//     rather than guessing silently.
// Still best-effort against class-name specifics (hashed CSS-in-JS
// classes shift between Turo deploys) — if any of this comes back empty,
// the debugSample makes it possible to correct precisely instead of
// re-guessing from scratch.
// ---------------------------------------------------------------------

const INBOX_CAPTION_RE = /^(\d{1,2}:\d{2}\s?(?:AM|PM))\s*[–—-]\s*(.+?)\s*\((Host|Guest)\)$/i;
const INBOX_DATE_HEADER_RE = /^[A-Z][a-z]{2},\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/;

function findInboxListContainer() {
    return (
        document.querySelector('[data-testid="messageThreadWrapper"]') ||
        document.querySelector('[class*="MessageThreadListContainer"]') ||
        null
    );
}

function findInboxConversationContainer() {
    return (
        document.querySelector('[class*="MessageThreadConversationContainer"]') ||
        document.querySelector('[data-testid="messageThreadWrapper"]') ||
        null
    );
}

// Scrapes the currently-visible page of the Inbox's thread list — guest
// name, a short preview, and an unread flag, for every conversation shown.
// Cheap (no per-thread tab opens): this alone is enough to at least know
// every conversation exists and roughly what it's about, even before the
// full thread has been opened.
function scrapeInboxThreadList() {
    const container = findInboxListContainer() || document.body;
    const threadLinks = Array.from(container.querySelectorAll('a[href*="/inbox/messages/thread/"]'));

    const seen = new Set();
    const threads = [];

    threadLinks.forEach((a) => {
        const hrefMatch = (a.getAttribute("href") || "").match(/\/inbox\/messages\/thread\/([\w-]+)/);
        if (!hrefMatch) return;
        const threadId = hrefMatch[1];
        if (seen.has(threadId)) return;
        seen.add(threadId);

        const text = (a.innerText || "").trim();
        if (!text) return;
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

        // "Tanner (MATTHEW's vehicle)" -> guestName "Tanner". Same suffix
        // HostOS already strips server-side from Gmail subjects.
        const nameLine = lines.find((l) => /\(.+?['’]s vehicle\)/i.test(l));
        const guestName = nameLine
            ? nameLine.replace(/\s*\(.+?['’]s vehicle\)\s*/i, "").trim()
            : (lines[0] || null);

        const dateLine = lines.find((l) => /^(Today|Yesterday)$/i.test(l) || /^[A-Za-z]{3}\s+\d{1,2}$/.test(l)) || null;
        const bookedLine = lines.find((l) => /^booked trip$/i.test(l)) || null;

        const skip = new Set([nameLine, dateLine, bookedLine].filter(Boolean));
        const preview = lines.filter((l) => !skip.has(l)).slice(-1)[0] || null;

        // No confirmed class for the unread dot — this looks for a tiny
        // (<=10px, roughly circular) element with a solid fill inside the
        // row, the same "search for the visual pattern" approach as the
        // rest of this file rather than a guessed class name.
        const unread = Array.from(a.querySelectorAll("*")).some((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.width > 10 || Math.abs(r.width - r.height) > 2) return false;
            const bg = window.getComputedStyle(el).backgroundColor;
            return !!bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
        });

        threads.push({ threadId, guestName, dateLabel: dateLine, preview, unread });
    });

    const numberEls = Array.from(document.querySelectorAll("button, a")).filter((el) =>
        /^\d{1,3}$/.test((el.innerText || "").trim())
    );
    const pageNumbers = numberEls.map((el) => parseInt(el.innerText.trim(), 10));
    const currentEl = numberEls.find((el) => {
        const style = window.getComputedStyle(el);
        return style.fontWeight === "700" || style.fontWeight === "bold" || el.getAttribute("aria-current") === "page";
    });

    return {
        threads,
        pagination: {
            currentPage: currentEl ? parseInt(currentEl.innerText.trim(), 10) : (pageNumbers.length ? Math.min(...pageNumbers) : 1),
            totalPages: pageNumbers.length ? Math.max(...pageNumbers) : 1
        },
        debugSample: threads.length === 0 ? (container.innerText || "").slice(0, 1500) : null
    };
}

// Clicks to the next page of the Inbox thread list. Tries an explicit
// "next" control first, then falls back to a numbered button one greater
// than whichever page is currently marked active.
function clickInboxNextPage() {
    let btn = document.querySelector(
        'button[aria-label*="next" i]:not([disabled]), a[aria-label*="next" i]'
    );

    if (!btn) {
        const numberEls = Array.from(document.querySelectorAll("button, a")).filter((el) =>
            /^\d{1,3}$/.test((el.innerText || "").trim())
        );
        const currentEl = numberEls.find((el) => {
            const style = window.getComputedStyle(el);
            return style.fontWeight === "700" || style.fontWeight === "bold" || el.getAttribute("aria-current") === "page";
        });
        const current = currentEl ? parseInt(currentEl.innerText.trim(), 10) : null;
        if (current != null) {
            btn = numberEls.find((el) => parseInt(el.innerText.trim(), 10) === current + 1) || null;
        }
    }

    if (!btn) return { ok: false };
    btn.click();
    return { ok: true };
}

// Navigates to a specific thread by clicking its row in the list — used
// instead of a direct URL nav so the list panel (needed for pagination
// state) stays intact around it.
function clickInboxThread(threadId) {
    const link = document.querySelector(`a[href*="/inbox/messages/thread/${threadId}"]`);
    if (!link) return { ok: false };
    link.click();
    return { ok: true };
}

// Scrapes the currently-open conversation's full message history. Each
// message is followed by an explicit "TIME – Name (Host|Guest)" caption
// line in the page's rendered text — this is parsed directly rather than
// inferred from bubble position, since that heuristic already proved
// unreliable once (see scrapeReservationMessages above).
// Text that is page furniture rather than anything a person wrote. Without
// this the innerText walk stored nav labels as guest messages — the live table
// held 8 rows whose entire body was the string "Menu".
const INBOX_CHROME_RE = /^(menu|inbox|messages|notifications|search|back|close|more|filter|all|unread|archived|today|yesterday|host|guest|send|reply)$/i;

function isLikelyMessageBody(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    if (INBOX_CHROME_RE.test(trimmed)) return false;
    // A single short word with no sentence punctuation is almost always a
    // control label, never a message.
    if (!/\s/.test(trimmed) && trimmed.length < 12 && !/[.!?,:]/.test(trimmed)) return false;
    return true;
}

// Turo renders a per-message timestamp near its bubble. Look for a clock
// reading on the bubble itself or its immediate ancestry, rather than assuming
// one fixed element — the exact wrapper has moved between Turo deploys.
function timeNearBubble(bubble) {
    let node = bubble;
    for (let depth = 0; depth < 4 && node; depth += 1) {
        const match = (node.innerText || "").match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM))\b/i);
        if (match) return match[1];
        node = node.parentElement;
    }
    return null;
}

/**
 * Reads one open inbox conversation.
 *
 * TWO STRATEGIES, tried in order, because the previous single strategy failed
 * silently and totally: it split container.innerText on newlines and required
 * every message to be preceded by a line matching
 * "8:35 PM – Matthew (Host)". Against the live account that matched ZERO
 * lines, so across 577 stored rows not one carried a timestamp — every message
 * time shown in HostOS was actually `synced_at`, a scrape-order counter, and
 * the only rows that ever landed came from the reservation instructions panel.
 *
 * Strategy A is attribute-based: `[data-testid='message-bubble']` with
 * `[data-testid='message-is-sent']` marking the host's own messages. Those are
 * real test ids confirmed live on 2026-08-24 and already relied on elsewhere.
 * Attributes survive Turo's CSS-hash regeneration; a prose format does not.
 *
 * Strategy B is the original caption walk, kept as a fallback.
 *
 * `strategy` is returned either way so a future failure is diagnosable from
 * the sync result instead of needing someone to reproduce it by hand.
 */
function scrapeInboxThreadMessages() {
    const composeEl = queryComposeBox();
    let guestName = null;
    if (composeEl && composeEl.placeholder) {
        const m = composeEl.placeholder.match(/to\s+(.+?)\s*$/i);
        if (m) guestName = m[1].trim();
    }

    // Deliberately NOT falling back to document.body. Scraping the whole page
    // is what pulled navigation chrome in as message text; with no
    // conversation container there is genuinely nothing to read.
    const container = findInboxConversationContainer();
    if (!container) {
        return {
            guestName,
            messages: [],
            strategy: "none",
            reason: "no_conversation_container",
            debugSample: (document.body.innerText || "").slice(0, 1500)
        };
    }

    // --- Strategy A: message bubbles -------------------------------------
    const bubbles = [...container.querySelectorAll("[data-testid='message-bubble']")];
    if (bubbles.length > 0) {
        const messages = [];
        let currentDateHeader = null;

        // Date headers sit between bubbles in document order, so walk the
        // container's children rather than the bubbles alone.
        const walker = [...container.querySelectorAll("*")];
        for (const node of walker) {
            const text = (node.innerText || "").trim();
            if (!node.children.length && INBOX_DATE_HEADER_RE.test(text)) {
                currentDateHeader = text;
                continue;
            }
            if (!node.matches("[data-testid='message-bubble']")) continue;

            const body = (node.innerText || "")
                .replace(/\b\d{1,2}:\d{2}\s?(?:AM|PM)\b/i, "")
                .trim();
            if (!isLikelyMessageBody(body)) continue;

            messages.push({
                body,
                time: timeNearBubble(node),
                dateLabel: currentDateHeader,
                fromHost: Boolean(node.closest("[data-testid='message-is-sent']"))
            });
        }

        if (messages.length > 0) {
            return { guestName, messages, strategy: "bubbles", debugSample: null };
        }
    }

    // --- Strategy B: the original caption walk ---------------------------
    const rawLines = (container.innerText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const messages = [];
    let buffer = [];
    let currentDateHeader = null;

    rawLines.forEach((line) => {
        if (INBOX_DATE_HEADER_RE.test(line)) {
            currentDateHeader = line;
            return;
        }

        const captionMatch = line.match(INBOX_CAPTION_RE);
        if (captionMatch) {
            // Real newline, not a space — same reasoning as
            // scrapeReservationMessages above: canned messages are
            // numbered/bulleted multi-line text on Turo's own page.
            const body = buffer.join("\n").trim();
            buffer = [];
            if (!isLikelyMessageBody(body)) return;
            messages.push({
                body,
                time: captionMatch[1],
                dateLabel: currentDateHeader,
                fromHost: captionMatch[3].toLowerCase() === "host"
            });
            return;
        }

        buffer.push(line);
    });

    return {
        guestName,
        messages,
        strategy: messages.length > 0 ? "captions" : "none",
        reason: messages.length === 0 ? (bubbles.length ? "bubbles_found_but_unreadable" : "no_bubbles_no_captions") : undefined,
        debugSample: messages.length === 0 ? (container.innerText || "").slice(0, 1500) : null
    };
}

function sendReservationMessage(text) {
    const composeEl = queryComposeBox();
    if (!composeEl) {
        return {
            ok: false,
            error: "Couldn't find the message box.",
            debugSample: document.body.innerHTML.slice(-1000)
        };
    }

    composeEl.focus();
    setNativeTextValue(composeEl, text);

    const sendBtn = querySendButton(composeEl);
    if (!sendBtn) {
        return {
            ok: false,
            error: "Couldn't find the Send button.",
            debugSample: composeEl.outerHTML.slice(0, 600)
        };
    }

    sendBtn.click();

    return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "scanTrips") {
        console.log("📨 Scan request received.");
        const trips = scrapeTrips();
        sendResponse(trips);
        return true;
    }

    if (message.action === "scanReservationExtras") {
        console.log("📨 Reservation extras scan requested.");
        const extras = scrapeReservationExtras();
        sendResponse({ extras: extras });
        return true;
    }

    if (message.action === "scanReservationLicenseStatus") {
        console.log("📨 Reservation license status scan requested.");
        const status = scrapeReservationLicenseStatus();
        sendResponse(status);
        return true;
    }

    if (message.action === "sendReservationMessage") {
        console.log("📨 Send reservation message requested.");
        const result = sendReservationMessage(message.text || "");
        sendResponse(result);
        return true;
    }

    if (message.action === "scanReservationMessages") {
        console.log("📨 Reservation message thread scan requested.");
        const result = scrapeReservationMessages();
        sendResponse(result);
        return true;
    }

    if (message.action === "scanInboxThreadList") {
        console.log("📨 Inbox thread list scan requested.");
        const result = scrapeInboxThreadList();
        sendResponse(result);
        return true;
    }

    if (message.action === "clickInboxNextPage") {
        const result = clickInboxNextPage();
        sendResponse(result);
        return true;
    }

    if (message.action === "clickInboxThread") {
        const result = clickInboxThread(message.threadId);
        sendResponse(result);
        return true;
    }

    if (message.action === "scanInboxThreadMessages") {
        console.log("📨 Inbox thread messages scan requested.");
        const result = scrapeInboxThreadMessages();
        sendResponse(result);
        return true;
    }

    // Fleet Calendar roster scan — see fleetCalendar.js. The grid is
    // virtualized, so a single scan only ever returns the rows currently
    // rendered; sync.js merges by plate across scans and scrolls for more.
    if (message.action === "scanFleetCalendar") {
        console.log("📨 Fleet calendar scan requested.");
        const result = scrapeFleetCalendar();
        sendResponse(result);
        return true;
    }

    // Scrolls the calendar grid so the next batch of virtualized vehicle rows
    // renders, then reports whether the page actually moved. Paging from the
    // background this way is what lets one visit cover a 45-vehicle fleet
    // instead of only the ~15 rows that fit on screen.
    if (message.action === "scrollFleetCalendar") {
        const before = window.scrollY;
        window.scrollBy(0, Math.round(window.innerHeight * 0.8));
        sendResponse({ ok: true, moved: window.scrollY > before, scrollY: window.scrollY });
        return true;
    }

    // Protection plan + guest track record, from Turo's JSON APIs — see
    // enrichment.js. Same-origin fetches, so this runs on whatever Turo tab is
    // already open and needs no background tab of its own. Async, so the
    // listener returns true and resolves sendResponse later.
    if (message.action === "enrichReservations") {
        console.log("📨 Reservation enrichment requested.");
        scrapeReservationEnrichment(message.reservationIds || [], message.withGuestIds || [], message.tripWindows || {})
            .then(sendResponse)
            .catch((err) => {
                console.error("[HostOS] Enrichment sweep failed:", err);
                sendResponse({ ok: false, results: [], requested: 0, failures: 0 });
            });
        return true;
    }

    return true;

});
