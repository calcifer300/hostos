# HostOS — Architecture

_Last updated 2026-09-14 · branch `unified`._

HostOS is one Next.js application, one Postgres database and one Chrome
extension serving many businesses. This document is the map: where each
concern lives, how a request flows, and the rules that keep the map true.

## 1. Shape

```
┌──────────────────────────── public ────────────────────────────┐
│  /            HostOS Collective landing (services, platform,    │
│               team, work, testimonials, pricing, FAQ, contact) │
│  /team /about /install /login /offline                          │
└────────────────────────────────────────────────────────────────┘
┌──────────────────────────── product (/app, session-gated) ─────┐
│  /app/start  choose the vertical to run (focuses the sidebar)   │
│  Home ──┬── Fleet (Turo)            /app/fleet                  │
│         ├── Restaurants (DoorDash)  /app/restaurants            │
│         ├── Commerce (Shopify)      /app/commerce               │
│         ├── Web & domains (GoDaddy) /app/web                    │
│         ├── Coffee shops            /app/cafe                   │
│         ├── Barbershops             /app/salon                  │
│         └── Custom                  /app/custom                 │
│  shared: tasks · notifications · Butler · insights · knowledge  │
│          automations · connectors · settings (team, alerts,     │
│          templates, install)                                    │
└────────────────────────────────────────────────────────────────┘
┌──────────────────────────── ingest / automation ────────────────┐
│  Companion → /api/turo/* (sync, messages, license, enrichment)  │
│            → /api/companion/* (draft, summary, alerts, context, │
│                 restaurants/status, commerce/sync)              │
│  Vercel Cron → /api/cron/{digest, butler, commerce}             │
│  Shopify Admin API ← lib/commerce/sync (hourly + on demand)     │
└────────────────────────────────────────────────────────────────┘
```

### Tenancy

A **workspace** is a row in `hosts` (the name predates the multi-vertical
platform; it is kept because thirty tables reference `host_id`). Every
data table is `host_id`-keyed. `host_members` holds who belongs to which
workspace and with which role. `hosts.modules` (0017) lists the enabled
lines of business.

`src/lib/host/context.ts` is the only place that decides which workspace a
request is operating on. Every query takes that id. A signed-in person with
no workspace resolves to `NO_FLEET_HOST_ID`, a uuid that matches no row, so
every query returns empty by construction.

### Auth

`src/middleware.ts` gates `/app/*` on the presence of a session cookie and
301-redirects legacy top-level paths (`/board` → `/app/board`, `/fleet/<car>`
→ `/app/fleet/vehicles/<car>`). It **must** stay middleware: a layout and its
page render in parallel, so a layout that refuses to render `{children}` does
not stop the page's queries — the data still lands in the RSC payload (this
was measured, twice). NextAuth v5 with Google is the identity provider; the
Companion authenticates with a per-workspace pairing key instead
(`src/lib/api/companion-auth.ts`).

### Roles and permissions

`src/lib/roles/permissions.ts` — workspace roles `owner > admin > manager >
member > viewer` and a permission matrix (`workspace.read | write | settings
| integrations | members | delete`). `hasPermission()` in `lib/host/context.ts`
is what server actions check. `canAssignRole()` enforces "only below your own
rank, and nobody but the owner touches ownership". Platform roles (Founder,
CTO, Lead Developer, Developer, Support, Fleet Owner, Co-host/VA) live in
`user_roles` and unlock developer tooling, not data.

## 2. Request flow

1. **Middleware** — gate + legacy redirects (edge, no DB).
2. **`src/app/app/layout.tsx`** — resolves the workspace, modules, roles,
   badge counts, notifications and command-palette sources with one
   `Promise.all` of cached, total reads; renders the shell
   (`components/shell/*`).
3. **`src/app/app/template.tsx`** — remounts on navigation to play the page
   transition; `loading.tsx` is the skeleton while a page's RSC is in flight;
   `error.tsx` the boundary.
4. **Page** — reads through `lib/*/queries.ts` (React `cache()`d per request,
   never throw), computes with pure engines (`lib/*/analytics.ts`,
   `lib/restaurants/compare.ts`, `lib/board/countdown.ts`, …) and renders
   client components that receive plain data.
5. **Writes** — `lib/actions/*.ts` server actions return `{ ok, error? }`,
   check permissions, write through `runMutation`, then `revalidatePath`.

### Supabase access

`src/lib/supabase/server.ts` wraps every call: `runQuery` / `runQueryOr` /
`runMutation` classify failures (missing table or column → quiet
`missing_table`; network → circuit breaker; anything else → logged
`query_error`), apply a per-request timeout, and never reject. The service-role
key is the only key; RLS is on with no policies, so nothing reaches the
database except server code.

