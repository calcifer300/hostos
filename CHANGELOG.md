# Changelog

All notable changes to HostOS. Dates are when the work landed on `unified`.

## [Unreleased] — 2026-09-15 · Our Team page, back-to-site links

- **Two views of the team.** hostoscollective.com/team (signed out) introduces people by photo, name and role only; **The Collective** (`/app/collective`, in the sidebar for every signed-in member) carries each person's focus, promise and responsibilities.
- **/team shows the roster as tiles** in the vertical chooser's language: a
  colour per department, photo (or initials until the photo arrives), title,
  focus words, one-line promise and responsibilities; staggered in with the
  same spotlight and lift. Twelve members seeded from code with formal
  titles (`src/lib/team/profiles.ts`).
- **Founder-only editor** at Settings → Our Team page (migration 0029,
  `team_profiles`): add, edit, hide, remove and reorder members, set the
  photo by link or /team/<slug>.jpg. The tab is only shown to the Founder
  and every action re-checks `isFounderEmail`.
- **Back to hostoscollective.com** from the app: a "Website" item in the
  sidebar's System group and a link in the account menu.
- **A colour per person** (migration 0030, `team_profiles.hue`): every tile
  on /team and The Collective wears its own colour, editable in the Founder
  editor; the department colour stays as the fallback. Roster ordered by
  responsibility and the copy reads as a collective rather than an org chart.
- **Twelve portraits** in `public/team/<slug>.jpg`: face-centred 800px
  squares from the studio set, lighting and colour matched to one reference
  frame with a touch of grain so they read as a single shoot
  (`scripts/team-photos.mjs <source-dir> public/team`). Local photos go
  through next/image, so the 96px circle downloads a 96–192px file.
- **The marketing nav knows you're signed in**: it shows "Open HostOS"
  instead of "Sign in" once a session exists, so going back to the website
  never looks like being signed out.

## 2026-09-15 · Service Businesses — the eighth vertical (Phase 1)

- **A vertical for appointment, dispatch and field businesses** (migration
  0027): auto glass, mobile mechanics, detailing, tires, towing, roadside,
  window tint, mobile car wash, cleaning, pest control, appliance repair,
  handyman, locksmiths, pools, painting, pressure washing, lawn care,
  landscaping, tree services, dumpster rental, junk removal, portable
  toilets, HVAC, plumbing, electrical, roofing, moving, construction, home
  renovation — 29 industry templates in `src/lib/services/industries.ts`,
  one schema. Applying a template loads the service catalogue (prices,
  durations), the shared lead-to-review SOPs plus the industry's own,
  and the technician's job checklist. A new industry is a new entry.
- **CRM**: leads and customers with source, several service addresses,
  service history, estimates, and a contact timeline (calls, texts, emails,
  notes, every status change written automatically).
- **Work orders**: kind, priority, technician, schedule, address (maps
  link), price, labor hours, materials, before/after photos (links),
  customer sign-off, job log, the template's checklist; recurring jobs
  rebook themselves on completion; completion files the review task.
- **Dispatch board**: pending / assigned / in progress / completed /
  cancelled, technician filter, change technician or status on the card
  (optimistic, animated); **schedule**: a week per technician with
  move-to-day / reassign on the card and double-booking flagged.
- **Estimates**: built from the catalogue, sent with a follow-up reminder,
  accepted in one click → work order + dispatch task; win rate and won
  value on the dashboard.
- **Butler rules**: jobs today without a technician, overdue jobs,
  estimates quiet for 2+ days, completed jobs missing after photos.
- **Fixed a platform bug found on the way** (migration 0028): the
  `(host_id, dedupe_key)` unique indexes on `tasks` and `notifications`
  were partial, so every deduplicated insert — the path the Butler files
  ALL its tasks and notifications through — failed silently with "no
  unique or exclusion constraint matching the ON CONFLICT specification".
  They are full unique indexes now.
- New `useMounted()` for browser-timezone output (times, calendars) so
  hydration never disagrees with the server.

## 2026-09-15 · Karl's review: access per vertical, quick notes, a cleaner front door

- **Per-member verticals** (migration 0026, `host_members.modules`): an
  invitation — or a member on the roster — can be limited to some of the
  verticals the workspace runs ("Juan: Shopify and Turo"). Null means every
  vertical; owners and admins always see everything. Enforced in
  `getAccessibleModules()`/`verticalAccess()`: the sidebar, the chooser
  ("Not assigned to you"), the dashboards and every page that belongs to a
  vertical check it *before* querying, so a vertical you can't open never
  reaches your browser.
- **Quick notes** (migration 0026, `quick_notes`): an owner/admin scratchpad
  in the corner of every page that follows the person across pages and
  workspaces. Pin, edit in place (saves on blur), ⌘↵ to add; also in the top
  bar.
- **The chooser is the front door**: on `/app/start` the sidebar shows only
  what is shared — the vertical's group appears once you have picked one.
  The group is headed by the platform's own name and colour ("DoorDash", in
  DoorDash red), the top bar reads *Workspace / DoorDash / Dashboard*, the
  workspace switcher shows the vertical under the name, and each dashboard's
  eyebrow wears its colour — so "which business am I in" is never in doubt.
- **Workspace names**: auto-named "<First>'s Fleet" workspaces become
  "<First>'s Workspace" (0026) — a workspace running DoorDash is not a fleet.
- **Registrar-neutral web vertical**: "GoDaddy" is now **Websites & Domains**;
  Cloudflare, Porkbun and Namecheap lead the registrar list (GoDaddy stays for
  clients already there). The `godaddy` integration id is kept for existing
  rows; it is labelled "Domain registrars".
- **Dark-mode legibility**: `color-scheme` follows the theme so native
  `<select>` popups no longer paint dark-on-dark options (the contact form's
  "Service interested in"); secondary text lifted from /70 → /85 and the dark
  muted tone brightened.

## 2026-09-15 · hostoscollective.com, sign-in fix, motion pass

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
