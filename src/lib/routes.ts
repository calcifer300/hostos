/**
 * Every in-app URL, in one place.
 *
 * The product lives under `/app` so the root can be the public landing page.
 * Nothing outside this file may spell an app path by hand: a string literal
 * like "/operations" was correct for a year and became a 404 the day the
 * prefix landed. Routes are functions where they take a parameter so the
 * encoding happens exactly once.
 *
 * Safe for client and server bundles — no imports, no side effects.
 */

export const APP_BASE = "/app";

function app(path = ""): string {
  return path ? `${APP_BASE}/${path.replace(/^\/+/, "")}` : APP_BASE;
}

export const routes = {
  // Public
  home: "/",
  login: "/login",
  companionDownload: "/hostos-companion.zip",

  // Product shell
  app: app(),
  overview: app(),
  operations: app("operations"),
  board: app("board"),
  messages: app("messages"),
  message: (tripId: string) => app(`messages/${encodeURIComponent(tripId)}`),
  inbox: app("inbox"),
  // Fleet operations (Turo) — its own dashboard, then the detail pages.
  fleet: app("fleet"),
  vehicles: app("fleet/vehicles"),
  vehicle: (name: string) => app(`fleet/vehicles/${encodeURIComponent(name)}`),
  reservations: app("reservations"),
  risk: app("risk"),
  butler: app("butler"),
  tasks: app("tasks"),
  insights: app("insights"),
  library: app("library"),
  knowledge: app("knowledge"),
  notifications: app("notifications"),
  connectors: app("connectors"),
  settings: app("settings"),
  automations: app("automations"),

  // Restaurant operations (DoorDash) — its own dashboard, then the detail pages.
  restaurants: app("restaurants"),
  restaurant: (id: string) => app(`restaurants/${encodeURIComponent(id)}`),
  restaurantTab: (id: string, tab: string) => app(`restaurants/${encodeURIComponent(id)}?tab=${encodeURIComponent(tab)}`),
  upcGenerator: app("restaurants/tools/upc"),

  // Commerce operations (Shopify) — its own dashboard, then the detail pages.
  commerce: app("commerce"),
  store: (id: string) => app(`commerce/${encodeURIComponent(id)}`),
  storeTab: (id: string, tab: string) => app(`commerce/${encodeURIComponent(id)}?tab=${encodeURIComponent(tab)}`),

  // Shared
  team: app("settings/team"),
  install: "/install",
} as const;

/** Legacy top-level product paths that predate the /app prefix. */
export const LEGACY_APP_PATHS = [
  "operations", "board", "messages", "inbox", "fleet", "reservations", "risk", "butler",
  "insights", "library", "knowledge", "notifications", "connectors", "settings", "automations",
] as const;

/**
 * Where to send someone after they sign in. Only a path inside the product is
 * honoured — a callbackUrl is user-controlled input, and an absolute URL here
 * would turn the login page into an open redirect.
 */
export function safeAppRedirect(candidate: string | null | undefined): string {
  if (!candidate) return routes.app;
  if (!candidate.startsWith(`${APP_BASE}/`) && candidate !== APP_BASE) return routes.app;
  if (candidate.startsWith("//")) return routes.app;
  return candidate;
}