## 3. Dashboards

`src/lib/dashboard/widgets.ts` is the catalogue: four **scopes** (`home`,
`fleet`, `restaurants`, `commerce`) and a `WidgetDefinition` per widget naming
which scopes it may appear on and which module it needs. `resolveLayout()`
merges a stored arrangement with the catalogue. `src/lib/dashboard/assemble.ts`
reads only what a scope's widgets need and hands one `WidgetData` to
`components/dashboard/dashboard-grid.tsx`, which renders
`components/dashboard/widgets.tsx` and hosts the customize mode (Framer
`Reorder`). Layouts are saved per person, per workspace, per scope in
`dashboard_layouts.layout` as `{ home: [...], fleet: [...], … }` (a bare array
from before the split is read as Home). `src/lib/dashboard/scope.ts` classifies
shared records — tasks, notifications, activity — so each line-of-business
dashboard shows only its own.

A dashboard for a module that is switched off renders
`components/dashboard/module-off.tsx` with the one link to enable it.

## 4. Modules (lines of business)

| Module | Data | Ingest | Pages | Pure engines |
|---|---|---|---|---|
| **fleet** (Turo) | `trips`, `trip_messages`, `trip_events`, `trip_history`, `vehicles`, `board_locations`, `alert_settings`, `alert_deliveries`, `turo_articles` | Companion loops (sync 1m, messages 1m, license 15m, enrichment 10m, calendar 6h) → `/api/turo/*`; Gmail optional | `/app/fleet` (dashboard), board, operations, reservations, vehicles, messages, inbox, risk, library | `lib/board/{countdown,bulk-paste}`, `lib/timezones`, `lib/risk`, `lib/alerts`, `lib/trips` |
| **restaurants** (DoorDash) | `restaurants`, `menu_uploads`, `menu_comparisons`, `menu_item_links`, `restaurant_orders`, `restaurant_messages`, `restaurant_status_events`, `inventory_items` | Companion `doordash.js` (store status) → `/api/companion/restaurants/status`; CSV exports uploaded in-app | `/app/restaurants` (dashboard), `/app/restaurants/[id]` (overview, menu, orders, messages, inventory), UPC tool | `lib/restaurants/{match,compare,parse,upc,analytics,export}` |
| **commerce** (Shopify) | `commerce_stores`, `commerce_products`, `commerce_orders`, `commerce_sync_runs`, `integration_connections` | Shopify Admin API (`lib/commerce/shopify.ts` client, `lib/commerce/sync.ts`), hourly cron + Companion `shopify.js` "Sync now"; CSV import | `/app/commerce` (dashboard), `/app/commerce/[id]` (overview, products, orders, sync) | `lib/commerce/analytics` |
| **web** (GoDaddy) | `web_properties` | Typed in; HostOS probes HTTPS + TLS itself (`lib/web/check.ts`) on add, on demand and via `/api/cron/web` | `/app/web` (dashboard with the properties table) | `lib/web/queries.ts` (`daysUntil`) |
| **cafe** (Coffee Shops) | `locations`, `sales_entries`, `stock_items`, `shifts`, `checklists` | Logged in the dashboard (POS/CSV import next) | `/app/cafe` | `lib/local/queries.ts` (`summarizeSales`) |
| **salon** (Barbershops) | `locations`, `appointments`, `clients`, `stock_items`, `shifts`, `checklists` | Booked in the dashboard (Square Appointments / Booksy import next) | `/app/salon` | `lib/local/queries.ts` (`clientsDueForRebooking`) |
| **custom** (Build a custom) | `custom_metrics`, `custom_metric_entries`, `build_requests`, `checklists` | Logged in the dashboard; build requests emailed to the Collective | `/app/custom` | `lib/custom/analytics.ts` (`metricStatus`) |

**Vertical focus.** `src/lib/verticals.ts` maps each vertical to its route and
each product path to its vertical; `chooseVertical()` (`lib/actions/verticals.ts`)
stores the choice in the `hostos_vertical` cookie and enables the module if
needed; `SidebarNav` renders the shared sections plus exactly one vertical
section — the current page's vertical, else the cookie's, else the first
enabled.

Adding a module: a `MODULES` entry (`src/lib/modules.ts`), a migration, a
`lib/<module>/` folder with `queries.ts` + engines, actions, a nav section
(`components/shell/nav-items.ts`), widgets with `scopes`, a `DASHBOARDS` entry,
and — if the platform has a web UI — a Companion content module registered in
`extension/sites.js`.

