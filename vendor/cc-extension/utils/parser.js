window.HostOS = window.HostOS || {};

HostOS.parser = {
  // The reservation API's own statement that a booking is cancelled.
  //
  // Confirmed live on 2026-09-10 against reservation 61109808 (cancelled by
  // Matt on 9/8): the payload carries a top-level `statusCode`, which reads
  // "CANCELLED" there and "COMPLETED" on every finished trip checked, with
  // `cancelledRequest` populated only on the cancelled one. Pinned to that
  // field on purpose - an earlier version walked the whole payload for any
  // CANCELLED-shaped value, and a wrong match here is a Premier alert that
  // never sends, which is the one failure this project exists to prevent.
  // Returns "statusCode=<value>" so the card can say where it learned this,
  // or null when the payload says nothing either way.
  cancellationSignal(data) {
    const status = data && typeof data.statusCode === "string" ? data.statusCode : null;
    return status && /^CANCEL+ED(?:_[A-Z_]+)?$/.test(status) ? "statusCode=" + status : null;
  },

  // The host's earnings plan for THIS reservation, from
  // vehicleProtectionLevelDetail.key - "NINETYPLAN_US_2026", "SEVENTYPLAN_US_2026".
  // Read live 2026-09-12: Isaiah, Lisa, Anna and Mya were booked under the
  // 90 plan; the fleet has since moved to the 70 plan, and the vehicle's
  // CURRENT plan is what the extension had been charging every trip. Pricing
  // a 90-plan trip at 70 understates it by a fifth, which is what put Isaiah
  // ($0.22/mile) and Lisa ($0.25/mile) in the report as below $0.20.
  // Returns the host's share as a fraction, or null when the key is not one
  // of Turo's plan names - never a guess.
  planTakeRate(data) {
    const key = data && data.vehicleProtectionLevelDetail && data.vehicleProtectionLevelDetail.key;
    const match = typeof key === "string" && key.match(/^(SIXTY|SEVENTYFIVE|SEVENTY|EIGHTYFIVE|EIGHTY|NINETY)PLAN/);
    if (!match) return null;
    return { SIXTY: 0.6, SEVENTY: 0.7, SEVENTYFIVE: 0.75, EIGHTY: 0.8, EIGHTYFIVE: 0.85, NINETY: 0.9 }[match[1]];
  },

  // Turo's status enum for the same field, kept next to the reader that uses
  // it. "COMPLETED" is what the review feature will key on.
  reservationStatus(data) {
    return data && typeof data.statusCode === "string" ? data.statusCode : null;
  },

  text(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
  },
  toDate(dateText, timeText) {
    const candidate = [dateText, timeText].filter(Boolean).join(" ");
    const parsed = new Date(candidate);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  },
  todayAt(timeText) {
    return this.dateAt(new Date(), timeText);
  },
  dateAt(baseDate, timeText) {
    const match = String(timeText || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    const date = new Date(baseDate);
    if (!Number.isFinite(date.getTime())) return null;
    let hours = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hours += 12;
    date.setHours(hours, Number(match[2]), 0, 0);
    return date.toISOString();
  },
  // Number(null) is 0 and Number("") is 0 — both finite, so a plain
  // Number.isFinite check treats "never scanned" as a real zero. That made a
  // trip with no pricePerMile yet read as "$0.00/mile", which is below the
  // $0.20 threshold, so every unscanned trip was flagged as a profit risk.
  // Returns null for anything that isn't a genuine number.
  number(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  reservationId(value) {
    const match = String(value || "").match(/(?:reservation|trip)[\s#:]*([A-Z0-9-]{5,})/i);
    return match ? match[1] : null;
  }
};
