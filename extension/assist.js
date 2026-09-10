// assist.js
// Draft a reply to whatever message is on screen, grounded in HostOS.
//
// Merged from Karl's ai-reply-extension, with the substantive change being
// where the draft comes from. His version called Gemini directly with its own
// API key and no context — fluent, confident replies that knew nothing about
// the host's check-in process, their tone, or Turo's policy. This posts to
// HostOS's /api/companion/draft with the pairing key the Companion already
// holds, so a draft is grounded in the fleet's knowledge base and the relevant
// Turo help-centre articles, and there is one credential instead of two.
//
// Runs on turo.com and the mail/chat hosts named in the manifest — not
// <all_urls>. Karl's version read every page in the browser, which is a
// permission this does not need to do its job.

(function () {
    "use strict";

    if (window.__hostosAssistLoaded) return;
    window.__hostosAssistLoaded = true;

    const PANEL_ID = "hostos-assist-panel";

    /**
     * Selectors for "the message that was just received", most specific first.
     *
     * Karl's original walked a longer list covering Discord, Teams and generic
     * forums. This keeps the hosts the manifest actually grants, because a
     * selector for a site the extension cannot run on is dead weight that
     * still has to be maintained.
     */
    const INBOUND_SELECTORS = [
        // Turo's own guest thread
        '[class*="message"][class*="received"]',
        '[data-testid*="message"]',
        // Gmail
        ".a3s.aiL",
        "div.ii.gt div",
        // WhatsApp Web
        ".message-in .selectable-text",
        // Slack
        '[data-qa="message_content"]',
        // Generic
        '[class*="incoming"]',
    ];

    /** The composer to paste into. */
    const COMPOSER_SELECTORS = [
        'textarea[name="message"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        "textarea",
    ];

    function visible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * What to reply to.
     *
     * A selection always wins. Karl got this right and it is worth keeping:
     * automatic detection is a heuristic over someone else's DOM and will
     * sometimes pick the wrong bubble, and highlighting the text is the
     * fastest possible correction — no picker, no settings.
     */
    function findInboundMessage() {
        const selected = String(window.getSelection() || "").trim();
        if (selected.length > 12) return { text: selected, source: "selection" };

        for (const selector of INBOUND_SELECTORS) {
            const nodes = [...document.querySelectorAll(selector)].filter(visible);
            if (nodes.length === 0) continue;

            const last = nodes[nodes.length - 1];
            const text = (last.innerText || "").trim();
            if (text.length > 12) return { text: text.slice(0, 4000), source: selector };
        }

        return null;
    }

    function findComposer() {
        for (const selector of COMPOSER_SELECTORS) {
            const nodes = [...document.querySelectorAll(selector)].filter(visible);
            if (nodes.length > 0) return nodes[nodes.length - 1];
        }
        return null;
    }

    /**
     * Writes text into a composer.
     *
     * Two shapes, because modern composers are not textareas. For a real
     * input the native value setter has to be called explicitly — assigning
     * `.value` directly does not notify React, so the field looks filled and
     * submits empty, which is Karl's comment on this and it is correct.
     */
    function insertIntoComposer(el, text) {
        if (!el) return false;

        el.focus();

        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            const proto = el.tagName === "TEXTAREA"
                ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(el, text);
            else el.value = text;

            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        }

        if (el.isContentEditable) {
            // execCommand is deprecated and is still the only thing that
            // reliably produces the input events rich composers listen for.
            const ok = document.execCommand("insertText", false, text);
            if (!ok) {
                el.textContent = text;
                el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
            }
            return true;
        }

        return false;
    }

    // ---------------------------------------------------------------- panel

    function removePanel() {
        document.getElementById(PANEL_ID)?.remove();
    }

    function showPanel(state) {
        removePanel();

        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        // Styled inline rather than through a stylesheet: this renders on
        // someone else's page, and a class name is a collision waiting to
        // happen.
        panel.style.cssText = [
            "position:fixed", "right:18px", "bottom:18px", "z-index:2147483647",
            "width:360px", "max-width:calc(100vw - 36px)",
            "background:#1C1C1E", "color:#F5F5F7",
            "border:1px solid #38383A", "border-radius:14px",
            "box-shadow:0 12px 40px rgba(0,0,0,.45)",
            "font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            "padding:14px", "box-sizing:border-box",
        ].join(";");

        const header = document.createElement("div");
        header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px";
        header.innerHTML =
            '<span style="font-weight:600;font-size:13px;letter-spacing:-.01em">host<span style="color:#0A84FF">OS</span> draft</span>';

        const close = document.createElement("button");
        close.textContent = "✕";
        close.setAttribute("aria-label", "Close");
        close.style.cssText =
            "background:none;border:0;color:#98989D;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1";
        close.addEventListener("click", removePanel);
        header.appendChild(close);
        panel.appendChild(header);

        const body = document.createElement("div");
        body.style.cssText = "font-size:13px";
        panel.appendChild(body);

        if (state.status === "loading") {
            body.textContent = "Reading the message and checking your knowledge base…";
            body.style.color = "#98989D";
        } else if (state.status === "error") {
            body.textContent = state.message;
            body.style.color = "#FF453A";
        } else {
            if (state.escalate) {
                const warn = document.createElement("div");
                warn.style.cssText =
                    "background:rgba(255,159,10,.12);border-left:2px solid #FF9F0A;border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:8px;font-size:12.5px;color:#FF9F0A";
                warn.textContent = state.escalateReason
                    ? `Read this before sending — ${state.escalateReason}`
                    : "Read this before sending.";
                body.appendChild(warn);
            }

            const draft = document.createElement("textarea");
            draft.value = state.draft;
            draft.rows = 8;
            draft.style.cssText =
                "width:100%;box-sizing:border-box;background:#000;color:#F5F5F7;border:1px solid #38383A;border-radius:8px;padding:9px;font:13px/1.5 inherit;resize:vertical";
            body.appendChild(draft);

            if (state.sources && state.sources.length > 0) {
                const cites = document.createElement("div");
                cites.style.cssText = "margin-top:7px;font-size:11.5px;color:#98989D";
                cites.append("Grounded in: ");
                state.sources.forEach((s, i) => {
                    const link = document.createElement("a");
                    link.href = s.url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = s.title;
                    link.style.cssText = "color:#0A84FF;text-decoration:none";
                    cites.appendChild(link);
                    if (i < state.sources.length - 1) cites.append(", ");
                });
                body.appendChild(cites);
            }

            const actions = document.createElement("div");
            actions.style.cssText = "display:flex;gap:7px;margin-top:10px";

            const insert = document.createElement("button");
            insert.textContent = "Insert";
            insert.style.cssText =
                "background:#0A84FF;color:#fff;border:0;border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:500;cursor:pointer";
            insert.addEventListener("click", () => {
                const ok = insertIntoComposer(findComposer(), draft.value);
                insert.textContent = ok ? "Inserted" : "No box found";
                if (ok) setTimeout(removePanel, 700);
            });

            const copy = document.createElement("button");
            copy.textContent = "Copy";
            copy.style.cssText =
                "background:none;color:#F5F5F7;border:1px solid #38383A;border-radius:999px;padding:7px 14px;font-size:12.5px;cursor:pointer";
            copy.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(draft.value);
                    copy.textContent = "Copied";
                } catch {
                    copy.textContent = "Select it";
                }
            });

            actions.append(insert, copy);
            body.appendChild(actions);
        }

        document.body.appendChild(panel);
    }

    // --------------------------------------------------------------- drafting

    async function draftReply() {
        const inbound = findInboundMessage();
        if (!inbound) {
            showPanel({
                status: "error",
                message: "Couldn't find a message to reply to. Highlight the text you want a reply to, then try again.",
            });
            return;
        }

        showPanel({ status: "loading" });

        let response;
        try {
            response = await chrome.runtime.sendMessage({
                type: "hostos:draft",
                message: inbound.text,
            });
        } catch {
            showPanel({
                status: "error",
                message: "The HostOS extension isn't responding. Reload the page and try again.",
            });
            return;
        }

        if (!response || !response.ok) {
            showPanel({
                status: "error",
                message: (response && response.error) || "Couldn't draft a reply.",
            });
            return;
        }

        if (!response.draft) {
            showPanel({
                status: "error",
                message: response.summary
                    ? `No reply needed — ${response.summary}`
                    : "HostOS didn't think this needed a reply.",
            });
            return;
        }

        showPanel({
            status: "ready",
            draft: response.draft,
            escalate: response.escalate,
            escalateReason: response.escalateReason,
            sources: response.sources,
        });
    }

    // Alt+R, from Karl's original. Registered here as well as in the manifest
    // so it works inside iframes, where the command API does not reach.
    document.addEventListener("keydown", (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "r" || e.key === "R")) {
            e.preventDefault();
            draftReply();
        }
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "hostos:draft-here") draftReply();
    });
})();
