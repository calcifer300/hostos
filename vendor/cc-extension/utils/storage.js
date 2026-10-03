window.HostOS = window.HostOS || {};

HostOS.storage = {
  async getTrips() {
    try {
      const result = await chrome.storage.local.get(HostOS.constants.STORAGE_KEY);
      return Array.isArray(result[HostOS.constants.STORAGE_KEY]) ? result[HostOS.constants.STORAGE_KEY] : [];
    } catch (error) {
      HostOS.logger.warn("Could not read trips from storage.", error);
      return [];
    }
  },
  // options.silent writes the trips without touching the last-scan stamp.
  // The footer's "scanned Xs ago" is how the host judges whether the page
  // scan is alive, so background writers that aren't page scans — the
  // protection sweep and the activity feed — must not refresh it, or it
  // would read as healthy while the list scan had actually stalled.
  async saveTrips(trips, options = {}) {
    try {
      const payload = { [HostOS.constants.STORAGE_KEY]: trips };
      if (!options.silent) {
        payload[HostOS.constants.LAST_SCAN_KEY] = new Date().toISOString();
        payload[HostOS.constants.LAST_SCAN_COUNT_KEY] = trips.length;
      }
      await chrome.storage.local.set(payload);
    } catch (error) {
      HostOS.logger.warn("Could not save trips to storage.", error);
    }
  },
  async getLastScan() {
    const result = await chrome.storage.local.get(HostOS.constants.LAST_SCAN_KEY);
    return result[HostOS.constants.LAST_SCAN_KEY] || null;
  }
};
