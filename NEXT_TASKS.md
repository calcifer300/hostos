# HostOS — Next Tasks

_Updated 2026-09-14. Ordered by what unblocks the most._

## Now (before / at deploy)

1. **Apply migrations 0017–0024** in the Supabase SQL editor
   (`supabase/bundles/0017-0024.sql`). Until then restaurants, commerce,
   tasks, notifications, templates, roles and dashboard layouts run in
   degraded (empty) mode.
2. **Set the new Vercel env vars** — `NEXT_PUBLIC_APP_URL`,
   `HOSTOS_ENCRYPTION_KEY`, `CRON_SECRET`, `MAIL_FROM_EMAIL` (+ `RESEND_API_KEY`).
3. **Deploy `unified` to hostos-ten.vercel.app** and run the smoke test in
   `PROJECT_STATUS.md`.
4. **Re-pair the Companion v4.0** on the machines that run it (Turo loops are
   unchanged; DoorDash/Shopify need the new host permissions).
5. **Confirm the public copy** — the landing page reuses the company's
   previous site (services, stats, projects, testimonials, contact email and
   WhatsApp). The previous site labelled its testimonials as demo examples;
   decide whether they stay, and update `src/components/marketing/data.ts`.

6. **Vercel plan:** Hobby limits crons to once a day, so the Butler and the Shopify
   sync run daily (13:00 / 13:30 UTC) plus on demand. Upgrading the project to
   Pro and restoring `*/15 * * * *` / `0 * * * *` in `vercel.json` brings back
   the 15-minute Butler and hourly sync.

## Next (product)

- **Restaurants:** DoorDash order/menu ingestion beyond CSV (Merchant Portal
  reads via the Companion, then the DoorDash Drive/Marketplace APIs when
  approved); push menu changes instead of exporting an action list.
- **Commerce:** Shopify webhooks (orders/create, inventory_levels/update) to
  replace hourly polling; fulfilment actions; WooCommerce / Square as the next
  providers (`StoreProvider` already allows them).
- **Fleet:** per-vehicle maintenance log and cost tracking; Turo calendar
  pricing suggestions from occupancy.
- **Butler:** per-module playbooks (restaurant support replies, commerce
  reorder drafts), streaming responses in the workspace, feedback loop on
  drafts (accepted / edited / rejected) to tune grounding.
- **Notifications:** web push (the service worker is in place), Slack and
  SMS channels (registry entries exist as "soon").
- **Dashboards:** widget-level settings (e.g. window 7/14/30 days), a
  read-only shareable dashboard link per workspace for clients of the VA team.
- **Team / VA operations:** shift handover notes, per-member activity view,
  time-zone aware assignment; a "client view" role that hides internal tasks.
- **Insights:** cross-module analytics page using the chart primitives
  (`components/charts/charts.tsx`) — revenue by line of business, response
  times, task throughput.
- **Onboarding:** module-aware setup checklist on Home (today it is
  fleet-centric), sample data for a new workspace.

## Later (platform)

- Row-level security policies + Supabase Auth JWTs so a future mobile client
  or public API can read without the service-role key.
- Rate limiting on public endpoints (`/api/companion/*`, contact form) at the
  edge.
- Playwright smoke suite for the five routes in the deploy checklist.
- i18n scaffolding (copy already lives in data files).
- Billing (Stripe) once pricing leaves "early access".
- Marketing: OG image per page, sitemap entries for `/team` and `/about`,
  blog/case-study route for the "Our work" projects.

## Housekeeping

- Retire `PROJECT_STATE.md` (pre-unification; superseded by
  `PROJECT_STATUS.md`) once Karl has read it.
- Move `vendor/karl/archives` and `vendor/legacy` (gitignored) to cold storage.
- See `TECH_DEBT.md` for known shortcuts.
