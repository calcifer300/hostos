// Executes the two files the unit suite only inspects - the in-page widget
// and the service worker - against a fake browser with sample storage, and
// fails on any thrown error or unhandled rejection. Both were patched by
// string replacement more than once today; a ReferenceError in either shows
// up only when the extension is actually loaded, which is the wrong moment.
//   node tests/smoke.js
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
let failures = 0;
const fail = (msg) => { failures += 1; console.log("  FAIL " + msg); };
const ok = (msg) => console.log("  ok   " + msg);
process.on("unhandledRejection", (error) => fail("unhandled rejection: " + (error && error.stack || error)));

// --- a DOM real enough to run widget.js -------------------------------------
function makeElement(tag) {
  const node = {
    tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, _text: "", className: "", hidden: false, id: "",
    _classes: new Set(), listeners: {},
    classList: {
      add(...c) { c.forEach((x) => node._classes.add(x)); }, remove(...c) { c.forEach((x) => node._classes.delete(x)); },
      contains: (x) => node._classes.has(x), toggle(x, force) { const on = force === undefined ? !node._classes.has(x) : force; on ? node._classes.add(x) : node._classes.delete(x); return on; }
    },
    set textContent(v) { node._text = String(v); node.children = []; },
    get textContent() { return node._text + node.children.map((c) => c.textContent).join(""); },
    set innerHTML(v) { node.children = []; node._text = ""; }, get innerHTML() { return ""; },
    get innerText() { return node.textContent; },
    appendChild(c) { node.children.push(c); c.parentNode = node; return c; },
    append(...cs) { cs.forEach((c) => node.appendChild(c)); },
    remove() {}, setAttribute(k, v) { if (k === "id") node.id = v; }, getAttribute: () => null,
    addEventListener(type, fn) { (node.listeners[type] = node.listeners[type] || []).push(fn); },
    contains: (other) => { let cur = other; while (cur) { if (cur === node) return true; cur = cur.parentNode; } return false; },
    closest: () => null, focus() {}, blur() {},
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      (function walk(n) { (n.children || []).forEach((c) => { if (matches(c, sel)) out.push(c); walk(c); }); })(node);
      return out;
    }
  };
  return node;
}
function matches(n, sel) {
  if (!n || !n._classes) return false; // text nodes
  return sel.split(",").some((part) => {
    part = part.trim();
    if (part.startsWith(".")) return part.slice(1).split(".").every((c) => n._classes.has(c) || (n.className || "").split(" ").includes(c));
    if (part.startsWith("#")) return n.id === part.slice(1);
    return n.tagName === part.toUpperCase();
  });
}
const root = makeElement("html");
global.window = global;
global.document = {
  documentElement: root, body: makeElement("body"), activeElement: null, createElement: makeElement,
  createTextNode: (t) => ({ textContent: String(t), children: [] }), getElementById: (id) => root.querySelectorAll("#" + id)[0] || null,
  addEventListener() {}, querySelector: (s) => root.querySelector(s), querySelectorAll: (s) => root.querySelectorAll(s)
};
global.location = { href: "https://turo.com/us/en/trips/booked", search: "", pathname: "/us/en/trips/booked", origin: "https://turo.com" };
global.URLSearchParams = URLSearchParams;
global.setInterval = () => 0; global.setTimeout = (fn) => { return 0; };

