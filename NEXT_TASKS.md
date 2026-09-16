# HostOS — Next Tasks

_Updated 2026-09-16. Ordered by what unblocks the most._

## Team page (2026-09-16)

- [ ] Gerald's portrait — upload via Settings → Our Team page → Edit → Photo.
- [ ] Sitemap entry and an OG image for `/team` (the roster is now a real
      page worth sharing).
- [ ] If more people will edit the roster: move the founder gate to a role
      check and add per-member photo history (the bucket keeps one object
      per upload; replaced ones are deleted on save).

## Now (before / at deploy)

- [x] Migrations 0026, 0027, 0028 applied to production (2026-09-15).
- [ ] **Service Businesses, Phase 2** (see docs/SERVICE_BUSINESSES.md): photo
      upload from the phone (Supabase Storage), the unified inbox (SMS via
      Twilio, WhatsApp, Messenger, email) writing to the customer timeline,
      the natural-language assistant over service data ("who is free
      tomorrow?"), automation builder, custom forms, multi-location, PDF
      estimates emailed to the customer, route optimisation.

- [ ] **Apply migration 0026** — paste `supabase/bundles/0026-0026.sql` into the
      Supabase SQL editor. Until then: per-member vertical limits can't be
      saved (the picker says so), quick notes can't be added (the panel says
      so), and auto-named workspaces still read "<First>'s Fleet".

1. **Apply migrations 0017–0025** in the Supabase SQL editor
   (`supabase/bundles/0017-0025.sql`). Until then restaurants, commerce,
   web, cafés, barbershops, custom, tasks, notifications, templates, roles
   and dashboard layouts run in degraded (empty) mode.
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

- **New verticals, second pass:** CSV import for café sales (Square/Toast
  exports) and barbershop appointments (Square Appointments/Booksy); SMS
  reminders for rebooking and no-shows once the SMS channel exists; GoDaddy
  API sync of domain expiries; weekly checklist reset on a cron.

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
