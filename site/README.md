# hostoscollective.com — the marketing site (SvelteKit)

The public front door of HostOS Collective: SvelteKit 2 · Svelte 5 (runes) ·
TypeScript · Tailwind v4 · adapter-vercel. Prerendered; ~110 KB of JS; no
runtime dependencies beyond Svelte and lucide icons. Its own Vercel project
(`hostos-site`); the product stays on the Next.js app in the repo root.

    npm install
    npm run dev          # http://localhost:5173
    npm run check        # svelte-check
    npm run build
    bash lh.sh           # build + Lighthouse (mobile, simulated) via Brave headless

## Where things are

    src/app.css                       design tokens (@theme), base, motion utilities
    src/lib/components/ui/            Logo · Button · Section (the section grammar) · Accordion
    src/lib/components/marketing/     Nav (session-aware) · Footer · the landing sections
    src/lib/components/motion/        actions: reveal · stagger · tilt · countUp
    src/lib/content/site.ts           every word on the page, typed
    src/lib/content/team.ts           roster fallback + normaliser
    src/lib/seo/jsonld.ts             Organization + Person + FAQPage
    src/routes/+page.ts               fetches the roster from the app at build (falls back)
    src/routes/{robots.txt,sitemap.xml}

## Rules of the house

- One accent colour means "act". Violet means "the platform". Nothing else on chrome is saturated.
- Label → statement → lede → content, in every section (`Section.svelte`).
- Arrive once, respond always, never idle (the live board's 9-second loop is the one exception).
- Above the fold nothing waits for JavaScript (`.arrive`); without JS everything is visible (`.no-js`).
- Contrast is checked per token; hue-coloured text is lightened with `color-mix` on dark surfaces.

## Cutover (when the Founder says so)

The app stays at the same domain. Two options, both reversible in one Vercel setting:

1. Subdomain split (recommended long-term): `hostoscollective.com` → this site,
   `app.hostoscollective.com` → the Next.js app. Needs `AUTH_URL` / cookie domain on the
   app, Google OAuth redirect URIs updated by the Founder, and redirects from
   `/app/*`, `/login`, `/api/*` on the site to the app host.
2. Same domain, proxied: attach the domain to this project and add rewrites in
   `vercel.json` for `/app/:path*`, `/login`, `/api/:path*`, `/_next/:path*`,
   `/team`, `/install`, `/about` to the app's deployment URL. No auth changes;
   the session-aware nav works immediately. One extra hop per app request.
