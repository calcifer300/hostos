window.HostOS = window.HostOS || {};

// This module consumes normalized trip data only. It never reads the Turo DOM.
HostOS.licenseMonitor = {
  evaluate(trip) {
    const dueSoon = HostOS.dates.isWithinLicenseUploadWindow(trip.pickupDate);
    return {
      requiresAttention: trip.licenseVerified === false && dueSoon,
      severity: dueSoon ? "critical" : "high"
    };
  }
};