## 5. Shared layer

| Concern | Where | Notes |
|---|---|---|
| Notifications | `lib/notifications/queries.ts` → `notify()` | Dedupe key per fact; kinds `trip · message · alert · restaurant · order · store · task · system · butler`. The bell, the page, the digest and the Companion read the same rows. |
| Tasks | `lib/tasks/queries.ts` → `createTask()` | Sources `manual · butler · automation`; dedupe keys make generators idempotent. |
| Activity | `lib/activity/queries.ts` → `logActivity()` | Modules `fleet · restaurant · commerce · butler · system · team`. |
| Knowledge & templates | `lib/knowledge`, `lib/templates` | Workspace-scoped house rules and saved replies; the Butler grounds in both. |
| Integrations | `lib/integrations/queries.ts`, `lib/crypto.ts` | `integration_connections` with AES-256-GCM-encrypted secrets (`HOSTOS_ENCRYPTION_KEY`, falls back to `AUTH_SECRET`). |
| Email | `lib/email` | Resend; alerts, invitations, digests. Computed regardless, sent only with a key. |
| Members | `lib/actions/members.ts` | Invite (email), change role, remove, accept. |
| Settings | `/app/settings/*` | Modules, fleet identity, alerts, templates, team, install guide. |

## 6. AI Butler

`src/lib/butler/index.ts` is the single orchestrator; `lib/ai` holds the
provider (Gemini, `GEMINI_MODEL`, default `gemini-3.6-flash`). `grounding.ts`
assembles context (knowledge base + reply templates + `search_turo_articles`
RPC over the 725-article policy library); `signals.ts` turns workspace state
into the facts a briefing reasons over; `tasks.ts` is the rule-based task and
notification generator that `/api/cron/butler` runs daily on the Hobby plan (every 15 minutes on Pro) and Butler → Run now triggers on demand;
`prompts.ts` holds every prompt. Surfaces: `/app/butler` workspace,
`/api/butler/{briefing,analyze}` (browser), `/api/companion/draft`
(extension), dashboard briefing widget. The Butler never sends, cancels or
changes anything; every action is a person's click.

## 7. Companion (extension/)

MV3. `background.js` is the service worker: pairing key storage, the fetch
helpers (`companionRequest/Get/Post`), the sync loops (`sync.js`, `fleet.js`,
`fleetCalendar.js`, `enrichment.js`, `tripWatch.js`), the message bridge, and
alerts (`alerts.js`). `sites.js` is the registry of recognised platforms
(turo · doordash · shopify) and what runs on each. Content modules:
`content.js` + `widget.js` (Turo), `doordash.js` (store status → HostOS),
`shopify.js` (badge + "Sync now"). `popup.html/js` is the side panel.
`scripts/build-extension.mjs` writes `public/hostos-companion.zip` with
`node:zlib` so the archive is identical on Windows and Linux builds.

## 8. PWA

`src/app/manifest.ts`, `public/sw.js` (network-first for pages, cache-first
for static, `/offline` fallback), `components/pwa/register-sw.tsx`, icons in
`public/icons/` (generated by `scripts/build-pwa-icons.mjs`), install guide
(`components/pwa/install-guide.tsx`) at `/install` and Settings → Install.

## 9. UI system

Tailwind v4 tokens in `src/app/globals.css` (light/dark, glass, gradient
border, card lift, skeleton shimmer, tap pulse); primitives in
`components/ui/*` (Button with `active:scale`, Card, Dialog, Tabs, Popover,
Tooltip, Switch, Input, Badge, Skeleton, Kbd, Toaster). Motion presets in
`components/motion/presets.ts`; `Reveal`, `Stagger`, `AnimatedNumber`, `Tilt`
in `components/motion/reveal.tsx`; page transitions in
`components/motion/page-transition.tsx`; the global press pulse in
`components/motion/tap-feedback.tsx` (mounted once in the root layout).
Fonts: Inter + JetBrains Mono via `next/font`.

## 10. Rules that keep this true

1. Query modules never throw; actions never throw to the client.
2. Every write checks a permission; every read takes a `host_id`.
3. Routes are spelled once, in `src/lib/routes.ts`.
4. One table per shared concern — no second notifications, tasks, templates,
   knowledge or activity store. One extension. One AI orchestrator. One
   dashboard grid.
5. Migrations are additive and idempotent; code degrades gracefully ahead of
   them.
6. Nothing in `vendor/` is imported. It is reference material for what was
   merged (see `docs/AUDIT.md`).
7. Lint, `tsc`, `npm test` and `npm run build` are clean before a commit.
