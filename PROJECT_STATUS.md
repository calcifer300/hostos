# HostOS — Project Status

_Compiled 2026-09-15 · branch `unified` · production https://hostos-ten.vercel.app_

## At a glance

| | |
|---|---|
| **Positioning** | HostOS Collective = business solutions (VAs & support, automation & custom systems, websites, apps, SEO). HostOS = the operations platform everything runs on. |
| **Verticals** | Turo (fleet) **live** · DoorDash (restaurants) **beta** · Shopify (commerce) **beta** · GoDaddy (web & domains) **new** · Coffee Shops **new** · Barbershops **new** · Build a custom **new** |
| **After sign-in** | `/app/start` — choose the vertical to run; the shell focuses on it (sidebar shows only that vertical + shared pages) |
| **Dashboards** | Home + one per vertical, each with its own widget catalogue and saved layout |
| **Tenancy** | Multi-workspace; roles owner / admin / manager / member / viewer + platform roles |
| **Extension** | HostOS Companion v4.0 — Turo, DoorDash Merchant Portal, Shopify admin |
| **AI** | One Butler (Gemini) — drafts, briefings, task generation, policy answers; never acts alone |
| **Mobile** | Installable PWA on iOS / Android / desktop, guide at `/install` |
| **Quality gates** | `tsc` clean · `eslint` clean · `npm test` 6 files all passing · production build (see CHANGELOG) |
| **Blocking for production** | Migrations **0017–0025** must be applied in Supabase (bundle: `supabase/bundles/0017-0025.sql`); 0025 adds the four new verticals' tables |

## What exists now

### Public site (`/`)
HostOS Collective landing built from the company's previous site structure:
hero, who we are (stats), services (9), industries, the HostOS platform
(intro + fleet / restaurant / commerce sections + features + automation + AI
Butler + integrations), virtual-assistance team, why choose us, our work (3
projects), process, testimonials, pricing, FAQ, contact (form → `contact_requests`,
email + WhatsApp), footer. Sub-pages `/team`, `/about`, `/install`. Company
name and contact details are in `src/lib/site.ts`; every word of copy is in
`src/components/marketing/data.ts`.

### Product (`/app`)
- **Home** — lines-of-business cards, key numbers, tasks, notifications,
  Butler briefing, needs-you-next, low stock, recent events.
- **Fleet dashboard** — trips, on-trip, guest messages, attention, tasks;
  board, guest messages, fleet overview, occupancy, suggestions, pickups,
  returns, operations timeline, unscheduled vehicles. Detail pages: board,
  operations, reservations, vehicles (+ vehicle), messages (+ thread), Gmail
  inbox, risk, Turo policy library.
- **Restaurant dashboard** — orders today, stores open, menu changes pending,
  low stock, tasks; restaurant cards (add / open), delivery orders, menu sync,
  top items, notifications, activity. Detail: overview, menu comparison
  (upload POS + DoorDash exports → action list), orders, messages, inventory;
  UPC-A generator.
- **Commerce dashboard** — sales 14d, orders 14d, low stock, stores, tasks;
  store cards (connect Shopify / manual + CSV), sales chart, top products,
  sync health, low stock. Detail: overview, products, orders, sync runs.
- **Web dashboard (GoDaddy)** — sites & domains table (add / edit / check now /
  remove), renewals & SSL due, uptime; daily cron check.
- **Coffee shop dashboard** — sales today vs same day last week, tickets, low
  stock, on shift; 14-day sales chart with "log a day", stock counts in place,
  shifts, opening/closing checklists, locations.
- **Barbershop dashboard** — appointments today, revenue 7d, no-shows, due for
  rebooking; today's chairs (book / done / no-show / cancel), rebooking list,
  revenue per barber, shifts, checklists, locations.
- **Custom dashboard** — numbers tracked / on target / build requests; metric
  cards with log-today and sparklines, checklists, build requests to the
  Collective.
- **Shared** — tasks board, notifications, AI Butler workspace, insights,
  knowledge, automations, connectors (registry-driven), settings (modules,
  fleet identity, alerts, reply templates, team & roles, install guide).
- Shell: sidebar grouped per line of business with platform chips, command
  palette (pages, vehicles, conversations, restaurants, stores), notification
  bell, workspace switcher, backend-status banner, page transitions, loading
  skeletons, error boundary, global press pulse, branded 404.

### Backend
- 24 migrations (0017–0024 new: platform repairs, restaurants, workspace
  layer, reply templates, marketing, integrations + encrypted secrets,
  commerce, workspace roles + invitations). 35 tables, all `host_id`-keyed,
  RLS on, service-role only.
- API: `/api/turo/*` (Companion ingest), `/api/companion/*` (draft, summary,
  alerts, context, restaurants/status, commerce/sync), `/api/butler/*`,
  `/api/cron/{digest,butler,commerce}` (vercel.json: all daily on the Hobby plan; Pro unlocks 15-min Butler and hourly commerce).
- Server actions per domain in `src/lib/actions/*`, all `{ ok, error? }`,
  permission-checked.

### Extension
`extension/` v4.0.0 — `sites.js` registry; Turo loops unchanged; `doordash.js`
reports store status; `shopify.js` badge + Sync now; new host permissions and
content scripts in `manifest.json`; zip rebuilt on `npm run build`.

## Deploy checklist (hostos-ten.vercel.app)

1. **Supabase → SQL editor:** paste and run `supabase/bundles/0017-0025.sql`
   (additive, idempotent; safe to re-run). Without 0025 the four new
   verticals show empty dashboards and every add says "Run migration 0025".
2. **Vercel → Environment variables:** add `NEXT_PUBLIC_APP_URL=https://hostos-ten.vercel.app`,
   `HOSTOS_ENCRYPTION_KEY` (32 random bytes, base64), `CRON_SECRET`,
   `RESEND_API_KEY` + `MAIL_FROM_EMAIL` (if not already), keep the existing
   Supabase / Google / Auth / Gemini values.
3. **Google Cloud → OAuth client:** redirect URI
   `https://hostos-ten.vercel.app/api/auth/callback/google` (unchanged if
   already set).
4. Deploy branch `unified` (`npx vercel --prod` from the repo root, or connect
   the GitHub repo to the Vercel project).
5. Smoke test: `/` renders, `/app` redirects to `/login` when signed out,
   sign in → Home → each dashboard; Settings → Modules toggles restaurants /
   commerce; Connectors shows the Companion download; `/install` on a phone.
6. Re-pair the Companion (v4.0) — download from Connectors, load unpacked,
   paste the pairing key.

## Hand-over

- Founder: **John Briones** — johnbriones774@gmail.com.
- CTO: **Karl** — gets the GitHub repository (`unified` branch) plus this
  file, `ARCHITECTURE.md`, `NEXT_TASKS.md`, `TECH_DEBT.md`, `docs/AUDIT.md`.
- Originals of everything merged are in `vendor/` (never imported); the
  classification and dependency map are in `docs/AUDIT.md`.
