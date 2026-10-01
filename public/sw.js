/*
 * HostOS service worker.
 *
 * Deliberately minimal: it exists so browsers treat HostOS as installable and
 * so the shell paints instantly when opened from the home screen. Data is
 * never cached — every page is per-workspace and per-person, and a stale
 * board is worse than a spinner. Only immutable build assets and the offline
 * fallback are stored.
 */
const CACHE = "hostos-shell-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sign-in is a redirect chain (Google → /api/auth/callback → /app). A
  // service worker that answers those navigations receives the redirect as
  // opaque and the browser paints Next's "This page couldn't load" instead
  // of the workspace. Let the browser handle auth and the product itself.
  if (
    url.pathname === "/login" ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname === "/app" ||
    url.pathname.startsWith("/app/")
  ) {
    return;
  }

  // Hashed build assets are immutable: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Pages: network, with the offline page as the only fallback.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
