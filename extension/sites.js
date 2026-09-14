// sites.js
// The platforms the Companion recognises, in one place.
//
// One extension, many sites. Each entry says how to tell a URL belongs to
// the platform and what the Companion does there, so adding the next
// platform (Uber Eats, Getaround, WooCommerce…) is a new entry and a new
// content module — never a second extension. Loaded by the service worker
// (importScripts) and by the side panel (<script>); content scripts get
// their own copy of the same matchers inline, since they cannot importScripts.

const HOSTOS_SITES = [
    {
        id: "turo",
        name: "Turo",
        module: "fleet",
        matches: (url) => /^https?:\/\/(www\.)?turo\.com\//i.test(url),
        // What runs there: trips/messages/license/enrichment loops + the widget.
        capabilities: ["sync", "messages", "licence", "enrichment", "calendar", "widget", "draft"],
    },
    {
        id: "doordash",
        name: "DoorDash Merchant Portal",
        module: "restaurants",
        matches: (url) => /^https?:\/\/(merchant-portal|merchant)\.doordash\.com\//i.test(url) || /^https?:\/\/(www\.)?doordash\.com\/merchant\//i.test(url),
        capabilities: ["store-status", "draft"],
    },
    {
        id: "shopify",
        name: "Shopify admin",
        module: "commerce",
        matches: (url) => /^https?:\/\/admin\.shopify\.com\//i.test(url) || /^https?:\/\/[a-z0-9-]+\.myshopify\.com\/admin/i.test(url),
        capabilities: ["sync-trigger", "open-in-hostos"],
    },
];

function hostosSiteFor(url) {
    for (const site of HOSTOS_SITES) if (site.matches(url || "")) return site;
    return null;
}