// --- sample storage -----------------------------------------------------------
const day = (n, h) => { const d = new Date(); d.setHours(h || 12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString(); };
const iso = (n) => new Date(Date.now() - n * 864e5).toISOString();
const base = { protectionCheckedAt: iso(0), guestCheckedAt: iso(0), earningsVersion: 6, extras: [], earningsExtras: 0 };
const trips = [
  { ...base, reservationId: "61165819", guestName: "Kumar", vehicle: "Mazda CX-50 2024", plate: "DJIL68", pickupDate: day(11, 13), returnDate: day(17, 19), protectionLevel: "SUPREME", protectionPlanName: "Premier", guestMaxOutOfPocket: 0, premierProtection: true, earningsRisk: true, earningsBelowFloor: false, estimatedEarnings: 239, earningsPerMile: 0.23, includedMiles: 1050, hostTakeRate: 0.7, earningsInputsKnown: true, earningsDelivery: 120, deliveryFeeSource: "turo", guestRating: 4.3, guestRatingCount: 9, guestTripCount: 10, riskReasons: ["Guest bought the Premier plan"], tripUrl: "https://turo.com/us/en/reservation/61165819" },
  { ...base, reservationId: "61048407", guestName: "maryann", vehicle: "Mazda CX-50 2024", plate: "EOCX52", pickupDate: day(0, 23), returnDate: day(3), licenseVerified: false, protectionPlanName: "Minimum", guestMaxOutOfPocket: 3000, guestRating: 5, guestRatingCount: 1, guestTripCount: 1, estimatedEarnings: 210, tripUrl: "https://turo.com/us/en/reservation/61048407" },
  { ...base, reservationId: "60907051", guestName: "Isaiah", vehicle: "Volkswagen Taos 2024", plate: "ENHF08", pickupDate: day(2, 12), returnDate: day(7, 15), earningsRisk: true, earningsBelowFloor: true, premierProtection: false, estimatedEarnings: 158, earningsPerMile: 0.13, includedMiles: 1200, hostTakeRate: 0.7, earningsInputsKnown: true, earningsDelivery: 120, deliveryFeeSource: "turo", protectionPlanName: "Standard", guestMaxOutOfPocket: 500, guestRatingCount: 0, guestTripCount: 0, riskReasons: ["Earns only $0.13/mile of the allowance (below $0.20)"], tripUrl: "https://turo.com/us/en/reservation/60907051" },
  { ...base, reservationId: "60555555", guestName: "Anna", vehicle: "Volkswagen Atlas 2023", plate: "EWPI04", pickupDate: day(2), returnDate: day(8), earningsUndecided: true, earningsBelowFloor: false, estimatedEarnings: 210, earningsPerMile: 0.17, includedMiles: 1200, earningsUnknownInputs: ["extras"], earningsInputsKnown: false, tripUrl: "https://turo.com/us/en/reservation/60555555" },
  { ...base, reservationId: "60616336", guestName: "Karen", vehicle: "Volkswagen Tiguan 2022", plate: "AVVX92", pickupDate: day(-13), returnDate: day(-5), completed: true, completedAt: day(-5), postTripCheckedAt: iso(0), milesDriven: 191, milesExcess: 0, driverId: "1", guestSaysRated: { at: iso(0.2), quote: "Left you a 5 star review, thanks!" }, estimatedEarnings: 260, tripUrl: "https://turo.com/us/en/reservation/60616336" },
  { ...base, reservationId: "60410598", guestName: "Mya", vehicle: "Volkswagen Taos 2024", plate: "ENHF01", pickupDate: day(-11), returnDate: day(-4), completed: true, completedAt: day(-4), postTripCheckedAt: iso(0), milesDriven: 317, milesExcess: 0, driverId: "2", estimatedEarnings: 240, tripUrl: "https://turo.com/us/en/reservation/60410598" },
  { ...base, reservationId: "61109808", guestName: "Stephen", vehicle: "Volkswagen Tiguan 2024", plate: "EPMA97", pickupDate: day(8), returnDate: day(15), protectionLevel: "SUPREME", premierProtection: true, cancelled: true, cancelledSignal: "statusCode=CANCELLED", cancelledSeenAt: iso(1), estimatedEarnings: 300 }
];
const store = {
  hostosTrips: trips, hostosReviews: {}, hostosLastScan: iso(0.0003), hostosPaused: false, hostosScanHealth: null, hostosAlerted: {}, hostosNotified: {},
  hostosDetailStatus: { completed: 254, eligible: 3, updatedAt: iso(0.0005), lastAttempt: { reservationId: "61048407", result: "success", at: iso(0.001) } },
  hostosFleetAvailability: null,
  hostosAlertConfig: { enabled: true, webhookUrl: "https://script.google.com/macros/s/x/exec", recipients: "a@b.c", urgentRecipients: "a@b.c" },
  hostosPricingConfig: { standingDeliveryFee: 120, reportLogo: false }, hostosAlertStatus: { ok: true, deployedVersion: 7 }
};
const posts = [];
const notifications = [];
global.chrome = {
  storage: {
    local: {
      get: async (keys) => { const out = {}; (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (store[k] !== undefined) out[k] = store[k]; }); return out; },
      set: async (patch) => { Object.assign(store, patch); }
    },
    onChanged: { addListener() {} }
  },
  runtime: { getURL: (p) => "chrome-extension://x/" + p, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, sendMessage: async () => ({ ok: true }) },
  alarms: { create() {}, onAlarm: { addListener() {} } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor() {} },
  notifications: { create: (id, opts, cb) => { notifications.push(opts); cb && cb(id); }, onClicked: { addListener() {} } },
  tabs: { query: async () => [], create: async () => ({}), onRemoved: { addListener() {} }, onUpdated: { addListener() {} } },
  sidePanel: { setPanelBehavior: () => Promise.resolve() }
};
global.fetch = async (url, options) => {
  if (String(url).includes("script.google.com")) { posts.push(JSON.parse(options.body)); return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ ok: true, version: 7 }) }; }
  if (String(url).includes("colorado-cruisers.png")) return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  return { ok: false, status: 404, headers: { get: () => "text/html" }, json: async () => ({}), text: async () => "" };
};

