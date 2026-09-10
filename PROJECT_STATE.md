HostOS — Project State
An operations dashboard for Turo hosts. Next.js 16 · React 19 · Supabase · Chrome extension.

Compiled: September 9, 2026 · Branch `demo-polish` · Latest commit: 32866ff

At a glance
| | |
|---|---|
| Tenancy | Multi-fleet. Every signed-in user gets their own, auto-provisioned on first sign-in |
| Auth model | Gated in production (middleware), open shell in development |
| AI surface | One card only (AI Briefing) — everything else is deterministic |
| Data sources | HostOS Companion extension (authoritative) + Gmail (optional, supplementary) |
| Deployed | hostos-ten.vercel.app, from the working tree via the Vercel CLI |
| Blocking | Migrations 0012 + 0013 must be applied before the next deploy |

## 1. What changed since Project Aurora

Aurora shipped a single-tenant public shell. Three things have replaced that:

1. **The shell is no longer public.** `src/middleware.ts` gates every route on a
   session in production. The dashboard carries guest names, message threads,
   licence status and plates — personal data belonging to people who never
   agreed to publish it.
2. **One deployment now serves many fleets.** Migration 0009 built the
   membership table; 0012 and `lib/host/provision.ts` finally write to it.
   Before this, a new Google account resolved to `NO_FLEET_HOST_ID` and got an
   empty app with no explanation and no next step.
3. **The Companion is obtainable.** It lives in `extension/`, is packaged into
   `public/hostos-companion.zip` by `npm run build`, and Connectors walks a new
   fleet through installing and pairing it.

## 2. Architecture

```
  HostOS Companion (Chrome extension)          Google Gmail (optional)
          │  6 background loops, 1min – 6h              │  OAuth, opt-in
          ▼                                              ▼
   POST /api/turo/{sync,messages,                NextAuth session
        license-status,enrichment}                + Gmail API
          │  Authorization: Bearer <pairing key>          │
          └──────────────────┬───────────────────────────┘
                             ▼
                    Supabase (Postgres)
                             │
                             ▼
                  Next.js 16 App Router
```

Governing decisions:

- **Companion wins on overlap.** Where both pipelines can produce the same data
  (pickups, returns, vehicles, reservations), the extension's real scraped
  timestamps and plates beat Gmail's subject-line heuristics.
- **Companion is independent of Google.** It authenticates with a per-fleet
  bearer pairing key, so a host with no Google account still gets a full app.
- **AI is quarantined.** Exactly one surface calls a model. Butler, fleet
  health, risk queues and all sorting are rule-based TypeScript, so the app is
  fully functional with no AI key configured.
- **Fleet resolution has one home.** `lib/host/context.ts`. Every query takes a
  host id from it; nothing hardcodes `DEFAULT_HOST_ID` any more.

## 3. Multi-tenancy

`getCurrentHostId()` resolves the fleet for a request. `getFleetsForUser()`
provisions one when a signed-in user has none.

**Provisioning lives inside the cached read, not in a layout.** A layout and the
pages beneath it render in parallel, so a layout that provisions on render loses
the race against a page resolving its host id. Doing it inside the
`React.cache()`'d function means every caller in a request awaits the same
single provisioning promise.

**The unique index is the concurrency control.** Opening the app fires the
document plus several RSC prefetches at once, each a separate invocation with
its own cache. Without `hosts_created_by_email_idx`, "select, see nothing,
insert" races itself and one person owns three fleets with their data split
across them. The losing insert re-reads the winner.

**No fleet resolves to `NO_FLEET_HOST_ID`** — a valid uuid matching no row, so
every host-scoped query returns empty by construction rather than each call site
remembering to check.

Roles: `owner` (may rename, may issue pairing keys), `member` (full read/write),
`viewer` (read only). `canEditCurrentFleet()` gates every write.

## 4. Database

Supabase / Postgres, 13 migrations. Every table: RLS enabled, zero policies —
reachable only through the service-role key from server-only code.

| Migration | What |
|---|---|
| 0001 | `gmail_accounts`, `synced_emails` — user_email-keyed |
| 0002 | `knowledge_base`, `automation_settings` |
| 0003 | `hosts`, `vehicles`, `trips`, `trip_events` — host_id-keyed |
| 0004 | `trip_messages` |
| 0005 | Licence-verification status on trips |
| 0006 | `user_roles` (global: "is this person a developer?") |
| 0007 | Vehicle specs — VIN, odometer, fuel |
| 0008 | Trip enrichment — protection plan, guest track record |
| 0009 | `host_members`, `hosts.slug`, `hosts.timezone` |
| 0010 | Earnings and risk — included miles, take rate, calendar prices |
| 0011 | Premier workflow — driver id, damage responsibility |
| **0012** | **`hosts.created_by_email` + partial unique index. Self-serve fleets.** |
| **0013** | **`knowledge_base` / `automation_settings` re-keyed to `host_id`.** |

