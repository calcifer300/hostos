# Changelog

All notable changes to HostOS. Dates are when the work landed on `unified`.

## [Unreleased] — 2026-09-15 · hostoscollective.com, sign-in fix, motion pass

- **Sign-in from www.hostoscollective.com works**: the canonical www → apex
  redirect now covers `/login` and `/api/auth/*` too (they were excluded from
  middleware entirely), so Google is only ever sent the apex callback. The www
  callback is also registered on the OAuth client as a belt-and-braces.
- **Motion pass**: pointer-following spotlight on every card (`.spot`, one
  document listener), light sweep on filled buttons, headline that arrives a
  word at a time over drifting orbs, counter-rotating industries marquee,
  reading-progress hairline in the marketing nav, dialogs that scale-and-blur
  in and out, sidebar accent rail that slides with the active item, stat
  cards that count up, icon badges that answer a hover, press pulses in the
  card's own hue on the chooser.
- **SEO/share**: `robots.txt`, `sitemap.xml` and a generated Open Graph /
  X card image (`/opengraph-image`) — links pasted into WhatsApp, Facebook
  and LinkedIn now show a preview.
- Command palette no longer draws a close "×" under its `esc` hint
  (`DialogContent hideClose`).

## 2026-09-15 · Seven verticals and the chooser

- **Vertical chooser after sign-in** (`/app/start`): Turo, DoorDash, Shopify,
  GoDaddy, Coffee Shops, Barbershops, Build a custom — one designed card each.
  Choosing focuses the shell on that vertical (remembered per browser) and
  switches it on for the workspace when needed (settings permission).
- **Clean command center per vertical**: the sidebar shows only the chosen
  vertical's section plus what is shared (Home, tasks, notifications, Butler,
  knowledge, connectors, settings). The page's own vertical always wins.
- **Four new verticals** (migration 0025):
  - *Web & domains (GoDaddy)* — properties with registrar, hosting, client,
    renewal date; HostOS checks uptime, response time and SSL expiry itself
    (on add, on demand, daily cron); renewals and outages become tasks and
    notifications.
  - *Coffee shops* — locations, daily sales log with same-day-last-week
    comparison and 14-day chart, stock with in-place counts and low-stock
    tasks, shifts, opening/closing checklists (one-tap defaults).
  - *Barbershops* — locations with chairs, appointments (book, done, no-show,
    cancel), clients built from visits with rebooking-due reminders, revenue
    per barber, shifts, checklists.
  - *Build a custom* — user-defined metrics with targets, daily logging and
    sparklines; checklists; build requests filed to HostOS Collective (task +
    notification + email).
- Butler rules for the new verticals (renewals, low stock, rebooking, metrics
  below target); `/api/cron/web` daily site checks.
