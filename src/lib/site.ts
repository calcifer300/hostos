/**
 * Public identity of this deployment — the one place the canonical URL, the
 * company name and the public contact details are written down. Safe on the
 * client (no secrets).
 */

export const SITE = {
  name: "HostOS",
  company: "HostOS Collective",
  tagline: "Focus on what matters most. We’ll handle your operations.",
  description: "Full-stack development, AI automation, virtual assistant support, and customer service solutions for growing businesses — all run on HostOS.",
  /** Public contact channels, as published on the company's site. */
  contactEmail: "hello@hostoscollective.com",
  phone: "+63 991 474 5117",
  whatsapp: "https://wa.me/639914745117",
  whatsappConsultation: "https://wa.me/639914745117?text=Hi%20HostOS%20Collective!%20I%27d%20like%20to%20book%20a%20free%20consultation.",
} as const;

/**
 * The URL people reach this deployment at. Vercel injects VERCEL_URL for
 * previews; NEXT_PUBLIC_APP_URL wins when set so the production alias is
 * used for OG tags and the Companion's default, not a per-deploy hostname.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** The company's own domain, once DNS moved there (2026-09-15). */
export const PRIMARY_DOMAIN = "hostoscollective.com";
