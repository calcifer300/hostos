window.HostOS = window.HostOS || {};

// Only runs on Turo's Fleet Calendar (turo.com/us/en/trips/calendar). That
// page renders a virtualized grid: every visible day cell is absolutely
// positioned via its own inline left/top pixel offset rather than being
// nested under a per-vehicle row element, so vehicle and day are recovered
// by sorting the distinct left/top offsets actually seen in the DOM rather
// than assuming fixed pixel constants (Turo could resize columns/rows on a
// future redesign without this breaking).
//
// Verified live: 34 day columns at 64px each, 15 vehicle rows rendered at a
// time out of a 40+ vehicle fleet, and day cells carry no date attribute of
// any kind — only their pixel offset. Column 0 is today.
HostOS.fleetScanner = (() => {
  function pxValue(value) {
    const match = String(value || "").match(/(-?\d+(?:\.\d+)?)px/);
    return match ? Number(match[1]) : null;
  }

  function vehicleFromRow(row) {
    // The vehicle name and license plate are the first two <span> elements
    // inside the row's button — read by position, not by Turo's hashed CSS
    // class names, which regenerate on every deploy.
    const spans = row.querySelectorAll("button span");
    return {
      name: spans[0] ? HostOS.parser.text(spans[0]) : null,
      plate: spans[1] ? HostOS.parser.text(spans[1]) : null
    };
  }

  // Every price column is identified only by its horizontal position, so the
  // whole grid is meaningless unless column 0 really is today. The calendar
  // has back/forward controls (and a "Today" button to return), and if the
  // host has paged backwards then column 0 is some past date — storing those
  // prices as though they were today's would file real money figures against
  // the wrong days. Confirmed the header cell reads e.g. "TUE 25", so the
  // leading column's day-of-month is checked against today's before trusting
  // anything on the page.
  function showsToday() {
    const headers = [...document.querySelectorAll("*")].filter(
      (element) => !element.children.length && /^(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.test(HostOS.parser.text(element))
    );
    if (!headers.length) return false;
    const first = headers
      .map((element) => ({ element, left: element.getBoundingClientRect().left }))
      .sort((a, b) => a.left - b.left)[0];
    const dayMatch = HostOS.parser.text(first.element.parentElement).match(/(\d{1,2})\s*$/);
    return Boolean(dayMatch) && Number(dayMatch[1]) === new Date().getDate();
  }

  function scan() {
    if (!/\/trips\/calendar/i.test(location.pathname)) return null;

    const rows = [...document.querySelectorAll(HostOS.selectors.fleetVehicleRow)];
    const cells = [...document.querySelectorAll(HostOS.selectors.fleetDayCell)];
    if (!rows.length || !cells.length) return null;
    if (!showsToday()) return null;

    const lefts = new Set();
    const tops = new Set();
    const cellInfo = cells.map((cell) => {
      const wrapper = cell.parentElement;
      const left = pxValue(wrapper && wrapper.style.left);
      const top = pxValue(wrapper && wrapper.style.top);
      if (left !== null) lefts.add(left);
      if (top !== null) tops.add(top);
      // Each day cell's only visible text is its price (e.g. "$52"); the
      // unavailability-line elements carry no text of their own.
      const priceMatch = HostOS.parser.text(cell).match(/\$([\d,]+)/);
      return {
        left,
        top,
        booked: Boolean(cell.querySelector(HostOS.selectors.fleetReservationMarker)),
        price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0
      };
    });
    const sortedLefts = [...lefts].sort((a, b) => a - b);
    const sortedTops = [...tops].sort((a, b) => a - b);
    if (sortedLefts.length < 2) return null;

    // Vehicle row order in the frozen name column matches the sorted-top
    // order of its day cells (both lay out top-to-bottom in the same
    // sequence), so the i-th smallest top maps to the i-th listed vehicle.
    const vehicles = {};
    sortedTops.forEach((top, index) => {
      const row = rows[index];
      if (!row) return;
      const vehicle = vehicleFromRow(row);
      // Keyed by plate, so a vehicle is never confused with a same-model
      // sibling — this fleet runs six "Nissan Pathfinder 2024"s.
      if (!vehicle.plate) return;
      const rowCells = cellInfo.filter((cell) => cell.top === top);
      const byColumn = sortedLefts.map((left) => rowCells.find((cell) => cell.left === left) || null);
      vehicles[vehicle.plate] = {
        vehicle: vehicle.name || "Vehicle",
        plate: vehicle.plate,
        // Index 0 is today, index 1 tomorrow, and so on across the visible
        // window. Kept as parallel arrays so a trip's own days can be picked
        // out by offset from today without needing a date on each cell.
        prices: byColumn.map((cell) => (cell ? cell.price : 0)),
        bookedDayFlags: byColumn.map((cell) => Boolean(cell && cell.booked)),
        availableToday: !(byColumn[0] && byColumn[0].booked),
        availableTomorrow: !(byColumn[1] && byColumn[1].booked),
        bookedDays: byColumn.filter((cell) => cell && cell.booked).length,
        totalDays: byColumn.filter(Boolean).length,
        scannedAt: new Date().toISOString()
      };
    });
    return Object.keys(vehicles).length ? vehicles : null;
  }

  async function scanAndSave() {
    const vehicles = scan();
    if (!vehicles) return;
    // The calendar grid is virtualized vertically — only about 15 of the
    // fleet's 40+ vehicle rows exist in the DOM at any moment. Replacing the
    // stored set with just those would discard every vehicle not currently
    // scrolled into view, which is the same bug class as the list-scan
    // overwrite fixed in content/scanner.js, and is why the "available"
    // count used to drift between scans. Merge by plate instead so coverage
    // accumulates as the host scrolls.
    const stored = await chrome.storage.local.get("hostosFleetAvailability");
    const previous = (stored.hostosFleetAvailability && stored.hostosFleetAvailability.vehicles) || {};
    // Older builds stored a plain array; start clean rather than trying to
    // key an unkeyed list by guesswork.
    const merged = Array.isArray(previous) ? {} : { ...previous };
    Object.entries(vehicles).forEach(([plate, entry]) => { merged[plate] = entry; });
    await chrome.storage.local.set({
      hostosFleetAvailability: { vehicles: merged, scannedAt: new Date().toISOString() }
    });
    HostOS.logger.info("Fleet availability scanned.", {
      visible: Object.keys(vehicles).length,
      known: Object.keys(merged).length
    });
  }

  return { scanAndSave };
})();
