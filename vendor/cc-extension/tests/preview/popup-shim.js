// A stand-in for chrome.* so the real popup.js can render against sample
// storage outside the extension. Reads only; writes are swallowed.
(() => {
  const day = (n, h) => { const d = new Date(); d.setHours(h || 12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString(); };
  const iso = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const base = { protectionCheckedAt: iso(0), guestCheckedAt: iso(0), pricingCheckedAt: iso(0), earningsVersion: 6, extras: [], earningsExtras: 0 };
  const trips = [
    { ...base, reservationId: "61165819", guestName: "Kumar", vehicle: "Mazda CX-50 2024", plate: "DJIL68", pickupDate: day(11, 13), returnDate: day(17, 19),
      protectionLevel: "SUPREME", protectionPlanName: "Premier", guestMaxOutOfPocket: 0, premierProtection: true, earningsRisk: true, earningsBelowFloor: false,
      estimatedEarnings: 239, earningsPerMile: 0.23, includedMiles: 1050, hostTakeRate: 0.7, earningsInputsKnown: true, earningsDelivery: 120, deliveryFeeSource: "turo",
      guestRating: 4.3, guestRatingCount: 9, guestTripCount: 10, guestMemberSince: { month: 2, year: 2018 }, riskReasons: ["Guest bought the Premier plan — $0 out-of-pocket, so damage cannot be billed to them"], tripUrl: "https://turo.com/us/en/reservation/61165819" },
    { ...base, reservationId: "61048407", guestName: "maryann", vehicle: "Mazda CX-50 2024", plate: "EOCX52", pickupDate: day(0, 22), returnDate: day(3), licenseVerified: false,
      protectionLevel: "MINIMUM", protectionPlanName: "Minimum", guestMaxOutOfPocket: 3000, guestRating: 5, guestRatingCount: 1, guestTripCount: 1, estimatedEarnings: 210, tripUrl: "https://turo.com/us/en/reservation/61048407" },
    { ...base, reservationId: "60907051", guestName: "Isaiah", vehicle: "Volkswagen Taos 2024", plate: "ENHF08", pickupDate: day(2, 12), returnDate: day(7, 15),
      earningsRisk: true, earningsBelowFloor: true, premierProtection: false, estimatedEarnings: 158, earningsPerMile: 0.13, includedMiles: 1200, hostTakeRate: 0.7, earningsInputsKnown: true,
      earningsDelivery: 120, deliveryFeeSource: "turo", protectionPlanName: "Standard", guestMaxOutOfPocket: 500, guestRating: null, guestRatingCount: 0, guestTripCount: 0,
      riskReasons: ["Earns only $0.13/mile of the allowance (below $0.20)"], tripUrl: "https://turo.com/us/en/reservation/60907051" },
    { ...base, reservationId: "60616336", guestName: "Karen", vehicle: "Volkswagen Tiguan 2022", plate: "AVVX92", pickupDate: day(-13), returnDate: day(-5), completed: true, completedAt: day(-5),
      postTripCheckedAt: iso(0), milesDriven: 191, milesExcess: 0, driverId: "1", guestSaysRated: { at: iso(0.2), quote: "Left you a 5 star review, thanks!" }, estimatedEarnings: 260, tripUrl: "https://turo.com/us/en/reservation/60616336" },
    { ...base, reservationId: "60410598", guestName: "Mya", vehicle: "Volkswagen Taos 2024", plate: "ENHF01", pickupDate: day(-11), returnDate: day(-4), completed: true, completedAt: day(-4),
      postTripCheckedAt: iso(0), milesDriven: 317, milesExcess: 0, driverId: "2", estimatedEarnings: 240, tripUrl: "https://turo.com/us/en/reservation/60410598" },
    { ...base, reservationId: "60556099", guestName: "Doug", vehicle: "Volkswagen Tiguan 2024", plate: "DJIF67", pickupDate: day(-11), returnDate: day(0, 7), estimatedEarnings: 380, tripUrl: "https://turo.com/us/en/reservation/60556099" },
    { ...base, reservationId: "9", guestName: "Brooke", vehicle: "Nissan Rogue 2024", plate: "ENFP72", pickupDate: day(1), returnDate: day(9), estimatedEarnings: 410 },
    { ...base, reservationId: "10", guestName: "Francis", vehicle: "Tesla Model 3 2022", plate: "EBKP99", pickupDate: day(3), returnDate: day(25), estimatedEarnings: null }
  ];
  const store = {
    hostosTrips: trips, hostosReviews: {}, hostosLastScan: iso(0.0003), hostosPaused: false, hostosScanHealth: null,
    hostosDetailStatus: { completed: 254, eligible: 3, updatedAt: iso(0.0005), lastAttempt: { reservationId: "61048407", result: "success", at: iso(0.001) } },
    hostosFleetAvailability: null
  };
  window.chrome = {
    storage: { local: { get: async (keys) => { const out = {}; (Array.isArray(keys) ? keys : [keys]).forEach((k) => { out[k] = store[k]; }); return out; }, set: async () => {} }, onChanged: { addListener() {} } },
    runtime: { sendMessage: async () => ({ ok: true, tripsFound: 105 }), getURL: (p) => "../../" + p },
    tabs: { create: ({ url }) => window.open(url, "_blank") }
  };
})();
