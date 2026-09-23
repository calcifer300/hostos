/**
 * The landing page's intro: four full-screen "systems" a visitor scrolls
 * through before the classic landing page — one per line of business we
 * want a new client to picture themselves in. Text on one side, a large
 * photograph on the other, moving in opposite directions, with a HUD of
 * telemetry around them. Inspired by a hyper-GT product page; ours reads
 * as an operations console.
 *
 * The Founder edits every word and every photo (Settings → Website); this
 * file is the default that shows until then, and the "restore" copy after.
 * `enabled: false` puts the landing page back exactly as it was.
 *
 * Client-safe: no imports.
 */

export type IntroLayout = "hero" | "blueprint" | "stack" | "readout";

export interface IntroStat { label: string; value: string; unit: string }
export interface IntroItem { code: string; title: string; body: string; figure: string; unit: string; tags: string[] }
export interface IntroPanel {
  id: string;
  /** Which interaction the text side carries: the opener with stats and the clock, an accordion whose lines move the marker, a 3D stack of cards, or channel tabs with a big readout. */
  layout: IntroLayout;
  eyebrow: string;
  /** Two parts of one headline: "FIELD //" and "DISPATCH" — the second in the accent colour. */
  title: string;
  accent: string;
  body: string;
  /** The photograph: a path on this site, an upload in our bucket, or an Unsplash link. Landscape, the bigger the better — it fills half the screen. */
  image: string;
  imageAlt: string;
  /** Under the photograph, HUD-style: "AUTO GLASS // SAME DAY". */
  caption: string;
  /** The readout by the crosshair on the photograph (the accordion overrides it with the open line's figure). */
  marker: string;
  /** Where the crosshair sits, in percent of the photograph. */
  markerX: number;
  markerY: number;
  stats: IntroStat[];
  items: IntroItem[];
}
export interface LandingIntro {
  enabled: boolean;
  /** The small line top-left, next to the mark. */
  brand: string;
  hint: string;
  ctaLabel: string;
  ctaHref: string;
  panels: IntroPanel[];
}

export const INTRO_KEY = "landing_intro";

/** Photographs to start with: Unsplash, free to use, replaced by the Founder's own from the editor. */
const PHOTOS = {
  fleet: "https://images.unsplash.com/photo-1630165356623-266076eaceb6?auto=format&fit=crop&w=2400&q=80",
  restaurant: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2400&q=80",
  glass: "https://images.unsplash.com/photo-1738769527012-375706b0d36c?auto=format&fit=crop&w=2400&q=80",
  web: "https://images.unsplash.com/photo-1726746209354-74141c19959f?auto=format&fit=crop&w=2400&q=80",
};

export const DEFAULT_INTRO: LandingIntro = {
  enabled: true,
  brand: "COLLECTIVE //",
  hint: "SCROLL TO EXPLORE",
  ctaLabel: "Book a Free Strategy Call",
  ctaHref: "/#contact",
  panels: [
    {
      id: "fleet",
      layout: "hero",
      eyebrow: "HOSTOS COLLECTIVE // 01 · CAR RENTAL FLEETS",
      title: "FLEET //",
      accent: "COMMAND",
      body: "Every car, booking and turnaround on one board. A trained team prices the calendar, answers guests, files damage claims and keeps the keys moving — inside HostOS, around the clock.",
      image: PHOTOS.fleet,
      imageAlt: "A row of cars lined up in a lot, ready to go out",
      caption: "FLEET // EVERY CAR ON ONE BOARD",
      marker: "CAR 07 // KEYS OUT 09:40",
      markerX: 58,
      markerY: 44,
      stats: [
        { label: "Coverage", value: "24/7", unit: "" },
        { label: "Verticals", value: "8", unit: "LIVE" },
        { label: "Workspace", value: "1", unit: "LOGIN" },
      ],
      items: [],
    },
    {
      id: "restaurants",
      layout: "blueprint",
      eyebrow: "SYSTEM 02 // RESTAURANTS",
      title: "KITCHEN //",
      accent: "FLOW",
      body: "Open a line to see what the team runs for a restaurant. The marker on the photograph moves to where it happens.",
      image: PHOTOS.restaurant,
      imageAlt: "A restaurant dining room set for service",
      caption: "RESTAURANTS // THE PASS AT 7 PM",
      marker: "ORDERS // 0 MISSED",
      markerX: 40,
      markerY: 38,
      stats: [],
      items: [
        { code: "A-01", title: "ORDERS & TABLETS", body: "DoorDash, Uber Eats and Grubhub tablets watched live — missed orders caught, prep times tuned, the store never accidentally paused.", figure: "0", unit: "MISSED", tags: ["DOORDASH", "UBER EATS", "GRUBHUB"] },
        { code: "A-02", title: "MENU & 86'D ITEMS", body: "Sold-out items pulled the minute the kitchen calls it; photos and prices kept identical across every app.", figure: "3", unit: "APPS IN SYNC", tags: ["MENU SYNC", "PHOTOS", "PRICING"] },
        { code: "A-03", title: "REVIEWS & REFUNDS", body: "Every review answered in the owner's voice; refund disputes filed with evidence before the deadline.", figure: "100%", unit: "ANSWERED", tags: ["REVIEWS", "DISPUTES", "RATINGS"] },
      ],
    },
    {
      id: "services",
      layout: "stack",
      eyebrow: "SYSTEM 03 // FIELD SERVICE",
      title: "FIELD //",
      accent: "DISPATCH",
      body: "Auto glass, mobile mechanics, detailing, cleaning, pest control — 29 trades run on one schedule. Turn the stack to see the modules a windshield job passes through.",
      image: PHOTOS.glass,
      imageAlt: "A cracked windshield waiting for replacement",
      caption: "AUTO GLASS // WINDSHIELD, MOBILE, SAME DAY",
      marker: "JOB 1042 // ON SITE",
      markerX: 62,
      markerY: 50,
      stats: [],
      items: [
        { code: "MOD 01 // INTAKE", title: "LEAD TO ESTIMATE", body: "A call becomes a customer, a property and a priced estimate in one screen.", figure: "1", unit: "SCREEN", tags: [] },
        { code: "MOD 02 // DISPATCH", title: "DISPATCH BOARD", body: "Drag a job to a tech; the schedule, the map and the customer's text update together.", figure: "29", unit: "TRADES", tags: [] },
        { code: "MOD 03 // ON SITE", title: "WORK ORDER", body: "Checklist, photos before and after, materials and a signature — from the tech's phone.", figure: "4", unit: "STEPS", tags: [] },
        { code: "MOD 04 // AFTER", title: "BUTLER FOLLOW-UP", body: "Quiet estimates chased, reviews requested, recurring visits booked — without anyone having to remember.", figure: "24/7", unit: "BUTLER", tags: [] },
      ],
    },
    {
      id: "web",
      layout: "readout",
      eyebrow: "SYSTEM 04 // WEBSITES & DOMAINS",
      title: "WEB //",
      accent: "STUDIO",
      body: "A coffee shop or a barbershop gets a site, a domain and a search presence — built by the same team that answers their phone. Pick a channel.",
      image: PHOTOS.web,
      imageAlt: "A barber at a laptop, building the shop's website",
      caption: "WEBSITES // A BARBERSHOP GOES LIVE",
      marker: "SITE // LIVE",
      markerX: 55,
      markerY: 42,
      stats: [],
      items: [
        { code: "DESIGN", title: "DESIGN", body: "No templates. Designed and built in-house on the stack HostOS itself runs on — fast, mobile-first, yours.", figure: "0", unit: "TEMPLATES", tags: ["MOBILE-FIRST", "BOOKINGS", "MENUS"] },
        { code: "DOMAINS", title: "DOMAINS", body: "Your domain in your name, at the registrar you choose — Cloudflare, Porkbun, Namecheap — never held hostage.", figure: "1", unit: "OWNER: YOU", tags: ["DNS", "EMAIL", "SSL"] },
        { code: "SEARCH", title: "SEARCH", body: "Google Business, reviews and rankings watched by the same people who run your inbox.", figure: "24/7", unit: "WATCHED", tags: ["GOOGLE BUSINESS", "REVIEWS", "RANKINGS"] },
      ],
    },
  ],
};

