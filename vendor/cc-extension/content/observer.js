window.HostOS = window.HostOS || {};

HostOS.observer = (() => {
  let timeoutId;
  let lastUrl = location.href;

  function scheduleScan() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      HostOS.scanner.scan();
      // No-ops immediately on any page that isn't the fleet calendar.
      HostOS.fleetScanner?.scanAndSave();
    }, HostOS.constants.SCAN_DEBOUNCE_MS);
  }

  function start() {
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) lastUrl = location.href;
      scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(scheduleScan, HostOS.constants.FALLBACK_SCAN_MS);
  }

  return { start };
})();
