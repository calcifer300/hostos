# HostOS — Tech Debt

_Updated 2026-09-15. Known shortcuts, why they were taken, and what pays them off._

| # | Debt | Where | Why it exists | Pay-off |
|---|---|---|---|---|
| 1 | **`hosts` / `host_id` naming** for what is now a workspace | every table, `lib/host/*` | Thirty tables and the Companion protocol reference `host_id`; renaming is a big-bang migration with no user-visible gain | Leave. Document (done in `ARCHITECTURE.md`). Introduce `workspace` only in new code's vocabulary. |
| 2 | **`middleware.ts` is deprecated in favour of `proxy.ts`** in Next 16 | `src/middleware.ts` | Works today with a deprecation warning; `proxy.ts` semantics differ slightly for the cookie gate | Port once Next removes the shim; keep the gate logic byte-identical. |
| 3 | **Fleet-centric names inside the fleet module** (`canEditCurrentFleet`, `getFleetsForUser`, `FleetMember`) | `lib/host/context.ts`, callers | Kept for churn reasons; new code uses `hasPermission()` / `getWorkspace…` wrappers | Rename in one sweep with a codemod when the fleet module is next touched heavily. |
| 4 | **Dashboard layouts stored as one JSON object** per (workspace, person) rather than a row per scope | `dashboard_layouts.layout` | Avoided a PK change on a table that may already exist in some environments; read handles both shapes | If per-scope queries are ever needed, migrate to `(host_id, user_email, scope)` PK. |
| 5 | **Home greeting header is hard-wired to America/Denver** | `components/dashboard/greeting-header.tsx` | Inherited; matches `HOST_TIMEZONE` in `lib/dashboard/queries.ts` | Drive both from `hosts.timezone` (column exists since 0017). |
| 6 | **Restaurant inventory read per restaurant in a loop** (capped at 10) on dashboards | `lib/dashboard/assemble.ts` | No cross-restaurant inventory query yet | Add `getLowStockAcrossRestaurants(hostId)` (one query with a threshold join). |
| 7 | **Commerce products fetched per store (limit 3000)** to compute analytics | `lib/dashboard/assemble.ts`, `app/app/commerce/*` | Simple and correct at pilot scale | Materialise per-store analytics on sync (`commerce_sync_runs` could carry the summary) or add SQL aggregates. |
| 8 | **Shopify polling, no webhooks** | `lib/commerce/sync.ts`, `/api/cron/commerce` | Custom-app tokens don't register webhooks without extra setup | Register webhooks on connect; keep the hourly sweep as reconciliation. |
| 9 | **DoorDash data is Companion observations + CSV exports** | `extension/doordash.js`, restaurants module | No API access yet; Merchant Portal markup is not a contract | DoorDash API onboarding; keep the DOM reader best-effort and silent on failure (already is). |
| 10 | **No RLS policies** — service-role only | all tables | Every read is server-side; policies would be dead code today | Write policies when a client with a user JWT appears (mobile app, public API). |
| 11 | **Marketing copy contains claims carried over from the previous company site** (stats, projects, testimonials) | `components/marketing/data.ts` | Requested by the founder; the previous site marked testimonials as demo | Founder confirms or replaces before a public campaign. |
| 12 | **No end-to-end tests** — only pure engines are tested | `tests/` | Runner is plain Node; the UI was verified by hand in the browser | Playwright smoke suite over the deploy checklist routes. |
| 13 | **Companion content scripts duplicate the site matchers** from `sites.js` | `extension/*.js` | Content scripts can't `importScripts` | Build step that inlines `sites.js` into each content script, or a shared module via `chrome.scripting`. |
| 14 | **`butler/briefing` polls from the dashboard while signed out** (401 in dev) | `components/dashboard/ai-briefing-card.tsx` | Harmless in production (gate); noisy in dev | Skip the fetch when `signedIn` is false. |
| 15 | **Crons run daily, not every 15 min / hourly** | `vercel.json` | The Vercel project is on the Hobby plan, which rejects any cron more frequent than daily (deploy failed on `*/15 * * * *`). Butler rules run daily at 13:00 UTC + on demand (Butler → Run now); Shopify syncs daily at 13:30 UTC + on demand (store → Sync now / Companion badge) | Upgrade the Vercel project to Pro and restore `*/15 * * * *` for the Butler and `0 * * * *` for commerce. |
| 16 | **`vendor/` weight in the repo** | `vendor/cc-extension`, bundles | Kept as the audit's evidence and for reference | Move to a separate archive repo once Karl has reviewed the audit. |

## Open notes (2026-09-15)

- **Dev-only "unique key" warning attributed to `OuterLayoutRouter`** on
  hydration of every /app page (2026-09-15). All stack frames are Next.js
  internals, it does not reproduce on client-side navigation, and the
  production React build does not emit it — bisected to the app layout's
  data fetches (timing of the streamed RSC payload), not to any list in app
  code. Re-check after the next Next.js upgrade.
