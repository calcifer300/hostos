# Service Businesses — architecture and roadmap

_The eighth HostOS vertical: an operating system for appointment-, dispatch-
and field-based businesses. Written 2026-09-15 for John (Founder) and Karl
(CTO). Phase 1 shipped the same day._

## The idea in one paragraph

A service business — auto glass, mobile mechanic, towing, junk removal, HVAC,
plumbing, cleaning, lawn care, locksmith, movers, 29 in all — runs on the
same loop: a lead arrives, someone calls back, an estimate goes out, it is
accepted, a job is scheduled and dispatched, a technician does the work and
proves it, payment is collected, a review is requested, a follow-up lands a
month later. HostOS models that loop **once**, and each industry is a
**template** on top of it: its service catalogue, its SOPs, its checklist,
its vocabulary. Adding an industry is adding data, never tables or pages.
Owners see the whole business on one board; Virtual Assistants run it.

## What shipped in Phase 1

| Area | What it does | Where |
| --- | --- | --- |
| Industry templates | 29 industries in 6 groups; catalogue with prices and durations, skills, industry SOPs, job checklist; 5 shared SOPs (lead-to-review loop, missed-call policy, cancellation policy, photo standard, "how a VA works this business") | `src/lib/services/industries.ts` |
| Setup | Pick industry → catalogue into `service_settings`, SOPs into `service_docs`, checklist into `checklists` | `setupServices()` in `src/lib/actions/services.ts` |
| CRM | Leads/customers (stage, source, tags, notes), multiple service addresses, service history, estimates, contact timeline (calls, SMS, email, WhatsApp, Messenger, notes; status changes auto-logged) | `/app/services/customers`, `service_customers`, `service_properties`, `service_events` |
| Work orders | Kind, priority, technician, schedule, address → maps, price, labor hours, materials, before/after photos (links), customer sign-off, job log, template checklist, recurrence (weekly…quarterly rebooks itself on completion) | `/app/services/jobs/[id]`, `service_jobs` |
| Dispatch | Five-column board, technician filter, change technician/status on the card (optimistic, animated); pending↔assigned kept honest by the server | `/app/services/dispatch` |
| Schedule | Week × technician grid, move day / reassign on the card, conflicts flagged, "waiting for a time" list | `/app/services/schedule` |
| Estimates | Catalogue line items, tax, send (sets a 2-day follow-up), accept → work order + dispatch task + customer promoted to "customer"; win rate | `/app/services/estimates`, `service_estimates` |
| Team | Technicians, dispatchers, managers, VAs, owners with skills; revenue and completion rate per technician | Team card on the dashboard, `service_staff` |
| Knowledge | SOPs / policies / guides / FAQs / handbook / training, seeded from the template, edited in place, numbered steps | `/app/services/knowledge`, `service_docs` |
| Reporting | Revenue today / month, average job value, cancellation rate, lead conversion, per-technician stats, estimates pipeline | `src/lib/services/analytics.ts`, dashboard stats |
| AI operations (rule-based) | Jobs today with no technician (critical), overdue jobs (high), estimates quiet 2+ days, completed jobs with no after photo, expired estimates — filed as Butler tasks each morning | `src/lib/butler/tasks.ts` |
| Access | Per-member vertical access applies (a VA can be limited to Services); every page checks `verticalAccess("services")` before querying | `src/lib/host/context.ts` |

Data model: eight `host_id`-keyed tables (migration 0027), RLS on, service-role
only, `updated_at` triggers — identical in shape to every other module.

## Phase 2 — what turns "operational" into "the OS"

Ordered by leverage for the Collective's VA business.

1. **Unified inbox → timeline.** Twilio SMS (two-way, with the "missed call
   → text back" automation), WhatsApp Business API, Facebook Messenger
   webhooks, email via the existing Gmail sync. Every message lands on the
   customer's timeline; the Butler summarises threads and suggests replies
   (the grounding exists for Turo; generalise it to service SOPs + timeline).
2. **HostPilot — natural-language operations.** "Who is available tomorrow?",
   "Show overdue jobs", "Which technician has the highest completion rate?",
   "Generate an estimate for a windshield on a 2019 Camry", "Create today's
   dispatch list", "Which jobs have missing photos?" Implement as tool-use
   over `src/lib/services/queries.ts` + `analytics.ts` (the rules already
   answer most of these) grounded in `service_docs`. The Butler chat UI and
   Gemini provider already exist.
3. **Photos and files from the phone.** Supabase Storage bucket per host;
   upload from the job card (camera on mobile), contracts / permits /
   insurance on the customer; keep `photos` JSON as the index. The PWA is
   already installable, so technicians get this without an app store.
4. **Customer-facing estimate.** PDF (or a public signed page) emailed /
   texted with Accept / Decline buttons that call `setEstimateStatus`.
5. **Automation builder.** A small rules table (`when` event → `then`
   steps) over the events the actions already emit (estimate accepted, job
   completed, job scheduled): notify customer, create calendar event, SMS
   reminder the day before, notify dispatcher. Ship the brief's example as
   the default rule set; the UI is a list, not a canvas.
6. **Forms.** JSON form definitions (inspection, job report, vehicle /
   equipment inspection, intake) rendered on the job card; answers stored
   on the job. Templates per industry.
7. **Multi-location.** `service_locations` (branch / warehouse / dispatch
   office / city) with staff and jobs assigned; board and schedule filter by
   location. Same pattern as cafés and barbershops.
8. **Time tracking & attendance.** Clock in/out on the staff record;
   started_at/completed_at already give per-job labor.
9. **Route optimisation.** Geocode addresses (lat/lng columns exist),
   order a technician's day by drive time (Mapbox / Google Directions).
10. **Fleet management** — reuse the Turo vehicle model where a service
    business runs vans (maintenance, mileage, driver assignment).
11. **Payments** — Stripe payment links on completion; "collect payment" is
    a checklist step today.

## Design rules for anyone extending it

- **Industry = data.** If you find yourself writing `if (industry === …)` in
  a page, stop: put it in the template.
- **Every write logs.** Status changes, assignments and reschedules must hit
  `service_events` so the timeline stays complete without anyone remembering.
- **Pages check access first.** `verticalAccess("services")` before any query.
- **Browser-timezone output waits for mount** (`useMounted()` / `<When>`);
  the server renders in UTC.
- **The Butler is the operations manager.** New rules go in
  `src/lib/butler/tasks.ts` with a `dedupeKey`, so a re-run never files twice.
