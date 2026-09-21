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

## Cutover — one command each way

The site proxies every app path to the app's own alias (hostos-ten.vercel.app) — see `vercel.json` —
so the app keeps its domain, cookies and OAuth callbacks untouched. Moving the domain is a Vercel
setting, not a DNS change (Cloudflare already points at Vercel):

    # from the repo root
    npx vercel domains add hostoscollective.com hostos-site --yes
    npx vercel domains add www.hostoscollective.com hostos-site --yes

Rollback, same shape:

    npx vercel domains add hostoscollective.com hostos --yes
    npx vercel domains add www.hostoscollective.com hostos --yes

Verify after either: `curl -I https://hostoscollective.com/` (X-Vercel-Cache from the site),
`/login`, `/api/auth/session`, `/team`, `/app/start` (307 to /login), and a Google sign-in.

Longer term, the subdomain split (app.hostoscollective.com for the product) removes the proxy hop;
it needs the Google OAuth redirect URIs and AUTH_URL changed first.