(async () => {
  console.log("\nsmoke: widget.js runs against sample storage");
  const modules = ["utils/constants.js", "utils/logger.js", "utils/dates.js", "utils/parser.js", "utils/reviews.js", "utils/outlook.js", "utils/storage.js",
    "modules/licenseMonitor.js", "modules/riskEngine.js", "modules/queueView.js"];
  modules.forEach((f) => eval.call(global, fs.readFileSync(path.join(ROOT, f), "utf8")));
  try {
    eval.call(global, fs.readFileSync(path.join(ROOT, "content/widget.js"), "utf8"));
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    const panel = root.querySelector(".hostos-widget-panel");
    const text = panel ? panel.textContent : "";
    ok("widget loads without throwing");
    [/COLORADO CRUISERS/, /Premier Plan Bookings/, /1 trip · cancel before pickup/, /Unverified Licenses/, /1 trip · pickup within 24h/, /Profit Risk/, /1 trip · below \$0\.20\/mi/, /2 waiting · 1 ready to rate/, /this month/, /Active/, /Plans checked/, /Queue/]
      .forEach((re) => re.test(text) ? ok("panel shows " + re.source.replace(/\\/g, "")) : fail("panel missing " + re.source));
    const hero = root.querySelector(".hostos-widget-hero");
    /^3/.test(hero.textContent.replace(/ACTION REQUIRED/, "").trim()) ? ok("hero counts 3 (Premier + licence + thin), not the reviews too") : fail("hero: " + hero.textContent);
    /1 Premier booking to cancel before pickup/.test(hero.textContent) ? ok("hero names the most urgent thing") : fail("hero headline missing: " + hero.textContent);
    // Open every queue through the real click path.
    const cards = root.querySelector(".hostos-widget-cards");
    for (const tile of cards.children) {
      cards.listeners.click.forEach((fn) => fn({ target: { closest: () => tile } }));
      const results = root.querySelector(".hostos-results");
      results.children.length ? ok("queue renders: " + tile.dataset.filter) : fail("queue empty for " + tile.dataset.filter);
    }
  } catch (error) { fail("widget threw: " + error.stack); }

  console.log("\nsmoke: service worker composes and sends the real payloads");
  try {
    global.self = global; global.importScripts = (...files) => files.forEach((f) => eval.call(global, fs.readFileSync(path.join(ROOT, f), "utf8")));
    delete global.HostOS;
    eval.call(global, fs.readFileSync(path.join(ROOT, "background/service-worker.js"), "utf8"));
    await new Promise((r) => setImmediate(r));
    const digest = await sendDailyDigest({ force: true });
    digest && digest.ok ? ok("nightly report sends") : fail("digest: " + JSON.stringify(digest));
    const sent = posts[posts.length - 1];
    if (!sent) fail("no report posted"); else {
      /PREVIEW/.test(sent.subject) ? ok("forced send is marked PREVIEW") : fail("subject: " + sent.subject);
      [/BELOW \$0\.20\/MILE \(1\)/, /COULD NOT PRICE \(1\)/, /UNVERIFIED LICENSES, PICKUP WITHIN 24H \(1\)/, /PREMIER PLAN, ALREADY ALERTED \(1\)/, /REVIEWS WAITING ON YOU \(2\)/, /EARNINGS OUTLOOK/]
        .forEach((re) => re.test(sent.body) ? ok("text has " + re.source.replace(/\\/g, "")) : fail("text missing " + re.source + "\n" + sent.body.slice(0, 400)));
      [/<table/, /GUEST RATED YOU/i, /Isaiah/, /Kumar/, /70 plan/, /Stephen/]
        .forEach((re, i) => { const present = re.test(sent.html); if (i === 5) present ? fail("a cancelled reservation reached the report") : ok("cancelled reservation kept out of the report"); else present ? ok("html has " + re.source) : fail("html missing " + re.source); });
      !/undefined|NaN|\[object/.test(sent.html + sent.body) ? ok("no undefined/NaN in the report") : fail("undefined or NaN in the report");
    }
    await notifyForTrips();
    ok("notifications run (" + notifications.length + " raised)");
    notifications.some((n) => /Premier plan booked/.test(n.title)) ? ok("a Premier booking notifies as Premier") : fail("no Premier notification: " + JSON.stringify(notifications.map((n) => n.title)));
    await alertPremierTrips(trips);
    const premierPosts = posts.filter((p) => p.kind === "premier");
    premierPosts.length === 1 && premierPosts[0].trip.reservationId === "61165819" ? ok("exactly one Premier email, for the live Premier trip, none for the cancelled one") : fail("premier posts: " + JSON.stringify(premierPosts.map((p) => p.trip.reservationId)));
    await alertPremierTrips(trips);
    posts.filter((p) => p.kind === "premier").length === 1 ? ok("and not again on the next pass") : fail("Premier email sent twice");
  } catch (error) { fail("service worker threw: " + error.stack); }

  console.log("\n" + (failures ? failures + " FAILED" : "smoke passed"));
  process.exit(failures ? 1 : 0);
})();