- Platform role names are Title Case everywhere ("Virtual Assistant", "Tech
  Lead", "Co-Host / VA"); stored legacy spellings are normalised on read and
  write; new options Tech Lead, Operations Manager, Virtual Assistant.
- Landing "platform" section lists all seven verticals.

## [0.17] — 2026-09-14 · The unification

Everything from the audit (`docs/AUDIT.md`) to a single platform. One repo,
one app, one database, one extension.

### Platform
- **Repository restructured**: app at the root; every original that was
  merged is preserved unmodified under `vendor/` (never imported). Audit,
  classification (KEEP / MERGE / REFACTOR / REMOVE / REPLACE) and dependency
  map in `docs/AUDIT.md`.
- **Vertical-agnostic modules** (`src/lib/modules.ts`): `fleet` (Turo),
  `restaurants` (DoorDash), `commerce` (Shopify) switched on per workspace
  (`hosts.modules`, migration 0017). Integrations registry alongside.
- **Routes centralised** in `src/lib/routes.ts`; the product moved under
  `/app` so `/` can be public; legacy paths 301-redirect
  (`/fleet/<car>` → `/app/fleet/vehicles/<car>`).
- **Workspace roles** owner / admin / manager / member / viewer with a
  permission matrix and rank-aware role assignment (migration 0024);
  invitations with email; platform roles (Founder, CTO, Lead Developer,
  Developer, Support, Fleet Owner, Co-host/VA).
- **Shared layer** (migration 0019): one `notifications` table with dedupe,
  one `tasks` board, one `activity_log`, per-person dashboard layouts.
- **Reply templates** in the database (0020), **contact requests** (0021),
  **integration connections with AES-256-GCM-encrypted secrets** (0022).
- **Supabase wrapper** classifies a missing column like a missing table so
  code deployed ahead of a migration stays quiet.

### Dashboards
- **Separate dashboard per line of business** — Fleet (Turo), Restaurant
  (DoorDash), Commerce (Shopify) — plus a Home that ties them together with
  a card per business. Each has its own widget catalogue (`scopes`), its own
  key numbers, and its own saved layout (`dashboard_layouts.layout` keyed by
  scope). Shared widgets (tasks, notifications, recent events) filter to the
  business they sit on.
- New widgets: lines of business, menu sync, top items, sales, top products,
  sync health; restaurant and store card lists embedded as widgets.
- Customize mode (drag to reorder, show/hide) per dashboard; module-off
  screen with the one link to enable a module.
- Sidebar regrouped per line of business with platform chips; vehicles moved
  to `/app/fleet/vehicles`.

### Restaurant operations (DoorDash) — new module (migration 0018)
- Restaurants, POS-vs-DoorDash menu comparison (SKU / name / fuzzy Dice
  matching, manual links, price tolerance, 86'd detection, low stock),
  action-list export, orders import + analytics, customer messages, inventory,
  store status timeline, UPC-A generator (GS1 check digit).

### Commerce operations (Shopify) — new module (migration 0023)
- Shopify Admin API client (2025-07, custom-app token verified on connect,
  Link-header pagination, 429 backoff), hourly + on-demand sync of products,
  inventory and orders, low-stock notifications, sales analytics, CSV import
  for unconnected stores, sync-run history.

### AI Butler
- One orchestrator (`src/lib/butler`) replacing the separate iHost code:
  drafts, briefings, message analysis, policy answers with citations,
  rule-based task + notification generation on a 15-minute cron; Companion
  drafts now go through the same grounding.

### Companion extension v4.0
- Site registry (`sites.js`); DoorDash Merchant Portal status reporting
  (`doordash.js`); Shopify admin badge with "Sync now" (`shopify.js`);
  context endpoint; new host permissions and content scripts.

### Public site
- Landing page for **HostOS Collective**: business solutions (virtual
  assistants & support, automation & custom systems, dashboards, websites,
  mobile apps, SEO, CRM) with the HostOS platform as the flagship; `/team`
  and `/about` pages; contact form + email + WhatsApp; pricing and FAQ.
- Opening experience: animated logo → "Built by HostOS Collective" →
  loading → sign-in → dashboard.

### Mobile / PWA
- Web app manifest, service worker with offline page, icons, install guide
  (`/install`, Settings → Install) for iOS, Android and desktop — no app store.

### UI
- Design system on Tailwind v4 tokens (light/dark, glass, gradient border),
  Framer Motion presets, page transitions, loading skeletons, error boundary,
  branded 404, global press pulse on every click/tap, animated charts.

### Quality
- Tests for the dashboard catalogue and scope classifiers, the restaurant
  matching/compare/UPC engines, roles, routes, modules and Shopify helpers
  (`npm test`, 6 files). `tsc`, `eslint` clean.
- Root docs: `README.md`, `ARCHITECTURE.md`, `PROJECT_STATUS.md`,
  `NEXT_TASKS.md`, `TECH_DEBT.md`; `.env.local.example` rewritten;
  `scripts/bundle-migrations.mjs` for one-paste SQL bundles.

### Removed / replaced
- `src/lib/ihost`, `src/app/api/ihost/*`, `src/types/ihost.ts` → Butler.
- `home-dashboard.tsx` → dashboard grid + widget catalogue.
- Hard-coded `/app/...` strings → `routes`.
- Default Next.js sample assets in `public/`.

## [0.16] — 2026-09-09 (pre-unification, `hostOS-unified/hostos` `unified` @ bdefaaf)
- Per-fleet email alerts (migration 0016); alerts fire; license sweep fixes;
  floating widget in the Companion; pickups/messages labelling fixes.
  See `docs/history/cc-project-status.md` and `PROJECT_STATE.md`.
