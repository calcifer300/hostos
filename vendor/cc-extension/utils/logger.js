window.HostOS = window.HostOS || {};

HostOS.logger = {
  info(message, detail) {
    console.info("[HostOS] " + message, detail || "");
  },
  warn(message, detail) {
    console.warn("[HostOS] " + message, detail || "");
  }
};
