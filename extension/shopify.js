// shopify.js
// Content module for the Shopify admin.
//
// Shopify data reaches HostOS through the Admin API (server-side, hourly and
// on demand), so this script does not scrape anything. It recognises which
// shop is open, shows whether HostOS knows it, and offers a one-click
// "Sync now" that asks the service worker to trigger the API sync.

(function () {
    "use strict";

    if (window.__hostosShopifyLoaded) return;
    window.__hostosShopifyLoaded = true;

    const BADGE_ID = "hostos-shopify-badge";

    function shopDomain() {
        // admin.shopify.com/store/<handle>/… or <handle>.myshopify.com/admin
        const m = location.hostname.match(/^([a-z0-9-]+)\.myshopify\.com$/i);
        if (m) return m[1] + ".myshopify.com";
        const p = location.pathname.match(/^\/store\/([a-z0-9-]+)/i);
        return p ? p[1] + ".myshopify.com" : null;
    }

    function render(state) {
        let badge = document.getElementById(BADGE_ID);
        if (!badge) {
            badge = document.createElement("div");
            badge.id = BADGE_ID;
            badge.style.cssText =
                "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 12px;border-radius:999px;background:#131316;color:#f5f5f7;font:500 12px/1 -apple-system,Segoe UI,Inter,sans-serif;border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 32px -12px rgba(0,0,0,.7)";
            document.body.appendChild(badge);
        }
        badge.replaceChildren();
        const dot = document.createElement("span");
        dot.style.cssText = "width:7px;height:7px;border-radius:999px;background:" + (state.tone === "ok" ? "#30d158" : state.tone === "busy" ? "#0a84ff" : "#ff9f0a");
        const text = document.createElement("span");
        text.textContent = state.text;
        badge.append(dot, text);
        if (state.action) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = state.action.label;
            btn.style.cssText = "margin-left:2px;padding:5px 10px;border-radius:999px;border:0;background:#0a84ff;color:#fff;font:600 11px/1 inherit;cursor:pointer;transition:transform .15s cubic-bezier(.16,1,.3,1)";
            btn.onmousedown = () => (btn.style.transform = "scale(.96)");
            btn.onmouseup = () => (btn.style.transform = "");
            btn.onclick = state.action.run;
            badge.appendChild(btn);
        }
        if (state.href) {
            const link = document.createElement("a");
            link.href = state.href;
            link.target = "_blank";
            link.rel = "noreferrer";
            link.textContent = "Open";
            link.style.cssText = "color:#9a9aa3;text-decoration:none;font-size:11px";
            badge.appendChild(link);
        }
    }

    function sync(domain) {
        render({ tone: "busy", text: "HostOS · syncing " + domain + "…" });
        chrome.runtime.sendMessage({ type: "hostos:shopify-sync", domain }, (res) => {
            if (chrome.runtime.lastError || !res) return render({ tone: "warn", text: "HostOS · couldn't reach HostOS" });
            if (res.ok) render({ tone: "ok", text: "HostOS · synced " + res.products + " products, " + res.orders + " orders", href: res.href, action: { label: "Sync again", run: () => sync(domain) } });
            else render({ tone: "warn", text: "HostOS · " + (res.hint || res.error || "sync failed"), href: res.href });
        });
    }

    function init() {
        const domain = shopDomain();
        if (!domain) return;
        chrome.runtime.sendMessage({ type: "hostos:context" }, (ctx) => {
            if (chrome.runtime.lastError || !ctx || !ctx.ok) return render({ tone: "warn", text: "HostOS · not paired" });
            const store = (ctx.stores || []).find((s) => s.domain === domain);
            if (!store) return render({ tone: "warn", text: "HostOS · " + domain + " isn't connected", href: ctx.links && ctx.links.commerce });
            render({ tone: "ok", text: "HostOS · " + store.name, href: store.href, action: store.connected ? { label: "Sync now", run: () => sync(domain) } : null });
        });
    }

    setTimeout(init, 2500);
})();
