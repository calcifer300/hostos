// Renders the nightly report HTML with sample trips in every section, so the
// table layout can be looked at without waiting for 9 PM.
//   node tests/preview/report.js   ->  tests/preview/report.html
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const h = require(path.join(ROOT, "tests", "harness.js"));
const HostOS = h.loadModules(["utils/constants.js", "utils/dates.js", "utils/parser.js", "utils/reviews.js", "utils/outlook.js"]);
const sw = fs.readFileSync(path.join(ROOT, "background", "service-worker.js"), "utf8");
const grab = (name) => { const m = sw.match(new RegExp("(?:async )?function " + name + "\\([\\s\\S]*?\\n}")); if (!m) throw new Error("missing " + name); return m[0]; };
const COMPANY = "Colorado Cruisers";
const DIGEST_TIMEZONE = "America/Denver";
const REPORT_AMBER = "#ff9f0a", REPORT_RED = "#ff6b5e", REPORT_WHITE = "#f5f5f7", REPORT_MUTED = "#8e8e93";
const parseTime = (v) => HostOS.dates.parseTime(v);
// One eval per function at this level - inside a forEach the declarations would be scoped to the arrow.
eval(grab("escapeHtml"));
eval(grab("reportMoney"));
eval(grab("reportStrong"));
eval(grab("htmlRow"));
eval(grab("htmlTripCard"));
eval(grab("guestRecord"));
eval(grab("htmlReviewCard"));
eval(grab("htmlTable"));
eval(grab("shortDate"));
eval(grab("tripCell"));
eval(grab("vehicleCell"));
eval(grab("datesCell"));
eval(grab("guestCell"));
eval(grab("planCell"));
eval(grab("earningsCell"));
eval(grab("perMileCell"));
eval(grab("openCell"));
eval(grab("earningsNote"));
eval(grab("riskRows"));
eval(grab("htmlSection"));
eval(grab("reportShell"));
eval(grab("formatTripTime"));
eval(grab("composeDigestHtml"));
const RISK_COLUMNS = JSON.parse(sw.slice(sw.indexOf("const RISK_COLUMNS = ") + 21, sw.indexOf(";", sw.indexOf("const RISK_COLUMNS = "))));

const day = (n, h2) => { const d = new Date(); d.setHours(h2 || 12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString(); };
const trip = (o) => ({ url: "https://turo.com/us/en/reservation/" + o.reservationId, reasons: [], missing: [], extrasChecked: true, extras: 0, delivery: 120, deliverySource: "turo", ...o });
const payload = {
  date: "9/12/2026",
  outlook: { week: { label: "This week", total: 2140, priced: 6, unpriced: 1, trips: 7 }, month: { label: "This month", total: 7910, priced: 24, unpriced: 3, trips: 27 }, ahead: { label: "Booked ahead", total: 12480, priced: 40, unpriced: 6, trips: 46 } },
  rateRisks: [
    trip({ reservationId: "60907051", guest: "Isaiah", vehicle: "Volkswagen Taos 2024", plate: "ENHF08", pickup: day(0, 12), returnDate: day(5, 15), earnings: 158, days: 6, perMile: 0.13, miles: 1200, plan: "Standard", planExcess: 500, guestRating: null, guestRatingCount: 0, guestTripCount: 0, takeRate: 0.7, reasons: ["Earns only $0.13/mile of the allowance (below $0.20)"] }),
    trip({ reservationId: "61004613", guest: "Lisa", vehicle: "Nissan Rogue 2024", plate: "ENFP72", pickup: day(0, 16), returnDate: day(10, 6), earnings: 233, days: 10, perMile: 0.155, miles: 1500, plan: "Standard", planExcess: 500, guestRating: 4.9, guestRatingCount: 3, guestTripCount: 4, takeRate: 0.7, extras: 55, reasons: ["Earns only $0.16/mile of the allowance (below $0.20)"] })
  ],
  unpriced: [trip({ reservationId: "56540984", guest: "Anna", vehicle: "Volkswagen Atlas 2023", plate: "EWPI04", pickup: day(2), returnDate: day(8), earnings: 210, days: 6, perMile: 0.17, miles: 1200, plan: "Minimum", planExcess: 3000, guestRating: 5, guestRatingCount: 2, guestTripCount: 2, takeRate: 0.9, extrasChecked: false, delivery: 120, deliverySource: "standing", missing: ["extras"] })],
  licenseRisks: [trip({ reservationId: "61048407", guest: "maryann", vehicle: "Mazda CX-50 2024", plate: "EOCX52", pickup: day(0, 22), returnDate: day(3), plan: "Minimum", planExcess: 3000, guestRating: 5, guestRatingCount: 1, guestTripCount: 1 })],
  premier: [trip({ reservationId: "61165819", guest: "Kumar", vehicle: "Mazda CX-50 2024", plate: "DJIL68", pickup: day(11, 13), returnDate: day(17, 19), earnings: 239, days: 7, perMile: 0.23, miles: 1050, plan: "Premier", planExcess: 0, guestRating: 4.3, guestRatingCount: 9, guestTripCount: 10, takeRate: 0.7 })],
  reviews: [
    trip({ reservationId: "60616336", guest: "Karen", vehicle: "Volkswagen Tiguan 2022", plate: "AVVX92", pickup: day(-13), returnDate: day(-5), state: "pending", ready: true, guestQuote: "Left you a 5 star review, thanks!", daysLeft: 5, signals: [] }),
    trip({ reservationId: "60571517", guest: "Randeep", vehicle: "Tesla Model Y 2023", plate: "DXZQO1", pickup: day(-12), returnDate: day(-2), state: "pending", ready: false, daysLeft: 8, signals: ["Extra mileage", "Reimbursement open"] })
  ]
};
const html = composeDigestHtml(payload, false);
fs.writeFileSync(path.join(__dirname, "report.html"), html);
console.log("wrote tests/preview/report.html (" + html.length + " bytes)");