0012 and 0013 are written but **not yet applied to production**. They are
additive and idempotent. Apply before deploying: 0013's code reads `host_id`,
and without the column the Knowledge page silently falls back to the shipped
default house rules instead of the fleet's real ones.

## 5. APIs

| Route | Auth | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | NextAuth | Google OAuth |
| `/api/turo/sync` | Bearer pairing key | Trips + vehicle roster |
| `/api/turo/messages` (POST) | Bearer pairing key | Guest-message ingestion |
| `/api/turo/messages` (GET) | Session | Conversation list |
| `/api/turo/messages/[tripId]` | Session | One thread |
| `/api/turo/license-status` | Bearer pairing key | Licence sweep results |
| `/api/turo/enrichment` | Bearer pairing key | Protection plan, guest history |
| `/api/ihost/analyze` | Optional | Single-message AI classification |
| `/api/ihost/briefing` | Session | AI summary of synced Gmail |
| `/api/cron/digest` | Bearer `CRON_SECRET` | Daily digest, per fleet |

## 6. Resolved

Every open bug from the Aurora-era state file:

- ~~`GET /api/turo/messages` has no authentication~~ — `lib/api/browser-auth.ts`.
- ~~`knowledge_base`/`automation_settings` are Google-session-keyed~~ — 0013.
- ~~Operations and Overview don't live-refresh~~ — `AutoRefresh`, 30s.
- ~~Nothing committed since Sprint 3~~ — committed.
- Two cross-tenant leaks found and closed this session: `connectors/page.tsx`
  and `regenerateCompanionApiKey()` both resolved `DEFAULT_HOST_ID`, so any
  signed-in stranger could rotate the seeded fleet's pairing key — killing the
  real operator's sync and pointing their own extension at his data.
- `canEditCurrentFleet()` existed but was never called; `viewer` could write
  everything.
- Turbopack resolved `node_modules` from a stray lockfile in the user profile
  directory, 500ing every dev page. Pinned via `turbopack.root`.

## 7. Open

- **Migrations 0012 and 0013 are not applied.** Blocks the next deploy.
- **`src/middleware.ts` uses a deprecated convention.** Next 16 wants
  `proxy.ts`. It still works and still builds, but this is the auth gate — a
  botched rename is a data leak, so it wants its own change with its own
  verification, not a drive-by.
- **`fleet.js` in the extension still hardcodes 21 vehicles**, none matching a
  real trip. Suspected stale data from a prior client relationship.
- **Provisioning is untested against a second real Google account.** The logic
  is verified against the database; the end-to-end sign-in flow is not.
- **No fleet invitations.** `host_members` supports multiple people per fleet
  and the roster renders in Settings, but there is no UI to add anyone — a
  co-host has to be inserted by hand.
- **Chrome Web Store.** The Companion ships as a self-hosted zip. A store
  listing needs a developer account and review.
- **The digest sends nothing** until `RESEND_API_KEY` and `DIGEST_FROM_EMAIL`
  are set. It computes correctly and reports that it skipped.

## 8. Coding standards

- Query modules never throw — every `src/lib/*/queries.ts` function wraps its
  Supabase call and degrades to `[]` / `null`.
- Shared helpers over ad hoc checks: `isUndefinedTableError()`,
  `isSupabaseConfigured()`, `runQueryOr()`.
- `rowToX()` converters map snake_case rows to camelCase domain types.
- Server actions return `{ ok, error? }`, never throw to the client, and check
  `canEditCurrentFleet()` before writing.
- Comments explain why, not what — several cite the specific past bug that
  shaped the current code.
- Lint clean at every checkpoint. The extension is excluded from ESLint: its
  files share one global scope via `importScripts`, so every cross-file
  function reads as unused.
- Design tokens in `globals.css`; dark-mode-first Aurora palette
  (`#0D1117` / `#161B22` / `#4F8CFF`). Framer Motion throughout, one easing
  curve.
- Every feature verified with lint + build + a live browser check before being
  reported complete.