const str = (v: unknown, fallback: string, max = 400): string => (typeof v === "string" ? v.slice(0, max) : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback);
const LAYOUTS: IntroLayout[] = ["hero", "blueprint", "stack", "readout"];

/** Whatever was stored, made whole against the defaults — a missing field never breaks the page. */
export function normalizeIntro(raw: unknown): LandingIntro {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const panelsRaw = Array.isArray(r.panels) ? r.panels : [];
  const panels: IntroPanel[] = DEFAULT_INTRO.panels.map((d, i) => {
    const p = (panelsRaw[i] && typeof panelsRaw[i] === "object" ? panelsRaw[i] : {}) as Record<string, unknown>;
    const items = Array.isArray(p.items)
      ? p.items.slice(0, 4).map((it, j) => {
          const x = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const dflt = d.items[j] ?? { code: "", title: "", body: "", figure: "", unit: "", tags: [] };
          return { code: str(x.code, dflt.code, 40), title: str(x.title, dflt.title, 60), body: str(x.body, dflt.body, 300), figure: str(x.figure, dflt.figure, 12), unit: str(x.unit, dflt.unit, 30), tags: Array.isArray(x.tags) ? x.tags.filter((t): t is string => typeof t === "string").slice(0, 4).map((t) => t.slice(0, 24)) : dflt.tags };
        })
      : d.items;
    const stats = Array.isArray(p.stats)
      ? p.stats.slice(0, 3).map((st, j) => {
          const x = (st && typeof st === "object" ? st : {}) as Record<string, unknown>;
          const dflt = d.stats[j] ?? { label: "", value: "", unit: "" };
          return { label: str(x.label, dflt.label, 24), value: str(x.value, dflt.value, 12), unit: str(x.unit, dflt.unit, 16) };
        })
      : d.stats;
    const layout = LAYOUTS.includes(p.layout as IntroLayout) ? (p.layout as IntroLayout) : d.layout;
    return {
      id: d.id,
      layout,
      eyebrow: str(p.eyebrow, d.eyebrow, 80),
      title: str(p.title, d.title, 40),
      accent: str(p.accent, d.accent, 40),
      body: str(p.body, d.body, 400),
      image: str(p.image, d.image, 600),
      imageAlt: str(p.imageAlt, d.imageAlt, 120),
      caption: str(p.caption, d.caption, 80),
      marker: str(p.marker, d.marker, 60),
      markerX: num(p.markerX, d.markerX),
      markerY: num(p.markerY, d.markerY),
      stats,
      items,
    };
  });
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_INTRO.enabled,
    brand: str(r.brand, DEFAULT_INTRO.brand, 40),
    hint: str(r.hint, DEFAULT_INTRO.hint, 40),
    ctaLabel: str(r.ctaLabel, DEFAULT_INTRO.ctaLabel, 40),
    ctaHref: str(r.ctaHref, DEFAULT_INTRO.ctaHref, 200),
    panels,
  };
}

/** The image may be a path on this site, a public object in our storage, or an Unsplash photo — nothing else is fetched by next/image. */
export const isIntroImageSrc = (url: string): boolean => url.startsWith("/") || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url) || /^https:\/\/images\.unsplash\.com\//i.test(url);
