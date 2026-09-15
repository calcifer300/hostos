# HostOS

**The operations platform by [HostOS Collective](https://hostoscollective.com).**
One workspace for any business, with a dashboard per line of business — Turo
fleets, DoorDash restaurants, Shopify stores today; more as modules tomorrow —
plus the teams, tasks, notifications, automation and AI Butler they share.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Framer Motion · Supabase (Postgres) · one Chrome extension (the **HostOS Companion**) · installable PWA.

Production: **https://hostoscollective.com** (branch `unified`; hostos-ten.vercel.app still serves the same deployment).

---

## What it is

| | |
|---|---|
| **Public site** | `/` — HostOS Collective: business solutions (virtual assistants & support, automation & custom systems, websites, apps, SEO) and the HostOS platform. `/team`, `/about`, `/install`. |
| **Product** | `/app/*` — gated by session. Home + one dashboard per enabled module + shared pages (tasks, notifications, Butler, insights, settings). |
| **Verticals** | `fleet` (Turo), `restaurants` (DoorDash), `commerce` (Shopify), `web` (GoDaddy), `cafe` (Coffee Shops), `salon` (Barbershops), `custom` (Build a custom). Chosen on `/app/start` after sign-in — the shell focuses on one at a time — and switched on per workspace (`hosts.modules`). |
| **Companion** | `extension/` — MV3 Chrome extension that recognises turo.com, the DoorDash Merchant Portal and the Shopify admin, injects tools and syncs with a per-workspace pairing key. Packaged to `public/hostos-companion.zip` on build. |
| **AI Butler** | One orchestrator (`src/lib/butler`) over Gemini: drafts, briefings, task generation, policy answers — grounded in the workspace knowledge base, reply templates and Turo's policy library. Never sends anything itself. |
| **Roles** | Workspace: owner / admin / manager / member / viewer (`src/lib/roles/permissions.ts`). Platform: Founder, CTO, Tech Lead, Lead Developer, Developer, Operations Manager, Support, Fleet Owner, Virtual Assistant, Co-Host / VA (`src/lib/roles/constants.ts`) — always Title Case; legacy spellings normalise on read. |
| **PWA** | Installs on iPhone, iPad, Android and desktop from the browser — no app store. Guide at `/install` and in Settings → Install. |

## Run it locally

```bash
npm install
cp .env.local.example .env.local   # fill in the values it documents
npm run dev                         # http://localhost:3000
```

```bash
npm test              # pure-function tests (no framework) — tests/*.test.mts
npx tsc --noEmit      # types
npm run lint          # eslint
npm run build         # packages the extension, then `next build`
```

`npm run build` writes `public/hostos-companion.zip` from `extension/` first, so
the download a deployment serves always matches the extension source in that
commit.

### Environment

See [`.env.local.example`](.env.local.example) — every variable is documented
there. Only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
required; the rest switch features on. Startup prints what is missing and what
each absence disables (`src/lib/env.ts`).

New since the unification: `NEXT_PUBLIC_APP_URL` (canonical URL),
`HOSTOS_ENCRYPTION_KEY` (integration secrets at rest), `MAIL_FROM_EMAIL`,
`CRON_SECRET` (now guards three cron routes).

### Database

Migrations live in `supabase/migrations/` and are **additive and idempotent** —
re-running is safe. Apply them in order in the Supabase SQL editor.

Migrations **0017–0025** (platform repairs, restaurants, workspace layer,
templates, marketing, integrations, commerce, roles, the four new verticals)
are bundled for one paste, and **0026** (per-member verticals, quick notes,
workspace names) on its own:

```bash
node scripts/bundle-migrations.mjs 0017 0025   # → supabase/bundles/0017-0025.sql
node scripts/bundle-migrations.mjs 0026 0026   # → supabase/bundles/0026-0026.sql
```

Code deployed ahead of a migration degrades quietly (missing tables and columns
read as empty, and the affected pages say so) rather than erroring.

## How it fits together

```
 HostOS Companion (Chrome)                Shopify Admin API        Gmail (optional)
   turo.com · DoorDash Merchant Portal       hourly + on demand        OAuth, opt-in
   · Shopify admin                                 │                        │
        │  Bearer <pairing key>                     │                        │
        ▼                                          ▼                        ▼
  /api/turo/* · /api/companion/*          lib/commerce/sync          NextAuth session
        └──────────────────────┬───────────────────┴────────────────────────┘
                               ▼
                    Supabase (Postgres) — every table host_id-keyed, RLS on, service-role only
                               │
                               ▼
          Next.js App Router — /app/* behind middleware, / public
          lib/*/queries.ts (never throw) · lib/actions/* ({ok, error}) · lib/butler
                               │
                               ▼
     /app/start chooser → Home · Fleet · Restaurants · Commerce · Web · Café · Barbershop · Custom
     tasks · notifications · activity · Butler · insights · settings (shared)
```

Full walkthrough, module map and conventions: [ARCHITECTURE.md](ARCHITECTURE.md).
Where things stand and what's next: [PROJECT_STATUS.md](PROJECT_STATUS.md),
[NEXT_TASKS.md](NEXT_TASKS.md), [TECH_DEBT.md](TECH_DEBT.md), [CHANGELOG.md](CHANGELOG.md).
The audit that produced this layout: [docs/AUDIT.md](docs/AUDIT.md).

## Installing HostOS as an app (no App Store / Play Store)

HostOS is a Progressive Web App. Open **https://hostoscollective.com** in the
device's browser and:

- **iPhone / iPad (Safari):** tap **Share** → **Add to Home Screen** → **Add**.
  HostOS opens full-screen from the home screen like any app.
- **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home
  screen**) → **Install**. Chrome may also show an install banner.
