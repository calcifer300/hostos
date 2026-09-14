# HostOS — Project Status

_Compiled 2026-09-14 · branch `unified` · production https://hostos-ten.vercel.app_

## At a glance

| | |
|---|---|
| **Positioning** | HostOS Collective = business solutions (VAs & support, automation & custom systems, websites, apps, SEO). HostOS = the operations platform everything runs on. |
| **Verticals** | Fleet (Turo) **live** · Restaurants (DoorDash) **beta** · Commerce (Shopify) **beta** · any business via modules |
| **Dashboards** | Home + one per line of business, each with its own widget catalogue and saved layout |
| **Tenancy** | Multi-workspace; roles owner / admin / manager / member / viewer + platform roles |
| **Extension** | HostOS Companion v4.0 — Turo, DoorDash Merchant Portal, Shopify admin |
| **AI** | One Butler (Gemini) — drafts, briefings, task generation, policy answers; never acts alone |
| **Mobile** | Installable PWA on iOS / Android / desktop, guide at `/install` |
| **Quality gates** | `tsc` clean · `eslint` clean · `npm test` 6 files all passing · production build (see CHANGELOG) |
| **Blocking for production** | Migrations **0017–0024** must be applied in Supabase (bundle: `supabase/bundles/0017-0024.sql`); new env vars set in Vercel (see below) |

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
  `/api/cron/{digest,butler,commerce}` (vercel.json: daily / 15 min / hourly).
- Server actions per domain in `src/lib/actions/*`, all `{ ok, error? }`,
  permission-checked.

### Extension
`extension/` v4.0.0 — `sites.js` registry; Turo loops unchanged; `doordash.js`
reports store status; `shopify.js` badge + Sync now; new host permissions and
content scripts in `manifest.json`; zip rebuilt on `npm run build`.

## Deploy checklist (hostos-ten.vercel.app)

1. **Supabase → SQL editor:** paste and run `supabase/bundles/0017-0024.sql`
   (additive, idempotent; safe to re-run).
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
