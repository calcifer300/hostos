// Paste into the DevTools console on turo.com, signed in. Run it TWICE:
//   1. on Trips > History            (the completed-trips list)
//   2. on one COMPLETED trip's page   (turo.com/us/en/reservation/<id>)
// It works out which page it is on and prints what the Post-Trip Review
// feature would need from each. Copy both outputs back to Claude.
//
// What it is after, and why each matters:
//   - how Turo marks a completed trip as "review pending", and any deadline -
//     without that, "Days Remaining" would be an invented number;
//   - where the review page lives (its URL), so "Open Guest Review" is real;
//   - whether the reservation API carries actual check-in/out times and miles
//     driven, which is what "Late return" and "Extra mileage" would be read
//     from rather than guessed;
//   - which notification types Turo emits, since "Rate your guest" reminders
//     may already exist there with a reservation id attached.
//
// Prints structure - key names, value types, data-testids, hrefs, short enum
// values. Guest names appear only where they are part of a card's text.

(async () => {
  const log = (...a) => console.log(...a);
  const head = (t) => log("%c" + t, "font:600 13px system-ui");
  const json = async (url) => {
    try {
      const r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
      const type = r.headers.get("content-type") || "";
      return r.ok && /json/.test(type) ? await r.json() : { __error: r.status + " " + type };
    } catch (e) { return { __error: String(e) }; }
  };
  const shape = (v, d = 0) => {
    if (v === null || v === undefined) return String(v);
    if (Array.isArray(v)) return v.length ? (d >= 3 ? "[…] x" + v.length : "[" + shape(v[0], d + 1) + "] x" + v.length) : "[] empty";
    if (typeof v === "object") { const k = Object.keys(v); return d >= 3 ? "{…" + k.length + "}" : "{ " + k.map((x) => x + ": " + shape(v[x], d + 1)).join(", ") + " }"; }
    return typeof v;
  };
  // Every path whose KEY mentions one of the words, with a scalar value shown.
  const grep = (obj, words, path = "", depth = 0, out = []) => {
    if (!obj || typeof obj !== "object" || depth > 5) return out;
    for (const [k, v] of Object.entries(obj)) {
      const here = path ? path + "." + k : k;
      if (words.test(k)) out.push(here + " = " + (v && typeof v === "object" ? shape(v) : JSON.stringify(v)));
      if (v && typeof v === "object") grep(v, words, here, depth + 1, out);
    }
    return out;
  };
  const REVIEW_WORDS = /review|rating|rate|feedback|deadline|expir|checkin|checkout|check_in|check_out|actual|odometer|mileage|miles|distance|claim|dispute|incident|late|status|complete/i;

  head("HostOS - Post-Trip Review: what Turo exposes");
  log("page:", location.pathname);

  // ---------------------------------------------------------------- History
  if (/history/i.test(location.pathname)) {
    head("History page - card structure");
    const links = [...document.querySelectorAll("a[href*='/reservation/']")];
    log("reservation links on screen:", links.length, "(Turo virtualises - scroll and re-run to see more)");
    const testids = new Set();
    document.querySelectorAll("[data-testid]").forEach((el) => testids.add(el.getAttribute("data-testid")));
    log("data-testids on the page:", [...testids].join(", "));
    links.slice(0, 6).forEach((a, i) => {
      // Walk up to the card: the nearest ancestor that holds this one link only.
      let card = a; while (card.parentElement && card.parentElement.querySelectorAll("a[href*='/reservation/']").length === 1) card = card.parentElement;
      const text = (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 240);
      const ids = [...card.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
      const buttons = [...card.querySelectorAll("a,button")].map((el) => (el.innerText || "").trim()).filter(Boolean);
      log("\ncard " + (i + 1) + ":", a.getAttribute("href"));
      log("   text:", text);
      log("   testids:", ids.join(", ") || "(none)");
      log("   actions:", buttons.join(" | ") || "(none)");
    });
    const reviewy = [...document.querySelectorAll("a,button")]
      .filter((el) => /review|rate|rating/i.test(el.innerText || ""))
      .map((el) => (el.innerText || "").trim() + "  ->  " + (el.getAttribute("href") || "(button)"));
    log("\nanything on this page mentioning review/rate:", reviewy.length ? "\n   " + reviewy.join("\n   ") : "(nothing)");
  }

  // --------------------------------------------------------- Reservation page
  const idMatch = location.pathname.match(/reservation\/(\d+)/);
  if (idMatch) {
    const id = idMatch[1];
    head("Reservation " + id + " - the API");
    const data = await json("/api/reservation/detail?oppTermsAware=true&reservationId=" + id);
    if (data.__error) log("detail failed:", data.__error);
    else {
      log("top-level keys:", Object.keys(data).join(", "));
      const hits = grep(data, REVIEW_WORDS);
      log("\nkeys that could feed the review feature (" + hits.length + "):");
      hits.slice(0, 80).forEach((h) => log("   " + h));
      if (hits.length > 80) log("   … " + (hits.length - 80) + " more");
    }
    head("Reservation " + id + " - the page");
    const heading = [...document.querySelectorAll("h1,h2")].map((h) => (h.innerText || "").trim()).filter(Boolean).slice(0, 4);
    log("headings:", heading.join(" | "));
    const reviewy = [...document.querySelectorAll("a,button")]
      .filter((el) => /review|rate|rating|feedback/i.test(el.innerText || ""))
      .map((el) => (el.innerText || "").trim() + "  ->  " + (el.getAttribute("href") || "(button, testid=" + (el.getAttribute("data-testid") || "none") + ")"));
    log("review-related links/buttons:", reviewy.length ? "\n   " + reviewy.join("\n   ") : "(nothing)");
    const labels = [...document.querySelectorAll(".detailsSection-label")].map((el) => (el.innerText || "").trim());
    log("detail sections:", labels.join(" | "));
    // Candidate review URLs, status codes only.
    for (const url of ["/us/en/reservation/" + id + "/review", "/us/en/reservation/" + id + "/rate", "/us/en/reviews/new?reservationId=" + id]) {
      try { const r = await fetch(url, { credentials: "include" }); log("   " + r.status + "  " + url + (r.redirected ? "  -> " + r.url : "")); } catch (e) { log("   threw  " + url); }
    }
  }

  // ----------------------------------------------------------- Activity feed
  head("Notification feed - event types");
  const feed = await json("/api/feeds/activity?driverRoles=HOST&itemsPerPage=50");
  if (feed.__error) log("feed failed:", feed.__error);
  else {
    const items = feed.activities || [];
    const titles = {};
    items.forEach((it) => { const t = (it.title || "").replace(/^\([^)]*\)\s*-\s*/, ""); titles[t] = (titles[t] || 0) + 1; });
    log("distinct titles in the last " + items.length + " events:");
    Object.entries(titles).forEach(([t, n]) => log("   " + n + "x  " + t));
    const reviewEvents = items.filter((it) => /review|rate|rating/i.test(it.title || "") || /review|rate your/i.test(it.message || ""));
    log("\nreview-related events:", reviewEvents.length);
    reviewEvents.slice(0, 5).forEach((it) => log("   ", { title: it.title, reservationId: it.reservationId, created: new Date(it.created).toISOString(), keys: Object.keys(it).join(",") }));
    if (items[0]) log("\none event's shape:", shape(items[0]));
  }

  log("\nDone. Copy this whole output back to Claude.");
})();