- **Desktop (Chrome / Edge):** click the **install icon** in the address bar →
  **Install**.

The in-app guide (`/install`, and Settings → Install) detects the platform and
shows only the relevant steps. Offline, the service worker serves `/offline`.

## Repository layout

```
src/app/(marketing)/   public site: /, /team, /about, /install
src/app/app/           the product (/app/*): page per route, layout = shell, template = page transition
src/app/api/           auth · companion · turo (Companion ingest) · butler · cron
src/components/        ui (primitives) · shell · dashboard · marketing · fleet/restaurants/commerce · butler · settings · motion · pwa
src/lib/               one folder per domain; queries.ts (reads), actions/*.ts (writes), pure engines beside them
src/middleware.ts      the auth gate + legacy redirects (must stay middleware — see the file)
extension/             HostOS Companion (MV3); scripts/build-extension.mjs zips it
supabase/migrations/   0001 … 0026, additive; supabase/bundles/ for one-paste bundles
tests/                 node --experimental-strip-types, no framework
vendor/                originals that were merged in (reference only, excluded from lint/tsc)
docs/                  AUDIT.md (classification + dependency map), history/
```

## Conventions

- **Query modules never throw.** `src/lib/*/queries.ts` wraps every Supabase
  call and degrades to `[]` / `null`, so a missing table takes down one widget,
  never a page.
- **Server actions return `{ ok, error? }`** and check `hasPermission(...)` —
  a hidden button is a UI convenience; a server action is a public endpoint.
- **Routes live in `src/lib/routes.ts`.** No hand-spelled `/app/...` strings.
- **One place per concern.** One notifications table (`notify()`), one task
  board (`createTask()`), one activity stream (`logActivity()`), one AI
  orchestrator, one extension, one dashboard grid with per-scope catalogues.
- **AI is quarantined.** The Butler drafts and suggests; every send, cancel or
  change is a person's click.
- **Comments explain why, not what.** Many cite the specific bug that shaped
  the code they sit above.
- Lint, types, tests and build clean before anything is called done.

## Team

Founder: John Briones (johnbriones774@gmail.com) · HostOS Collective.
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the hand-over notes.
