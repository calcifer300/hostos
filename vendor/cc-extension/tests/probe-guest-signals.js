// Paste into the DevTools console on ANY turo.com tab while signed in.
//
// Answers one question: which of the risk signals Matt asked for does Turo
// actually hand a host, and under what field name. Everything downstream —
// smoking history, repeat cancellations, late returns, bad behaviour — depends
// on that answer, and guessing it wrong is how a card ends up asserting a
// figure nobody read. See "Never ASSERT a figure built on an unread input" in
// PROJECT_STATUS.md.
//
// Prints the SHAPE of each response: key names and value types, never the
// values. No guest's name, rating or review text is printed, and nothing
// leaves the browser — this is a read-only look at what fields exist.

(async () => {
  // Any reservation with a guest on it. Defaults to the id in the address bar
  // when run from a trip page.
  const RESERVATION_ID = (location.pathname.match(/reservation[/=](\d+)/) || [])[1] || "61077775";

  const get = async (url) => {
    try {
      const response = await fetch(url, {
        credentials: "include", headers: { Accept: "application/json" }
      });
      const type = response.headers.get("content-type") || "";
      // An unauthenticated request returns Turo's login HTML, not JSON. Worth
      // distinguishing from a genuine 404 — one means "sign in", the other
      // means "no such endpoint".
      const isJson = /json/.test(type);
      return {
        status: response.status,
        json: isJson && response.ok ? await response.json() : null,
        note: isJson ? "" : " (not JSON — probably the login page or a 404 shell)"
      };
    } catch (error) {
      return { status: "threw", json: null, note: " " + error };
    }
  };

  const shape = (value, depth = 0) => {
    if (value === null || value === undefined) return String(value);
    if (Array.isArray(value)) {
      if (!value.length) return "[] empty";
      return depth >= 3 ? "[…] x" + value.length
        : "[" + shape(value[0], depth + 1) + "] x" + value.length;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (depth >= 3) return "{…" + keys.length + " keys}";
      return "{ " + keys.map((k) => k + ": " + shape(value[k], depth + 1)).join(", ") + " }";
    }
    return typeof value;
  };

  console.log("%cHostOS — what does Turo expose about a guest?", "font:600 14px system-ui");
  console.log("reservation", RESERVATION_ID);

  const detail = await get("/api/reservation/detail?oppTermsAware=true&reservationId=" + RESERVATION_ID);
  if (!detail.json) {
    console.warn("reservation detail failed:", detail.status + detail.note,
      "\nOpen a Turo tab you are signed into and try again.");
    return;
  }

  const driverId = detail.json.renter && detail.json.renter.id;
  console.log("\n--- reservation detail: top-level keys ---");
  console.log(Object.keys(detail.json).join(", "));
  console.log("\n--- renter block (this is all the reservation knows about them) ---");
  console.log(shape(detail.json.renter));

  if (!driverId) { console.warn("no renter.id on this reservation"); return; }

  const driver = await get("/api/v2/driver/detail?driverId=" + driverId);
  if (!driver.json) {
    console.warn("driver detail failed:", driver.status + driver.note);
    return;
  }
  console.log("\n--- driver detail: FULL shape ---");
  console.log("(the extension currently reads only ratingsFromCarOwners.overall,");
  console.log(" numberOfRatingsFromCarOwners, numberOfRentalsFromCarOwners, memberSince)");
  console.log(shape(driver.json));

  // The signals Matt named. Anything that turns up here is buildable; anything
  // that doesn't, isn't — not from this endpoint.
  const wanted = ["review", "smok", "cancel", "late", "flag", "badge", "report",
                  "violation", "incident", "damage", "strike", "history", "comment"];
  const hay = JSON.stringify(driver.json).toLowerCase();
  console.log("\n--- keyword scan for the signals Matt asked about ---");
  wanted.forEach((word) => {
    const hit = hay.includes(word);
    console.log((hit ? "  FOUND    " : "  absent   ") + word);
  });

  // Reviews are the only plausible home for "history of smoking" — Matt reads
  // them by hand today. If they are not on this payload they may be their own
  // endpoint, so these are worth a status code each.
  console.log("\n--- candidate review endpoints (status codes only) ---");
  for (const url of [
    "/api/v2/driver/" + driverId + "/reviews",
    "/api/v2/driver/reviews?driverId=" + driverId,
    "/api/driver/" + driverId + "/reviews",
    "/api/v2/reviews?driverId=" + driverId
  ]) {
    const probe = await get(url);
    console.log("  " + probe.status + probe.note + "  " + url);
    if (probe.json) console.log("      shape:", shape(probe.json));
  }

  console.log("\nDone. Copy this whole output back to Claude.");
})();
