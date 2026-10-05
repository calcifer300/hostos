# HostOS — Turo Ops Assistant — Project Status / Handoff

Chrome (MV3) extension built for a Turo host-team assistant. Monitors the
Booked reservations list and automatically flags two things: unverified
driver's licenses close to pickup, and trips earning below $0.20 per included
mile. Runs
in a persistent sidebar panel and an in-page floating widget.

Read this whole file before making changes — most of it documents real bugs
that were found and fixed through live testing, not speculation. Several
"obvious" approaches were tried and failed for specific, confirmed reasons;
re-reading this first avoids re-doing that work.

## Who this is for

John (the person in this chat) manages Matt's Turo host fleet (~90+
vehicles, Denver, CO) as an ops assistant. The two rules being automated
came directly from a WhatsApp conversation with Matt:
1. Verify guest licenses before pickup (guests can't upload until within 24h
   of pickup — flagging earlier is a false alarm).
2. Flag trips priced below $0.20/mile (bad economics — worth manually
   canceling before pickup) and zero-deductible ("Premier") protection plan
   bookings (host has no recourse for damage — same "consider canceling"
   logic).

## Current feature set

- **Pending Reviews** (2026-09-10): completed trips Matt has not rated, with Turo's data as badges
  (miles over, open reimbursement, other hosts' review text), problems marked
  by exception, notes, one-tap rating. In the panel,
  the popup, the 9 PM report and the badge. See the stage-one section.

The three queues are named **Unverified Licenses**, **Profit Risk** and
**Earnings Estimator** in the UI (`LABELS` in `modules/queueView.js`); the
internal filter keys remain `license`, `earnings` and `today`.

- **Unverified Licenses**: flags `licenseVerified === false` trips whose
  pickup is 0–24 hours away. Strictly upcoming only — a trip whose pickup
  already passed is not flagged (not actionable).
- **Profit Risk**: flags trips where `earningsPerMile < $0.20` — what the
  host EARNS divided by the miles included — OR a zero-deductible protection
  plan. Requires the trip to genuinely be in the future (`hasNotStarted`),
  since canceling isn't an option once it starts. **A trip whose earnings
  haven't been computed yet is never flagged**, because an unknown number must
  not read as a low one.
- **`pricePerMile` is the OVERAGE rate and triggers NOTHING.** It is the
  penalty for each mile *beyond* the allowance ("Brent can be charged $0.19
  for every mile over the total included"). Two earlier builds misused it:
  first displaying `estimatedMiles × pricePerMile` as "estimated trip
  earnings" (meaningless — it prices a trip where the guest drove double the
  allowance), then flagging on it, which reported a healthy $0.35/mile trip as
  a risk. It stays visible on the card as information only. See "Profit Risk
  tests EARNINGS per mile" below for how the real figure is reconstructed.
- Real trip earnings come from the **nightly rate** on the fleet calendar,
  over the columns the trip actually occupies (column 0 is today, so a trip
  starting in two days begins at index 2), plus extras. A Profit Risk card
  therefore needs `fleetAvailability` passed to `renderCard`, and falls back
  to "Visit the Calendar page to price this vehicle" when the vehicle hasn't
  been scanned.
- Every card shows the guest's protection plan, including "not checked yet",
  so an unchecked trip is never mistaken for one confirmed safe.
- **`totalDays` is not a fixed forecast window** — it's however many day
  columns Turo had rendered when the calendar was scanned. Measured at **34,
  then 27, then 26** on the same fleet; it moves with window width and zoom.
  **Never put that number in front of the user.** Two attempts did and both
  confused him:
  - "booked 25 of the next 27 days" — what is 27?
  - "13 free days in the next 26" — what is 26?

  Availability lines now name the **end date** instead, so every figure can be
  checked against the calendar: "Booked solid through Sat, Sep 19" or
  "Next free day: Mon, Sep 7 · 13 free days between now and Sat, Sep 19".
  Computed from `bookedDayFlags` (index 0 = today), last day = today +
  `length - 1`. If this needs rewording again, keep it anchored to dates.
- A trip longer than the calendar window is priced by projecting the visible
  nights across its full length (a 79-day trip from ~27 days of prices). The
  card says "projected from N days of prices" rather than presenting the
  extrapolation as an observation.
- **Earnings Estimator**: every trip due back today with its estimated
  value, then a highlighted day total, then **Cars Making Money** — all
  known vehicles sorted by the estimated value of their current trip, with
  idle and unpriced cars at the bottom. Requires having visited
  `turo.com/us/en/trips/calendar` at least once — that page is scraped
  separately (`content/fleetScanner.js`).
- **Available vehicles** stat: vehicles free both today and tomorrow, from
  the same Calendar scan.
- **"Scan now" button**: on-demand — finds a real open Booked tab (via
  `chrome.tabs.query` in the background; content scripts can't see other
  tabs) and asks it to scan itself. Says plainly if no Booked tab is open,
  with a click-to-open link, rather than silently doing nothing.
- **License reminder**: one-click "Copy reminder" button on License Risk
  cards copies a canned message (`HostOS.constants.LICENSE_REMINDER_MESSAGE`)
  for pasting into the guest message thread.
- **Persistent sidebar**: clicking the toolbar icon opens Chrome's Side
  Panel API (stays open across tab switches) instead of a popup that closes
  on click-away. `popup/popup.html` is reused as the side panel content.
- **Pause control**: the "Monitoring" indicator in both the sidebar and the
  in-page widget is a button. Clicking it sets `hostosPaused`, which
  `maybeStartNextScrape()` checks before anything else — so **no background
  tabs open while paused**. Unpausing resumes immediately via the
  `chrome.storage.onChanged` listener rather than waiting out the 10-minute
  alarm.
  **Pausing deliberately does NOT stop** the protection sweep, the activity
  feed, the Premier alerts to Matt, or the daily digest. None of those open a
  tab, and silently muting Matt's alerts because the host wanted the tab
  flashing to stop would be a nasty surprise. That's why the label reads
  "Tabs paused" and not a bare "Paused" — if this is ever reworded, keep the
  distinction.
  What does stop: everything the detail scan supplies — `licenseVerified`,
  `estimatedMiles`, `pricePerMile`, extras, and dates for trips the list scan
  hasn't covered.
- **Diagnostics without devtools**: the footer shows fleet stats, detail-scan
  progress (`completed/eligible`), and a "Last background scan: [outcome]
  #[reservationId] · [time]" line reporting success / timed-out / partially
  scanned / failed-to-open — built specifically so the user doesn't need to
  open the service worker console to tell if it's working.

## The service worker LOADS the shared modules — it no longer copies them

    self.window = self;
    importScripts("/utils/constants.js", "/utils/dates.js", "/utils/parser.js");

`parseTime`, `hasNotStarted`, `isWithinLicenseUploadWindow` and
`DETAIL_SCAN_VERSION` used to exist twice, kept aligned by "keep in sync"
comments. **The copies drifted twice** — the tripStatus fix and the null-date
fix each had to be applied in two places, and missing the second copy was a
real bug both times. Don't reintroduce a hand-written copy.

Notes: the manifest declares a **classic** service worker (no `"type":
"module"`), which is what makes `importScripts` available — adding
`"type": "module"` would break it. Paths are root-relative so they don't
depend on the file's own location. `self.window = self` aliases the global the
`utils/` modules expect, since they're written for a page context.

**Blast radius**: if this import fails the service worker dies entirely — no
alerts, no scans, no badge. After any change here, open
`chrome://extensions` → HostOS → "service worker" and confirm it starts clean.

## Card layout — a labelled grid, not stacked prose

Cards render a title/badge head, the trip window, an optional note, then an
aligned label/value grid (`.hostos-details` with `.hostos-key`/`.hostos-val`).
They previously stacked up to six prose lines and read as a paragraph — you
had to read the whole card to find one figure.

Money is picked out in bold colour at the **same font size** as its
surroundings: **green in the Earnings Estimator** (what the fleet is making),
**red on Profit Risk cards** (what needs a decision), including the overage
rate that triggered the flag. A weak or absent guest record is red too, so it
reads as part of the same decision. `hostos-money-green` must never appear on
a Profit Risk card and vice versa — there are tests for both.

## Two CSS traps in the card layout

- **`.hostos-result b { display:block }`** was set for the card title and
  therefore caught *every* `<b>` in a card — including the money spans, which
  each took their own line ("≈$105" / "$35" / "/day" stacked vertically). That
  rule is now scoped to `.hostos-result-head b`, and `b.hostos-money` sets
  `display:inline` explicitly. If money ever renders stacked again, look here
  first.
- **The queue was `position:fixed` with `max-height:300px`** — a small floating
  box with an empty sidebar beneath it, capped at a few tiles however tall the
  window was. `.popup` is now a flex column and `.hostos-results` is
  `flex:1 1 auto; min-height:0` in normal flow, so it stretches to the bottom.
  `min-height:0` is required: without it a flex child overflows its parent
  instead of scrolling.

Every tile that maps to a real reservation carries an **Open trip** button
(`openTripActions`). Idle vehicles deliberately get none — there's no
reservation page to open, and a dead button is worse than no button.

## Tests — run these before and after any change

**Two commands.** `node tests/run.js` (618 assertions) and `node tests/smoke.js`.
The smoke test EXECUTES `content/widget.js` and `background/service-worker.js`
against a fake browser with sample storage - opens every queue through the
real click path, sends the real nightly report through a fake relay and
checks every section, raises the notifications, runs the Premier alert
twice and expects one email. The unit suite only inspects those two files;
both were patched by string replacement more than once on 2026-09-12 and a
ReferenceError in either would otherwise surface only in Brave.

    node tests/run.js

`tests/run.js` is a regression suite; `tests/harness.js` is a dependency-free
runner that eval's the real source files into a minimal DOM, so nothing
test-only leaks into production code. **Almost every case in it corresponds to
a bug that actually shipped.** This project has a documented history of the
same class of bug returning — the read-then-write overwrite bug appeared three
separate times — and until now there was no net to catch it. Add a case
whenever you fix something.

## The guest's track record

`/api/v2/driver/detail?driverId={renter.id}` — the `driverId` comes from
`renter.id` on the reservation detail payload, which itself carries **no**
rating.

    ratingsFromCarOwners.overall      -> the star rating
    numberOfRatingsFromCarOwners      -> how many hosts rated them
    numberOfRentalsFromCarOwners      -> trips taken as a guest
    memberSince                       -> { month, year }

Verified against reservation 57760996: Johennie reads **1.0★ over a single
trip, joined May 2026** — matching the page exactly. That's the guest who cost
Matt a windshield on a Premier plan, and the extension had no idea. Now shown
on Profit Risk cards and in the Premier email.

Fetched **once per trip** (gated on `guestCheckedAt`) — a guest's history
barely moves over the life of a booking. A failed guest lookup is caught
separately so it can never cost us the protection plan, which is the reason
that sweep exists.

`no ratings yet` is deliberately distinct from a low score: unrated and rated
badly are different things to put in front of a host.

## Architecture

- `manifest.json` — MV3, permissions: storage, notifications, alarms, tabs,
  sidePanel. Content scripts match `turo.com`/`www.turo.com`, run at
  `document_idle`.
- `content/scanner.js` — the core scraper. `scan()` branches on whether
  `location` is a reservation detail page (`buildDetailTrip`) or the Booked
  list (`buildTrip` per card + `findDateSections`/`dateForCard` to anchor
  each card to its date-section header). `mergeTrip` merges onto existing
  storage rather than replacing (critical — see Bugs Found below).
- `content/fleetScanner.js` — separate scraper for the Fleet Calendar page
  only. Recovers vehicle rows / day columns by sorting actual on-screen
  pixel offsets rather than assuming fixed values.
- `content/observer.js` — MutationObserver + 5-min fallback timer, triggers
  re-scans of the live Booked page.
- `content/widget.js` — the floating in-page panel. Skips itself entirely
  in a background-scan tab (`?hostos_bg=1` marker) or when
  `document.getElementById("hostos-widget")` already exists.
- `content/content.js` — bootstrap. Detects the `hostos_bg=1` marker
  (background-scan tab) and takes a completely different, simpler path in
  that case — see "Background scanning" below.
- `content/protectionScanner.js` — reads the GUEST's protection plan from
  Turo's JSON API by same-origin fetch (no background tab). This is the only
  correct source for the Premier check; see "The guest's protection plan"
  below before touching it.
- `modules/riskEngine.js` — pure function, `enrich(trip)` computes
  `earningsRisk`, `premierProtection` and `riskReasons` from `pricePerMile`
  and `protectionLevel`. It must never read `hostDamageResponsibility` —
  that's Matt's own deductible, and misreading it as the guest's plan was a
  real bug that silently disabled the Premier check entirely.
- `options/options.html` + `options.js` — alert settings (Apps Script web app
  URL, recipients) and the script to paste into script.google.com.
- `modules/licenseMonitor.js` — pure function, license urgency from
  `licenseVerified` + `HostOS.dates.isWithinLicenseUploadWindow`.
- `modules/queueView.js` — shared between the popup/sidebar (`popup.html`)
  and the in-page widget. Grouping, card rendering, the vehicle-earnings
  section. Loaded via `<script>` tag in `popup.html` (not a content-script
  chain) and via manifest content_scripts for the widget.
- `background/service-worker.js` — alarms, notifications, badge, and the
  background detail-scan queue (see below). No access to `HostOS.*` modules
  (standalone script) — several small helper functions are deliberately
  duplicated here with "kept in sync with utils/dates.js" comments. If you
  change the logic in `utils/dates.js`, grep for the matching function name
  in this file and update both.
- `popup/popup.html` + `popup.js` + `popup.css` — doubles as both the
  toolbar popup markup and the side panel content (`side_panel.default_path`
  points at the same file).

## Background scanning — read this before touching it

This was the single hardest problem in the whole build. Three approaches
were tried, in order, each ruled out by **actual evidence**, not
assumption:

1. **Hidden iframe on the live Booked page** (the original, pre-existing
   approach) — never worked. Assumed at the time to be `X-Frame-Options`
   blocking, but this was never cleanly isolated — other real bugs (see
   below) were present simultaneously and could equally explain the
   symptom.
2. **`chrome.offscreen` document with an iframe inside it** — a real
   attempt at a fully invisible mechanism (offscreen documents are
   guaranteed never rendered, and are explicitly designed for scripting
   iframes). **Confirmed dead**: the service worker console showed the
   exact same reservation timing out identically on every single retry,
   never once succeeding. That's Turo's own framing protection, applied
   even to a same-extension offscreen document. This cannot be worked
   around — don't re-attempt an iframe-based approach.
3. **`chrome.windows.create` with `state: "minimized"`** — also abandoned;
   never confirmed whether a window created directly minimized reliably
   executes scripts at all (real risk, not tested cleanly before moving on).

**What's actually running now**: `chrome.tabs.create({ url, active: false })`
— a real background tab. It can briefly flash open/closed in the tab strip.
This is a deliberate, user-agreed function-over-cosmetics tradeoff — there
is no known invisible alternative that works against Turo. If asked to make
it invisible again, say so plainly rather than re-attempting iframes or
minimized windows without new evidence.

### The queue mechanism (`background/service-worker.js`)

- `maybeStartNextScrape()` — single-flight (one tab at a time), triggered by
  `chrome.storage.onChanged` (on `hostosTrips`), a 10-min `chrome.alarms`
  backstop, and manual "Scan now".
- Advancement is driven by `chrome.tabs.onRemoved` (a real browser event),
  **not** an internal timer. Earlier versions used `setTimeout`-based
  polling entirely inside the service worker and awaited it across a whole
  batch — MV3 service workers can be silently terminated by Chrome whenever
  they look idle, which discards any pending `setTimeout` and everything
  waiting on it. This was a real, confirmed contributing cause of "only
  works when I visit manually" — a manual visit is an ordinary tab, never
  subject to service-worker termination.
- `eligibleForDetailScan(trip)`:
  - Requires `trip.tripUrl`.
  - Requires pickup/return within `DETAIL_WINDOW_MS` (72 hours) — re-added
    after initially removing the cap entirely; unscoped scanning meant a
    near-constant stream of background tabs for trips weeks out. If asked
    to widen this again, it's a one-line change, but expect more frequent
    tab activity as a direct tradeoff.
  - `in_progress` trips are always eligible (they have no pickupDate from
    the list scan — see Bugs Found — so the date check alone would wrongly
    exclude them).
  - Rescan cooldown: `FLAGGED_RESCAN_MS` (5 min) for trips *currently*
    showing as a risk, `DETAIL_RESCAN_MS` (30 min) otherwise. A flagged
    trip needs fast correction (e.g. a host confirms a license, the flag
    should clear within minutes, not up to 30).
  - A scan under an older `DETAIL_SCAN_VERSION` never counts as "recently
    scanned" — forces a fresh look at previously-cached (possibly
    bug-affected) data immediately rather than waiting out the cooldown.
    **Bump `DETAIL_SCAN_VERSION` in both `utils/constants.js` and
    `background/service-worker.js` (kept manually in sync) whenever a fix
    changes what a detail scan reads or how it's interpreted** — this
    forces a one-time full re-verification pass of the whole cached
    dataset, which is the only way stale/wrong cached data actually
    self-corrects. Expect a burst of background-tab activity right after a
    version bump; it's temporary.
  - `trip.detailScanComplete === false` also bypasses the cooldown — see
    Bugs Found, "reads before Turo finishes loading."
- `content.js`'s background-scan branch (`hostos_bg=1` present): waits for
  real content via `MutationObserver` (not `setTimeout` — Chrome throttles
  timers in background/unfocused tabs, which this tab is from the moment
  it's created) with a 15s fallback, then reports `complete: true/false`
  back to the background depending on whether the wait actually succeeded
  or the fallback fired. Skips the widget/observer entirely in this mode.

## Bugs found and fixed (read before assuming something is new)

- **List-scan storage overwrite**: `scan()` on the Booked list page used to
  rebuild `hostosTrips` from *only* the currently-DOM-rendered cards
  (Turo's list is virtualized) and save that as the whole array — silently
  deleting detail data for every trip not currently on screen, including
  ones a background scan had just finished. Fixed: merges onto the full
  saved set (`content/scanner.js`).
- **In-progress trips have no date**: a card showing "In progress" matches
  neither "Starting at" nor "Ended at", so `buildTrip` never sets
  pickupDate/returnDate for it. This silently broke eligibility checks in
  several places over the course of the build; the fix is always to
  special-case `tripStatus === "in_progress"` rather than relying on the
  date fields for it.
- **Reads before Turo finishes loading**: Turo is client-rendered — data
  loads after `document_idle`, not with it. A background scan reading
  immediately would very likely capture an empty/still-loading page, then
  still stamp it as "recently scanned," blocking retry for the full
  cooldown. Fixed with the `MutationObserver` wait in `content.js` described
  above, plus `detailScanComplete` tracking so an incomplete read is never
  mistaken for a real success.
- **Date-section false positives**: `findDateSections()` originally
  accepted *any* short, standalone element whose text merely happened to
  parse as a valid `Date` and contain 4 digits — a stray element like a
  lone vehicle-year badge ("2026") could get misidentified as a date-section
  header, and `new Date("2026")` parses as **January 1, 2026**, corrupting
  every card's date anchored beneath it. Fixed with a strict regex requiring
  the exact `"Weekday, Month Day, Year"` format
  (`DATE_HEADER_PATTERN` in `content/scanner.js`).
- **Year-wraparound over-correction**: `scheduleDateTime()`'s logic for
  handling a December-booked-for-January trip (Turo's schedule text omits
  the year) rolled the year forward if the computed date was merely more
  than **24 hours** in the past. That's far too sensitive — it also fired
  for any completely ordinary trip that simply happened a few days ago,
  silently bumping it a full year into the future. Fixed: threshold raised
  to 270 days, so only a real year-boundary case triggers the correction.
- **`chrome.windows.create` bounds validation**: passing custom
  off-screen `left`/`top` values caused Chrome to reject the call outright
  ("Bounds must be at least 50% within visible screen space") — confirmed
  via the service worker console. Not relevant to current code (moved to
  `chrome.tabs.create`), but if window-based approaches are ever
  reconsidered, don't pass custom off-screen coordinates.
- **Reloading the extension ≠ reloading the page**: Chrome does not
  re-inject updated content scripts into tabs that were already open before
  an extension reload. Confused several rounds of "I reloaded and it's
  still broken" — always ask whether the *page*, not just the extension,
  was refreshed when a fix doesn't seem to take effect.

## Earnings estimates — what Turo will and won't give this account

Verified live on 2026-08-25 by inspecting the real pages, not by guessing:

- **There is no payout figure anywhere this account can reach.** The
  reservation detail page has no trip total (its `EARNINGS PLAN` section is
  just the plan name plus `Damage responsibility: $2,750.00`), the
  per-reservation `invoice-hub` is only for raising post-trip damage/cleaning
  invoices, and `/us/en/earnings` refuses outright with *"In order to
  complete this action, you must have a vehicle listing"* — John is a co-host
  on Matt's fleet and owns no listing. **Don't go looking for a real earnings
  API again; it isn't reachable.**
- **The fleet calendar's daily prices are the only money data available**, and
  they are gross list price — Turo's 10–40% cut is not deducted. Every place
  a figure is shown says "estimated" and the daily total says "gross, before
  Turo's cut". Keep that labelling on any new surface.
- **The calendar renders today forward only** (34 columns, 64px each, column
  0 = today). A trip's past days are simply not in the DOM, and there is no
  URL parameter for a past range — only an in-app back button. So a trip
  ending today has essentially none of its value on the page.
- Given all of the above, the estimate is deliberately
  `trip length × the vehicle's observed nightly rate`, where trip length comes
  from the reservation page schedule (exact) and the rate from the calendar
  columns the trip occupies. It is an estimate and is labeled as one. Do not
  quietly upgrade it to look authoritative.
- **Trip length needs `pickupDate`, which only a detail scan supplies**, and
  detail scans only run within the 72h window. So active trips returning
  further out show "On a trip · returns …" with no figure. Making all active
  trips eligible is a one-line change in `eligibleForDetailScan`, but there
  are ~85 of them, so expect ~85 background tabs on the first catch-up —
  confirm with the user before doing it.

## The guest's protection plan — and the bug that hid it

**The old `zeroDeductibleProtection` check never fired, for any trip, ever.**
It read the reservation page's `Earnings plan → Damage responsibility: $X`
and treated `$0` as the guest holding a zero-deductible plan. That figure is
the **host's own deductible** under Matt's earnings plan. Verified against
reservation **57760996** — the Premier booking Matt actually lost money on —
which reads `Damage responsibility: $2,750.00` (the same $2,750 he quotes in
WhatsApp) while the guest held a $0 Premier plan. The words "Premier",
"protection plan" and "out-of-pocket" appear **nowhere** on that page.

It's now stored as `hostDamageResponsibility`, which is what it actually is.

**Where the guest's plan really lives**: the car sharing agreement
(`/reservation/{id}/car-sharing-agreement`) shows it as
`PROTECTION PLAN Premier / OUT-OF-POCKET MAXIMUM $0` — but better, that page
is powered by a JSON endpoint that returns it as a structured enum:

    /api/reservation/detail?oppTermsAware=true&reservationId={id}

**Turo's internal enum does not match the names guests see. Read this before
touching the premier check:**

| `protectionLevel` | Shown to the guest | `maxOutOfPocket.amount` |
| ----------------- | ------------------ | ----------------------- |
| `SUPREME`         | **Premier**        | **0**  ← the alert case |
| `PREMIUM`         | Standard           | 500                     |
| `DECLINED`        | Not protected      | `null`                  |

**`PREMIUM` is NOT the top plan — it is Standard.** Keying the alert on
`"PREMIUM"` would flag precisely the wrong trips and miss every real one.
The check is `protectionLevel === "SUPREME"`, with `maxOutOfPocket === 0` as
a second signal so an unseen level name that still carries a $0 excess is
caught anyway. Levels beyond these three haven't been observed; anything
unrecognised with a non-zero excess is simply not flagged.

Verified on 2026-08-25 by cross-checking the API against the car sharing
agreement page for reservation 60472938 — the agreement renders "Standard /
$500" and the API returns `PREMIUM` / `Standard` / `500`. Same data, same
source.

`content/protectionScanner.js` reads it. Notes:

- **This is a plain same-origin fetch (~17KB, 30–800ms) — no background tab
  and no wait for Turo to render.** It is the one mechanism found in this
  whole project that gets reservation data without a visible tab, so the
  "no invisible background scanning is possible" limitation above does not
  apply to the fields this endpoint carries.
- Because it's cheap, protection is checked for **every** known trip rather
  than only those inside the 72-hour detail window — Matt needs to hear about
  a Premier booking when it's made, not three days before pickup.
- It is **undocumented and internal**. It could change or vanish without
  notice, so consecutive failures are counted into `hostosProtectionStatus`
  rather than leaving protection silently unknown forever. The DOM scrapers
  were deliberately left in place rather than migrated onto it.
- The same payload also carries `distanceOverageFee.money.amount` (the
  per-mile rate), `tripStart`/`tripEnd`, and `guestDriverLicenseApprovedAt` —
  all currently still scraped from the DOM. Migrating those was considered
  and deferred; see "Discussed but not built".

## Turo's notification feed — new bookings in near real time

`content/activityScanner.js` polls the endpoint behind
`turo.com/us/en/inbox/notifications`:

    /api/feeds/activity?driverRoles=HOST&itemsPerPage=30

`driverRoles` is **required** and must be `HOST` (`OWNER` returns 400).
Each activity carries a `reservationId` outright:

    title:         "(MATTHEW's vehicle) - Booked trip"
    message:       "Reginald's trip with your Nissan Sentra is booked..."
    reservationId: 60696601
    created:       1787684214275   (epoch ms)

Observed titles: **Booked trip**, Prepare for checkout, New message, Guest
checked out. Only bookings are acted on. The title is prefixed with the host's
name, so match the event part (`/\bbooked trip\b/i`), never the whole string.

**Why it matters**: without this, a new booking reaches the protection check
only after its card *renders* in the virtualised Booked list (often needing
the host to scroll), then a list scan picks it up, then it queues behind 100+
reservations. Ten-plus minutes at best, indefinite at worst. The feed gives
the reservation id immediately, so a Premier plan is caught about a minute
after booking — which is the entire point, since Matt wants to cancel before
pickup. It also sidesteps the "discovery requires the card to have rendered"
limitation for new bookings specifically.

Notes:

- A booking whose card has never rendered gets a **minimal trip record**
  (reservationId, guest, vehicle, plate, plan, tripUrl). That's enough for the
  alert. `pickupDate`/`returnDate` stay null, so it won't appear in the Profit
  Risk queue until a list or detail scan supplies dates — the email is the
  time-critical part, the queue entry isn't.
- `vehicle.registration.licensePlate` on the reservation detail payload gives
  the plate directly (`EJQN55`, `DWIS75`), so a feed-discovered trip can still
  be matched to its calendar row.
- **`tripStart` / `tripEnd` exist on that payload but are always `null`** —
  don't reach for them, dates still come from the list/detail scan.
- First run only looks back 24 hours, so enabling this can't replay old
  bookings as fresh alerts. After that a `lastCreated` high-water mark in
  `hostosActivitySeen` bounds it.
- `protectionLevel` can legitimately come back **null** (seen on 60676408).
  The card says "not stated by Turo for this trip" rather than "not checked
  yet", so it doesn't contradict the footer's plans counter.
- It is a **change signal, not a backfill** — the feed holds only recent items.
  The list scanner remains the source of truth for the fleet as a whole.

## Alerting Matt (Apps Script)

Matt asked for an automation that tells him when a guest buys Premier so he
can cancel the trip. `background/service-worker.js` posts to a Google Apps
Script web app, configured in `options/options.html`:

- **Premier → immediate**, once per reservation, and only marked as sent on
  a successful POST so a delivery failure retries rather than being lost.
  **Gated on `hasNotStarted`** — the point is to cancel *before* pickup, so a
  started or finished trip is noise. This fired once on reservation 57760996
  (Johennie / Subaru Ascent), a trip that had run Aug 7–21 and was long over,
  with "Pickup: unknown, Return: unknown" in the body because a finished trip
  carries no pickup date from the list scan. The gate is deliberately strict:
  **unknown dates do not count as upcoming.** A feed-discovered booking is
  briefly dateless but is immediately eligible for a detail scan, so the alert
  lands one scan later rather than being sent wrong — and Pickup/Return are
  always real values in the email.
- **Everything else flagged → one nightly report at 21:00 America/Denver**,
  timed to John clocking out; it's his turnover report. Pinned to Colorado
  time via `coloradoNow()` rather than the machine clock, and **polled on a
  5-minute alarm** instead of a one-shot alarm at 21:00 — a fixed alarm only
  fires if Chrome is awake at that exact moment, and an absolute time needs
  recomputing across DST. `hostosLastDigestDate` stores the *Colorado* date,
  so a machine in another timezone can't roll it over early or late.
- **Two recipient lists**: `urgentRecipients` (Premier, and the test button,
  since that exists to prove the urgent path) and `recipients` (nightly
  report). Each falls back to the other so a half-filled config can't send
  nowhere. Both default to the two Colorado Cruisers addresses.
- Emails are branded **Colorado Cruisers** in subject and first line.
- The nightly report ends with a note saying Premier bookings are **not**
  listed there and arrive as a separate immediate email. Without it a quiet
  report could be read as "no Premier bookings today", when in fact they never
  appear in it at all — waiting until 9 PM to mention one would be far too
  late to cancel it.
- **`chrome.notifications` needs an absolute `iconUrl`.** A relative path
  fails from a service worker with "Unable to download all specified images",
  which showed up live as repeated unhandled rejections — every Chrome
  notification had been failing silently. Use
  `chrome.runtime.getURL("assets/icon-128.png")`, and note that a notification
  is only recorded in `hostosNotified` once it actually appeared, so a
  failure retries rather than being swallowed.
- **The extension composes subject and body; the Apps Script is a dumb
  relay.** Wording used to live in the script, so every copy change meant
  re-pasting it into script.google.com *and* cutting a new deployment version
  — and forgetting that second step silently kept sending the old format,
  which looks exactly like "my change didn't apply". Wording changes now need
  only an extension reload.
  **Editing Apps Script code does NOT change what the /exec URL runs.** You
  must do Deploy → Manage deployments → pencil → Version: New version. The
  URL is unchanged by this, so it never needs re-pasting into the extension.
- The POST body is a **superset**: it carries `subject`/`body` for the relay
  AND the original `trip`/`rateRisks` fields the older self-composing script
  reads. An already-deployed v1 script therefore keeps working untouched, and
  upgrading to the relay is optional rather than a forced re-paste.
- The relay returns `{ ok, version }`. `postAlert` records `deployedVersion`
  against `SCRIPT_VERSION`, and the options page reports a lagging deployment
  as information rather than an error, since v1 still sends correct email.
- No email/SMS API key is embedded in the extension — the folder is shared
  with other people, and an extracted key could send mail as the company. The
  Apps Script deploy URL is write-only and rotatable.
- Delivery success/failure is written to `hostosAlertStatus` and shown on the
  options page. **A silently failing alert is worse than none**, because Matt
  would read "no alerts" as "no Premier bookings".

**Two paths run the protection check, and only one is guaranteed:**

- **A Turo tab is open** → `content/protectionScanner.js` does it. A genuine
  same-origin request, so the session always attaches. 15 per sweep, every
  90s (an earlier 5-per-3-minutes would have taken over an hour to cover
  ~120 reservations once, which is why cards sat on "not checked yet").
- **No Turo tab** → `sweepProtection()` in the service worker fetches
  directly, every 2 minutes. Extension requests come from the extension's own
  origin, so whether Turo's session cookie is attached depends on its
  SameSite setting — **this was not verifiable from the dev environment**. The
  response's content type is checked (an unauthenticated request returns
  Turo's login HTML, not JSON), a batch aborts on the first auth failure
  rather than hammering, and `hostosProtectionStatus` records the hint "Open
  a Turo tab so protection plans can be checked." If it turns out cookies
  aren't attached, that status is how you'll know.

The sweep skips itself entirely when a Turo tab is open, so the two paths
never race on `hostosTrips`.

`isPremier` is duplicated in the service worker and used directly by
`alertPremierTrips`, rather than reading the stored `premierProtection` flag —
an alert must not depend on a content script having re-enriched the trip.

The footer shows `plans checked/total` across trips that could still be
canceled, so "not checked yet" is visibly a backlog draining rather than
something quietly stuck.

**Coverage limit, and Matt should be told this plainly**: the extension only
runs while John's Chrome is open. A Premier booking made overnight is caught
when the browser next opens, not at booking time. True 24/7 coverage would
need something server-side holding a Turo session.

## Profit Risk tests EARNINGS per mile — not the overage rate

**The bug Matt caught.** `pricePerMile` is Turo's **overage** rate: the penalty
for driving past the mileage allowance. It says nothing about what a trip
earns. Flagging on it reported reservation 60634202 — a healthy **$0.35/mile**
trip — as a risk, because its overage rate happened to be $0.19. Matt's actual
rule is **what he earns ÷ miles included**.

Turo shows a co-host **no payout figure at all**: `booking.cost`,
`booking.costWithCurrency` and `booking.hostShare` are all nulled, there is no
receipt endpoint (404/500 on every variant), and `/us/en/earnings` refuses.
So `HostOS.earnings.compute` reconstructs it. Every input except the nightly
rate is exact, and the chain reproduces that receipt **to the cent** — note
that the $160 base is **4 days** at $40, because Turo bills the trip's 3 days
3 hours as four (see "Billed days round up" below):

    $155.20  nightly rate after the 3% length discount
    x 0.90   non-refundable discount        = $139.68
    + $55    extras
    + $120   delivery fee                   = $314.68   (= TRIP TOTAL)
    x 0.90   hostTakeRate                   = $283.21   (= YOU EARNED)
                                            /800 miles  = $0.354/mile

Where each input comes from:

| Input | Source |
| ----- | ------ |
| `hostTakeRate` (0.9) | `/api/vehicle/detail` → `currentVehicleProtection.hostTakeRate` |
| length discount % | same call → `dateRangeRate.rentalPriceDiscountPercentage` |
| delivery fee | same call → `vehicleDeliveryLocations[].fee.amount` |
| non-refundable | reservation → `cancellationPolicyType === "NON_REFUNDABLE"` |
| included miles | reservation → `booking.mileageLimit` |
| extras | reservation page `.extraDetails` |
| nightly rate | fleet calendar — **the only approximation** |

Notes for anyone touching this:

- **Join the delivery fee on `locationId`**, not the location's name. The
  reservation's `location.locationId` matches `vehicleDeliveryLocations[].locationId`
  exactly (7896174 → Denver International Airport → $120).
- `/api/vehicle/detail` is the **public listing** endpoint — no owner
  permissions needed, which is the whole reason this works from a co-host
  account.
- Its `dateRangeRate.rentalPrice` is **today's asking price**, not the rate
  locked in at booking (Brent booked at $40/day; the listing later quoted
  $47.25). That is why the base rate comes from the fleet calendar instead.
- **KNOWN GAP: free delivery is not modelled.** The delivery fee is added
  unconditionally, but Turo's host-side Locations page
  (`turo.com/us/en/vehicles/settings/locations`, Beta) has a **"Free delivery
  for"** column — so a location can waive the fee above some threshold. Any
  trip that qualifies is currently **over-estimated by the full fee** (~$120,
  around 40% on a trip the size of reservation 60634202), and that figure
  reaches the nightly report. Brent's 4-day trip WAS charged the fee, so it
  doesn't apply universally, but it does mean some trips read high today.
  That page also shows an "Applies to" column (fees may vary by vehicle group)
  and would likely expose a bulk endpoint — every location and fee in one
  call, rather than one `/api/vehicle/detail` per trip. Worth investigating
  before trusting per-trip figures to the dollar.
- **`NON_REFUNDABLE_DISCOUNT = 0.10` was derived from a single receipt**
  ($15.52 off $155.20). If an estimate is ever off on a non-refundable trip,
  check that constant first. The card prints the breakdown line by line so it
  can be compared against a receipt directly.
- `earningsPerMile` is computed once, during the protection sweep, and stored
  on the trip — the panel, notifications, Premier alert and nightly report all
  read that one number. The service worker cannot run `riskEngine` at all, so
  nothing may re-derive it.
- **A missing `earningsPerMile` never flags.** An uncomputed number must not
  read as a low one; that is exactly how the original bug produced false
  positives.
- The overage rate stays **visible** on the card, because it is worth knowing,
  but it triggers nothing.

## Guest extras — per trip vs per day

A reservation can carry guest-purchased extras (EV recharge, booster seat).
Confirmed live on 2026-08-25 against reservations 60634202 and 60451879:

- Markup uses **real semantic class names**, not `css-xxxxx` hashes:
  `.extraDetails` repeats once per extra, with `.extraDetails-description`,
  `.extraDetails-details` (the price) and `.extraDetails-availability` (the
  quantity, and **absent entirely when there's no quantity**).
- **Turo prints the billing unit as its own element** — `$55` then `/trip` —
  so per-trip and per-day extras are distinguishable and must not be
  conflated. `/trip` is charged **once for the whole booking**; only `/day`
  multiplies by trip length. Treating a $55/trip extra as per-day would
  overstate a 10-day booking by $495. Both extras found on this fleet were
  `/trip`; `queueView.extrasValue` handles either, times quantity.
- Extras are added on top of both estimates — the Profit Risk card
  (`miles × rate + extras`) and the Earnings Estimator
  (`avgDaily × days + extras`) — so the two surfaces agree about the same
  trip.

**Colorado Cruisers offers seven extras, all priced per trip**: Camp chair
$15, Stroller $40, Air mattress $40, Prepaid EV recharge $55, Booster seat
$20, Child safety seat $40, Pet fee $40. **Prices differ per booking** — the
same Child safety seat listed at $40 was $45 on reservation 59799765 — so they
are always read from the reservation, never from the listing.

**An active trip must be detail-scanned or its extras count as zero.** Extras
live only on the reservation page. A long rental already under way and
returning beyond the 72-hour window matched none of the eligibility checks, so
it was never scanned and its extras silently contributed nothing while the
tile still showed a confident total. `eligibleForDetailScan` now admits any
active trip that has never been detail-scanned — one-shot, since it stops
qualifying once `detailScannedAt` is set.

The vehicle tiles also **itemise extras on their own row**. The total always
included them, but with nothing naming them there was no way to tell whether a
guest's add-on had been counted, which reads as "my extra is missing" when it
isn't. If a figure is derived from something, show the something.

**Render timing**: polling a loading reservation page showed all 12 section
labels, the mileage figure and the extras block appearing **together**
between 5.5s and 6.5s — never partially. So once any `.detailsSection-label`
exists, an absent extras block genuinely means none were bought. Before that,
`buildExtras` returns `null` rather than `[]`, so the 15-second fallback path
in `content.js` (which scans whether or not the page rendered) can't wipe
extras a previous scan captured.

## tripStatus is NOT a reliable signal — read this before using it

**Turo lists the same trip twice.** Once both ends fall inside the list's
range, a reservation renders under its pickup date as "Starting at 3:30 PM"
*and* again under its return date as "Ending at 4:00 PM". Confirmed live:
**149 cards for only 89 reservations, 60 of them appearing twice.**

`scan()` walks the cards in DOM order and merges by `reservationId`, so the
later "Ending" card overwrites `tripStatus` — leaving an ordinary **upcoming**
trip stored as `tripStatus: "ending"`. The status really means "the last card
seen for this trip was its end", not "this trip is running".

This caused a real regression: `hasNotStarted` was changed to treat "ending"
as already-started, which rejected all 60 upcoming trips, drove "booked" to 0,
and emptied the Profit Risk queue entirely.

**Judge a trip from its dates, never from `tripStatus`.** The two cards
between them supply both dates correctly. `utils/dates.js` exposes
`parseTime`, `hasNotStarted`, `isActive`, `hasReturned` and `tripDayCount`
for exactly this, and `background/service-worker.js` keeps a synced copy of
`parseTime`/`hasNotStarted`.

Also note `new Date(null).getTime()` is **0, not NaN** — a finite value that
passes `Number.isFinite` and silently reads as January 1970. That is why
`parseTime` exists and why every date check goes through it; a missing date
must be `null`, not a number.

## Trips that ended today could never be priced

Reported as "it stopped scanning for estimated earnings" while the host was
sat on the Calendar page watching the very vehicle the card told him to go
and price. Two faults stacked:

1. **A just-ended trip was permanently ineligible for a detail scan.** Its
   Booked-list card reads "Ended at 5:30 AM", which yields a **return date and
   no pickup date**. `eligibleForDetailScan` only looked *forward*, so with
   both dates in the past nothing ever scheduled it — it never learned its
   start date, `tripDayCount` stayed null, and `estimateTripValue` returned
   null forever. That is exactly the set of trips the Earnings Estimator's
   daily roll-up exists to report on. Now eligible when `pickupDate` is
   missing and the return was within `DETAIL_WINDOW_MS`, scoped so it's a
   one-shot catch per trip rather than a standing re-scan of history.
2. **The "no estimate" message named the wrong cause.** It said "visit the
   Calendar page to price this vehicle" whenever a plate was known, so it sent
   the host to a page that couldn't help. `missingEstimateReason()` now
   distinguishes missing plate / missing trip dates / genuinely unscanned
   vehicle, and only mentions the Calendar page for the last one — naming the
   plate to scroll to.

**Lesson**: a "can't compute X" message must name the input that's actually
missing. Guessing the cause from whatever field happens to be present sends
people to fix the wrong thing, and makes a working system look broken.

## Audit findings (2026-08-25, after the activity-feed build)

Three more, all in the newest code:

1. **Feed-discovered trips were a permanent dead end.** A booking found via
   the activity feed has no dates until a detail scan supplies them — but
   `eligibleForDetailScan` judged eligibility *from* the dates, so a trip with
   neither would never be scanned and therefore never get any. It sat forever
   with a plan and nothing else, invisible to the Profit Risk queue. Trips
   with no dates at all are now always eligible.
2. **The activity scanner could clobber a concurrent list scan.** It read the
   trip list, then spent seconds on network calls, then wrote the whole array
   back — discarding anything saved meanwhile. Same overwrite bug as the
   list-scan and fleet-scan ones before it. All lookups now happen *before*
   storage is read. **This project has now hit that bug three times: read
   late, write immediately.**
3. **Background writers were faking scan freshness.** The protection sweep and
   activity scanner both called `saveTrips`, which stamps `hostosLastScan` —
   the footer's "scanned Xs ago", which is how the host judges whether the
   page scan is alive. A stalled list scan would still have looked healthy.
   `saveTrips(trips, { silent: true })` now skips the stamp, and both
   background writers use it.

## Audit findings (2026-08-25, after the alerting build)

Seven bugs, all from the same root cause: **`sweepProtection` in the service
worker writes protection fields without running `riskEngine`** (a standalone
script can't load it), so a Premier booking found while no Turo tab was open
had `premierProtection: true` but `earningsRisk: false` and empty
`riskReasons`. Anything keyed on `earningsRisk` silently ignored it.

1. **Premier trip never appeared in the Profit Risk queue.** Matt would get
   the email while John's panel showed nothing. `computeGroups` now tests
   `earningsRisk || premierProtection`.
2. **Premier card lost its call to action.** The earnings line *overwrote*
   `detailLine` after the "consider canceling" warning was assigned, so the
   one thing the host is meant to act on vanished. The warning now leads and
   the money follows — the worst of the seven, since it defeated the feature's
   whole purpose.
3. **Malformed card text** — `riskReasons.join(" · ")` on an empty array
   rendered a dangling " — consider canceling…". No longer assembled from
   `riskReasons` at all.
4. **No Chrome notification** for a sweep-discovered Premier trip
   (`notifyForTrips` keyed on `earningsRisk`); now `|| isPremier(trip)`.
5. **Digest double-reporting** — `sendDailyDigest` filtered on the stored
   `premierProtection` flag rather than `isPremier`, so a trip could be both
   immediately alerted and digested. 
6. **A day's digest could vanish.** The 8 AM alarm only fires if Chrome is
   running at 8 AM; the old code just rescheduled for the next day, silently
   skipping. `maybeSendDigest()` now runs on the first wake after 8 AM on a
   day with no digest yet, tracked by `hostosLastDigestDate`, and records the
   date only once the send actually succeeded.
7. **Retry storm risk.** `alertPremierTrips` runs on every `hostosTrips`
   write — which is every few seconds while a Turo page is open — and retried
   every unsent alert each time. A misconfigured webhook would have meant a
   sustained POST flood at Apps Script. Now a 5-minute in-memory backoff after
   any failure; the manual test alert bypasses it via `{ force: true }`.

Also: `hostosNotified` and `hostosAlerted` only ever gained keys. Both are now
pruned at 90 days, well beyond any live reservation.

**The general lesson for this file:** the service worker cannot use
`HostOS.*`. Anything it writes must either carry every derived field the UI
reads, or the UI must derive that field defensively. Prefer the latter — the
UI already has `riskEngine`.

## More bugs found and fixed (2026-08-25)

- **"0 active" against a fleet with 85 trips out.** Turo's Booked list never
  renders the words "In progress" — an on-rent trip's card reads
  `Ending at <time>` (live counts: 85 ending, 60 starting, 4 ended). The
  panel counted only `tripStatus === "in_progress"`, which nothing ever set.
  Fixed via `HostOS.dates.isActive`, which prefers real dates and falls back
  to the `ending` status. The earlier note about in-progress cards having no
  date still holds and is now explained: an "Ending at" card yields a return
  date only, never a pickup date.
- **The calendar scan discarded most of the fleet.** That grid is virtualized
  *vertically* too — only ~15 of the 40+ vehicle rows exist in the DOM at
  once — and `fleetScanner` overwrote storage with just those. Same bug class
  as the list-scan overwrite. Now merged by plate so coverage accumulates as
  the host scrolls. This is why the "available" count used to drift between
  scans.
- **License checks could never fire on a long trip.**
  `eligibleForDetailScan` computed its window from
  `new Date(trip.returnDate || trip.pickupDate)` — taking the return date
  whenever one existed and ignoring the pickup entirely. A trip picking up
  tomorrow but not due back for two weeks therefore sat outside the 72h
  window and was never detail-scanned, so its `licenseVerified` stayed null
  forever; and since the license check only fires within 24h of pickup, that
  trip could never be flagged at all. Now eligible if **either** date is
  inside the window.
- **Notification key collision**: a trip flagged for both license and
  earnings risk only ever notified for license, because the key used a
  license/earnings ternary on one reservation id. Now one key per risk type.
- **Stuck "in-progress" scan status**: if a background scan tab closed for any
  reason other than success or timeout, the footer stayed frozen on "checking
  reservation…". `chrome.tabs.onRemoved` now records a `closed-early` result.

## "Scan failed" while the page was still scanning (2026-08-26)

Reported as "it is no longer scanning even after reloading the Booked tab",
with the footer showing a scan from a minute earlier — the panel contradicting
itself. Four separate defects, all in the manual-scan path, none of which the
suite covered:

- **"Scan now" only ever tried one Booked tab.** `runManualScan` took
  whichever tab `chrome.tabs.query` happened to return first and gave up if
  it did not answer. Having two Booked tabs open is normal here, and they are
  **not** interchangeable: Chrome orphans the content script in every
  already-open tab when the extension reloads, and only a page refresh
  reconnects it. So one stale tab earlier in the strip broke "Scan now"
  permanently while the passive observer in the *other* tab kept scanning —
  which is exactly the self-contradicting panel. The error made it worse by
  saying "try reloading the Booked tab": the user reloaded the tab they were
  looking at, which was the one already working. Now tabs are ordered
  active → not-discarded → most recently accessed, **all** of them are tried,
  and failure is reported as `no-listener` (page open, nothing listening)
  distinctly from `no-booked-tab` (page not open). `modules/queueView.js`
  owns the wording for both, because the popup and widget copies had already
  drifted apart once.

- **The listener sat at the bottom of an unguarded bootstrap.** In
  `content/content.js` the `HOSTOS_RUN_SCAN` listener was the *last*
  statement, after bare `HostOS.scanner.scan()`,
  `HostOS.fleetScanner?.scanAndSave()` and `HostOS.observer.start()` calls.
  A throw in any of them aborted the IIFE before the listener registered, so
  the tab could never answer a manual scan again — and reloading never helped,
  because the same call threw on the next load too. The widget is a separate
  content script that had already run, so the panel still looked alive.
  The listener is now registered **first**, and each bootstrap step is
  wrapped so one failure cannot take out the others.

- **A scan that failed was indistinguishable from an empty page.** The
  listener called `sendResponse` only on the success path, so a rejection
  closed the port with no reply. Every path now responds, and the background
  rejects a reply with no numeric `tripsFound` rather than reporting it as
  "scanned, 0 reservations found".

- **Duplicate, untracked background scan tabs.** `maybeStartNextScrape`
  checked `if (currentScrape) return` and then assigned `currentScrape`
  three awaits later, inside a `chrome.tabs.create` callback. It is called
  from `chrome.storage.onChanged`, which fires on every list scan, so two
  calls could both clear the guard, both open a tab, and the second assignment
  would overwrite the first — leaving a tab that `handleScanDone` rejects
  (sender id no longer matches) and `tabs.onRemoved` ignores. A synchronous
  `startingScrape` flag now covers the whole setup, and the create is
  awaited so tracking is in place before the guard drops.

  Separately, MV3 termination discards `currentScrape` **and** the
  `setTimeout` that would have closed the tab, and `handleScanDone` then
  rejects that tab's own "done" message. `closeOrphanedScanTabs()` runs when
  the worker starts and closes any `hostos_bg=1` tab it cannot account for —
  on a fresh worker that is all of them, so it is safe; the trip is simply
  rescanned.

No `DETAIL_SCAN_VERSION` bump: none of this changes what a detail scan reads
or how it is interpreted, so cached trip data is still valid.

## Billed days round up — the receipt was only half-checked (2026-08-26)

Matt emailed about reservation 60634202 again: *"I have that trip at .35 cents
a mile. $283/800."* He is right, and `HostOS.earnings.compute` agreed — but
only when handed a $160 base rental by hand, which is exactly what the test
suite did. **Nothing checked where the $160 came from.**

It comes from `queueView.baseRentalFor` = calendar nightly rate x
`dates.tripDayCount`, and `tripDayCount` used `Math.round`. Brent's trip
runs Thu 4:30 PM → Sun 7:30 PM: **3 days 3 hours**, which rounds to 3.

**Turo bills a part day as a full day.** The receipt reads
`4 days @ $40.00/day`, and the trip's own mileage allowance says the same
thing independently — the listing gives 200 miles/day and the booking includes
**800**, which is 4 x 200. So the live pipeline priced 3 nights:

| | live pipeline | Turo receipt |
| --- | --- | --- |
| base rental | $120.00 | $160.00 |
| trip total | $279.76 | $314.68 |
| you earned | **$251.78** | **$283.21** |
| per mile | **$0.3147** | **$0.3540** |

11% low. The isolated test reported $283.21 and passed the whole time; only the
wrong number ever reached Matt. Understating earnings is precisely what pushes
a healthy trip under the $0.20/mile line, so this biases toward the same class
of false positive Matt reported the first time.

`tripDayCount` now rounds **up**, measured in **clock time** rather than
elapsed milliseconds — a trip running across the end of DST gains a real hour,
which would otherwise bill an exact 3-day booking as 4. `tests/run.js` now
drives the whole chain through `baseRentalFor` instead of passing $160 in, so
the gap that hid this cannot reopen.

**This did not change any current flag** — Brent's trip was already correct at
$0.35 after the earlier `pricePerMile` fix, and the three trips showing in
Profit Risk ($0.15, $0.19 and Todd's) stay flagged with the higher figure. It
changes how close to the line every short trip sits.

### `EARNINGS_VERSION` (new, in `utils/constants.js`)

`earningsPerMile` is computed **once** by the pricing sweep and stored on the
trip; the panel, the Chrome notifications, the Premier alert and the 9 PM
report all read that stored number and none of them recompute it. The sweep
only revisits a trip every `RECHECK_MS` (6 hours), so a fix to the earnings
chain would not reach a trip checked an hour ago until well after tonight's
report had gone out.

`needsCheck` now also returns true when `trip.earningsVersion` is not the
current `EARNINGS_VERSION`, and the sweep stamps it. **Bump it whenever the
earnings chain changes** — same discipline as `DETAIL_SCAN_VERSION`, and the
same effect: one forced re-price of the whole set, then back to the normal
6-hour cadence. It costs JSON requests only, not background tabs.

### Still open

The **free-delivery gap** above is unchanged and now matters more, since it
pushes the other way: any trip qualifying for free delivery is over-estimated
by the full ~$120 and may fail to flag when it should. Worth doing before
trusting per-trip figures to the dollar.

## Extras now come from JSON, for every trip (2026-08-26)

Extras were readable only from the reservation **page**, which needs a
background tab and therefore only ever happened inside the 72-hour detail
window. Every trip further out had `trip.extras` undefined, and
`extrasValue` reads `trip.extras || []` — so unknown counted as **$0**.
On an 800-mile booking one unseen $55 extra is worth **$0.06/mile**, which is
most of the distance between $0.15 and $0.21. Same false-positive direction as
the other two bugs: understate, then flag.

Widening `DETAIL_WINDOW_MS` was the obvious fix and is the wrong one — it was
already tried, and unscoped scanning means a near-constant stream of visible
background tabs. The reservation payload
(`/api/reservation/detail`) is **already fetched for every trip** by the
pricing sweep, needs no tab, and almost certainly carries the extras.

**The extras field has never been mapped, and naming the wrong one would put
invented money on a card that emails Matt.** So nothing guesses a field name:

- `collectExtraCandidates(payload)` walks the payload and collects every
  array whose entries **all** look like a purchased extra — a name, a positive
  price (unwrapping Turo's `{ amount, currencyCode }`), an optional quantity
  and billing unit. Each candidate carries the path it was found at. A
  partially-matching array is rejected whole.
- `proveExtrasPath` refuses to use any of them until one has reproduced a
  **page-scraped** total to the cent, on a trip where both sources exist.
  Trips with no extras can't prove anything (a candidate that finds nothing
  also totals zero), so only a nonzero known value counts. The winning path is
  stored in `hostosExtrasPath`.
- The page scrape stays **authoritative** wherever it exists. The JSON only
  fills in trips the detail scan can never reach.
- Candidate blocks are held in a separate map from `results` — `results`
  gets spread onto the trip and saved, and this is search scaffolding that
  must never reach storage.
- Anything not explicitly per-day is treated as **per-trip**. Reading a
  $55/trip extra as per-day overstates a 10-day booking by $495.

Until a path proves itself, extras stay **unknown rather than zero**, and the
Profit Risk card now says `Extras — not checked yet — earnings shown are a
floor` instead of silently omitting the row. That is the same rule the
codebase already applies to `earningsPerMile`, where a missing number never
flags: an unknown must never read as a low one.

**If the path never proves**, no trip inside the 72-hour window has bought
extras since the change. Check `hostosExtrasPath` in storage; if it is unset
after a full sweep, that is what happened, not a failure.

## Unknown is never zero — delivery, extras, and what the email says (2026-08-26)

`pricing.deliveryFees[locationId] || 0`. A reservation that **is** a delivery
but whose location was missing from the vehicle's fee table fell back to **$0**
— pricing a delivery trip as though delivery were free, understating it by the
whole fee (~$120 at DIA) and pushing a healthy trip under the $0.20 line. Same
failure as extras, same direction, same result: a false alarm to Matt.

A zero must mean **"no delivery"**, never **"we didn't find out."** The lookup
now yields `null` when the fee is missing, and `earnings.compute` keeps it
as unknown rather than spending it as a zero. A trip with no delivery at all is
still a real `0`.

`compute` now returns `inputsKnown` and a named `unknownInputs` list.
When anything is unknown, every figure it produced is a **floor** — the trip
can only be worth more.

### The email had to carry its own caveat

`composeDigest` prints `trip.reasons` **verbatim**, and `tripSummary`
reads `trip.riskReasons` from **storage**. So the caveat lives in the reason
string itself, written when the sweep prices the trip:

    Earns only $0.14/mile of the allowance (below $0.20)
    Earns only $0.14/mile of the allowance (below $0.20) - floor only, extras not read from Turo

Matt reads the email, not the card. A number he can't trust costs more than no
number — that is what two false alarms already bought.

### **Stored values do not update themselves**

`earningsRisk` and `riskReasons` are both **stored**, written only by the
pricing sweep. A fix to the earnings chain reaches the 9 PM report only after
that sweep has re-run. With `EARNINGS_VERSION` bumped, that is one full pass:
batches of 15 every 90 seconds, so roughly **9 minutes with a Turo tab open**
for ~87 trips. **No tab open before 21:00 means the report goes out on the old
stored numbers**, regardless of what the code now says.

## Audit of the same day's own changes (2026-08-27)

Reviewing the previous day's work turned up three defects in it. Worth
recording that the bugs were in the *fixes*, not the old code:

- **`extrasSource` lied.** It read
  `next.extrasSource === "api" ? "page" : ...` — so extras filled from the
  JSON were relabelled **page-verified** on the very next sweep, hiding the one
  thing the field exists to reveal. It is now labelled once, inferred from
  whether a detail scan has ever run (`detailScannedAt` is the only thing that
  reads the reservation page). The field is otherwise unread: it exists so the
  JSON path can be confirmed working by inspecting storage.

- **The startup orphan sweep could close a scrape's own tab.**
  `closeOrphanedScanTabs()` was fire-and-forget, and it closes every
  `hostos_bg` tab it cannot account for. Its `chrome.tabs.query` snapshot is
  taken before `currentScrape` is assigned, so a scrape starting in that
  window could have its brand-new tab swept away — leaving `currentScrape`
  tracking a dead tab and the queue stalled until the 30-second timeout.
  `maybeStartNextScrape` now awaits the sweep (`orphanSweep`) before creating
  anything.

- **Proving the extras path on a matching total alone was too weak.** A total
  can be matched by coincidence somewhere in a 17KB payload, and the winning
  path is stored permanently and then trusted for every trip. The count must
  now agree too. Names are deliberately **not** compared: Turo may spell an
  extra differently in JSON than on the page, and too strict a check would
  silently stop the path ever proving.

  This also guards against misreading a genuinely correct block — a wrong
  quantity or per-day/per-trip reading changes the total, so the path simply
  never proves and extras stay honestly unknown instead of quietly wrong.

## A floor is not a total — reservation 60557889 (2026-09-02)

Matt, third correction in a week:

> *"I think your revenue per mile still is off, this one is .26 cents a mile.
> I think maybe it is missing the delivery fee. I charge a $120 delivery fee on
> every trip."*

Turo's own booking email for #60557889 states **$860.01** across **3,300**
included miles. That is **$0.2606/mile** — exactly Matt's figure. The 8/31
report listed it as BELOW $0.20/MILE.

Two inputs were missing, and both were being spent as zero:

- **The delivery fee.** The reservation carried no delivery marker, and the
  code read `deliveryLocationId ? lookup : 0` — so "no marker" became a
  **known $0** rather than "not read". Matt charges $120 on **every** trip.
- **The extras.** The trip starts 6 days out, past the 72-hour detail window,
  so its extras had never been read at all. The guest's own message mentions
  paying for the EV charge, so there is very likely a $55 extra too.

### The rule that should have prevented all three corrections

Each time, the number was **understated** and then **asserted** as fact. The
codebase already had the right rule for the total case — *a missing
`earningsPerMile` never flags* — but nothing applied it to a **partially**
missing one. A floor below $0.20 says nothing about where the real figure sits.

So `belowRateThreshold` now requires `earningsInputsKnown === true`. A trip
built on an unread input is never asserted as a profit risk. It is not dropped
either — the report gained a **COULD NOT PRICE** section naming the trip and
the specific inputs that were never read:

    COULD NOT PRICE (1)
      #60557889  Tesla Model 3 2022  Lian
          pickup Tue, Sep 8, 1:00 PM  ->  return Thu, Oct 8, 10:00 AM
          would read below $0.20/mile, but extras and delivery fee were never
          read from Turo - the real figure can only be higher

Silence would have been its own lie; so would the flag.

Also: `deliveryFee` is now `null` unless Turo positively said otherwise.
`location.deliveryLocation === false` is a real `$0`; a missing location
object is **unknown**. And `EARNINGS_PER_MILE_FLOOR` moved to
`utils/constants.js` — the threshold was a bare `0.20` in `riskEngine`
and the digest needed it too, which is exactly how this project has drifted
before.

`EARNINGS_VERSION` bumped to **2**, so every trip re-prices on the next sweep.

### Matt's standing delivery fee (`STANDING_DELIVERY_FEE`, options page)

John's call, 2026-09-02: **follow what Matt says every time.** Matt sets his own
prices, so where Turo exposes no delivery fee, his stated `$120 on every trip`
is the authority — a stated business fact, not an invented default. Guardrails,
because an assumed `$120` was explicitly rejected once:

- **Turo's own per-location fee always wins** where it can be read. It
  reproduced Brent's receipt to the cent, and the standing rate only fills gaps.
- **It is visible and editable** in the options page, pre-filled rather than
  applied invisibly. Blank means "use Matt's rate"; `0` means "he stopped
  charging it" — two different answers, so an empty box must never read as zero.
- **It is labelled everywhere it is used.** `deliveryFeeSource` is
  `"turo"` or `"standing"`, and a card reading from the standing rate says
  `your standing rate, not read from Turo`. It must never look like Turo data.

Effect on 60557889: `$120 × 0.9 = $108`, which is `$0.0327/mile` across its
3,300 miles — enough to lift any plausible prior reading over the `$0.20` line.

### Still open — and it is now the main source of error

The standing fee closes about `$0.033/mile` of a `$0.07/mile` gap. Turo says
`$0.2606`; even with delivery restored the reconstruction lands near
`$0.223`, still roughly **$125** short. Two candidates, both already known:

- **Unread extras.** The trip starts outside the 72-hour window, and the guest's
  own message mentions paying for the EV charge (~`$55`). The JSON extras path
  covers this once it proves.
- **The nightly rate on a long booking.** Every receipt verified so far has been
  a 3–4 day trip, where the length discount is ~3%. A 30-day booking carries a
  far larger monthly discount, and nothing has ever checked the reconstruction
  against a **monthly** receipt. This is the least-tested part of the chain and
  now the most likely remaining source of error.

  **Ask Matt for one monthly receipt.** It is the single highest-value artifact
  left — it would validate the length-discount handling on exactly the trip
  shape that is currently drifting.


## An empty queue has to say why (2026-09-02)

After the "never assert an unread input" change, the panel read
**Profit Risk — 0 trips — No matching reservations right now.** There was no way
to tell whether every trip genuinely cleared `$0.20` or whether all of them had
been held back for missing inputs. The 9 PM email got a `COULD NOT PRICE`
section; the panel got nothing, so a suppressed queue looked exactly like a
clean one — the very ambiguity that section exists to remove.

`queueView.unpriceable(trips)` applies the same rule as the digest, and an
empty Profit Risk queue now adds a line naming how many trips were held back
and why. A genuinely clear queue stays quiet.

## Turo's Booked LIST shows guest extras (2026-09-02, unverified)

Observed on the live Booked page: trip cards carry Turo's own extras badges —
`Prepaid EV recharge` on one, `Camp chair` on another. **HostOS injects
nothing into those cards** (nothing in `scanner.js` or `observer.js` creates
DOM), so these are Turo's markup.

That matters, because extras have been the single biggest source of unpriceable
trips. Today they are readable only from the reservation **page**, which needs a
background tab and so only happens inside the 72-hour window. If they are on the
list, `buildTrip` can read them for **every rendered card**, no tab required.

**The bigger prize is the negative case.** A card with *no* extras badge is
positive evidence of *no extras* — which turns `extras` from unknown into a
known `[]` for most of the fleet, and makes those trips fully priceable again.
That is very likely what is keeping Profit Risk at zero.

Before building it, check three things against the live DOM:

1. **Is the price in the badge, or only the name?** The screenshot shows names
   only. Prices differ per booking (a $40 child seat was $45 on another
   reservation), so a name alone cannot be priced — it can only prove that
   extras *exist*, which still beats not knowing.
2. **Is the badge present on every card, or only some?** If Turo only renders it
   for certain extras, absence is not proof of absence and the negative case
   collapses.
3. **The list is virtualised.** Only cards scrolled into view exist in the DOM,
   so this accumulates as `mergeTrip` merges — it is not a single-pass answer.

If (1) says names only and (2) holds, the win is `extras: []` on the many
trips that have none, not pricing the ones that do.

## Requiring every input was too strict — the queue went silent (2026-09-02)

Making a `$0.20` flag require `earningsInputsKnown === true` stopped the false
alarms and also stopped **everything**: John saw *"not 1 single profit risk since
yesterday."*

Extras are only read inside the 72-hour detail window, so any trip further out
has `extras` undefined — which meant nothing outside that window could ever be
flagged. **Silence is its own failure.** The whole point is catching a bad trip
early enough to cancel it, and an empty queue is indistinguishable from a broken
one.

### The right test is not "is everything known"

It is **"could what we don't know change the answer."**

Extras can only **add** to earnings, so the computed figure is a **floor**. A
floor below the line is decisive whenever no plausible extra could lift the trip
over it. So work the shortfall out in dollars and compare it against the
priciest extra this fleet actually sells:

    shortfall = ($0.20 - earningsPerMile) x includedMiles
    decisive  = shortfall > MAX_UNKNOWN_EXTRA x hostTakeRate

`MAX_UNKNOWN_EXTRA` is `$55` — the prepaid EV recharge, the most expensive of
the seven on the fleet price list. At a 0.9 take rate it can add at most
`$49.50`. It is a **ceiling**, not an estimate: nothing is ever priced with it.

| trip | $/mile | miles | short by | verdict |
| --- | --- | --- | --- | --- |
| Clara, VW Taos | $0.15 | 3,500 | $175 | **flagged** |
| Nicole, Mazda CX-50 | $0.19 | 1,500 | $15 | held |
| Lian, Model 3 (60557889) | $0.19 | 3,300 | $33 | held |
| thin short trip | $0.10 | 800 | $80 | **flagged** |

Genuinely bad trips flag again whether or not extras were read. Genuinely
marginal ones are held — and *surfaced*, not dropped: `earningsUndecided` is
set on the trip, and both the panel's empty state and the report's
`COULD NOT PRICE` section read that one stored verdict rather than each
re-deriving the rule (which is exactly how this file and the modules have
drifted before).

The reason line says why the verdict holds despite the gap:

    Earns only $0.10/mile of the allowance (below $0.20) - extras not read from
    Turo, but the shortfall is too large for any extra this fleet sells to close

**Raise `MAX_UNKNOWN_EXTRA`** if a pricier extra is added, or if guests start
routinely buying several on one booking — both would widen the genuinely
uncertain band. `EARNINGS_VERSION` bumped to **3**.

## The nightly report as HTML (2026-09-02)

John asked whether the report could arrive looking like the Profit Risk card
rather than a wall of text. **HTML, not an image** — an image would be blocked
by default in Gmail until "display images" is clicked, would not scale on a
phone, could not be searched or selected, and would need canvas rendering in an
MV3 service worker. HTML costs none of that.

`composeDigestHtml` mirrors the card deliberately: the same labelled rows
(`EARNINGS`, `EXTRAS`, `DELIVERY`, `PER MILE`, `PLAN`, `GUEST`) in
the same order, so a figure means the same thing in both places. It carries the
honesty rules with it — `not checked yet — earnings shown are a floor`, and
`your standing rate, not read from Turo` — because the email is what Matt
actually reads.

Constraints worth remembering:

- **Email HTML is not page HTML.** No stylesheet (Gmail strips it), no flexbox,
  no grid. Tables with inline styles only. Colours are set on every cell so a
  client's own dark mode cannot invert half a card. Tests assert the absence of
  `<style`, `display:flex` and `display:grid`.
- **Guest and vehicle names come from Turo and land inside markup**, so
  everything goes through `escapeHtml`. There is a test that a guest called
  `<script>` cannot inject.
- **The plain-text body is still composed and still sent.** It is the fallback,
  and it is what an older relay delivers.

### This needs the Apps Script redeployed

`SCRIPT_VERSION` is now **4**: `doPost` reads `payload.html` and passes it
as `MailApp.sendEmail({..., htmlBody })`. **A v3 deployment ignores the field
and sends the plain text**, so nothing breaks if it is never updated — the
report simply stays as it was.

To get the rich version: options page → **Copy the script** → paste over
`Code.gs` → **Deploy → Manage deployments → pencil → Version: New version →
Deploy.** Saving the code alone changes nothing; that trap is already called out
on the options page. The `/exec` URL does not change, so it never needs
re-pasting. The options page already warns when the deployed version is behind
what the extension expects.

## Why extras were never read, and the fix (2026-09-02)

John: *"what's wrong with the Extras? why does it not check the reservations?"*

Extras live **only on the reservation page**, which needs a background tab, and
`eligibleForDetailScan` only opens tabs for trips inside the 72-hour window. So
a trip further out was never opened, its extras were never read, and it sat
reading `not read yet` **forever** — the queue could not resolve it in either
direction. It was not a bug in the extras reader; the reader was never run.

`eligibleForDetailScan` now also returns true for `trip.earningsUndecided`.
That is precisely the trip worth opening: reading its extras is the one thing
that settles whether it is genuinely below `$0.20`.

This is **not** the general window widening that was tried and rejected — that
scanned everything weeks out and produced a near-constant stream of background
tabs. This is scoped to trips that are actually undecided (a handful), and it is
**self-limiting**: the scan fills extras in, the trip stops being undecided, and
it stops qualifying. A test asserts it drops out again rather than looping.

### "a floor" was jargon

The card and the email said *"earnings shown are a floor"*. John asked what that
meant, which is answer enough. Now: **"not read yet — earnings above are a
minimum, the real figure can only be higher."**

## Every alert is a card now (2026-09-02)

All three risk types get the same treatment, and both emails share one frame
(`reportShell`) so they cannot drift apart:

- **Below $0.20/mile** — the Profit Risk card
- **Could not price** — the same card, badged `NOT PRICED`
- **Unverified licenses** — the same card, badged `LICENSE`
- **Premier** (the separate urgent email) — the same card, badged
  `PREMIER - $0 EXCESS`, under a red banner stating the exposure and what to do

### The Apps Script "Run" trap

Pressing **▶ Run** in the Apps Script editor throws
`TypeError: Cannot read properties of undefined (reading 'postData')` at
`doPost`. **That is not a broken script.** `doPost(e)` is only ever called
with a request object by an actual HTTP POST; the Run button calls it with
nothing. There is no way to test a web app from the editor.

Test it the only way that exercises the real path: **Deploy → Manage
deployments → New version → Deploy**, then the extension's **Send test alert**
button, which posts for real and reports the relay's version back.

## The Profit Risk report is always complete now (2026-09-02)

John: *"if a trip is flagged for a profit risk, make an exemption regardless if
it's further than the 72-hour range, scan the extras for it particularly."*

Right call. Both halves of that report — a trip flagged below `$0.20`, and one
we could not price — are only as good as the extras behind them, and extras live
**only** on the reservation page. So `eligibleForDetailScan` now returns true
for either, however far out the trip is:

    if (trip.earningsUndecided === true) return true;
    if (trip.earningsRisk === true && hasNotStarted(trip)) return true;

Still not the general widening that was tried and rejected — that scanned every
trip weeks out. This is scoped to trips already **on the report**, which is a
handful.

### The cooldown had to be split, or this would have flooded the tab strip

`FLAGGED_RESCAN_MS` is **5 minutes**, and it applied to any flagged trip. It
exists so a flag near pickup clears within minutes of the host fixing it — real
urgency when pickup is tomorrow. A trip a **month** out has no such urgency, and
now that far-out flagged trips are scanned at all, leaving them on a 5-minute
clock would mean a background tab every 5 minutes per flagged trip, forever:
exactly the constant activity the 72-hour window exists to prevent.

Urgency is now about being **near pickup**, not about being flagged.
`isCurrentlyFlagged` requires `nearTerm` (either end within
`DETAIL_WINDOW_MS`); a far-out flagged trip takes the ordinary
`DETAIL_RESCAN_MS` of 30 minutes. Tested both ways.

### The card names the missing input

John: *"what was the input that never read from turo?"* — having to ask is the
bug. The card now says it outright:

    NOT READ   extras could not be read from Turo - earnings above are a
               minimum, the real figure can only be higher

It reads from the same `earningsUnknownInputs` list the reason line uses, so
it can only ever be `extras`, `delivery fee`, or both. In practice it is
`extras`: the standing delivery fee means the delivery figure always resolves
now, so extras is the only input left that can go unread — and it did, for every
trip outside the 72-hour window, which is what the exemption above fixes.

## The exemption follows the PROFIT signal, not earningsRisk (2026-09-02)

John: *"only run the scan for extras for a detected trip where a profit risk is
detected."*

The exemption was keyed on `trip.earningsRisk`, which is the **OR of two
unrelated signals** — below `$0.20` and the guest's Premier plan. So a Premier
booking was earning a background tab a month out despite not being a profit risk
at all. Premier is a **protection** risk: it is emailed the moment it is booked,
from the JSON sweep with no tab, and opening its reservation page adds nothing.

`riskEngine` now stores `earningsBelowFloor` (the below-`$0.20` verdict on
its own) alongside `earningsRisk`, and the exemption reads:

    const isProfitRisk = trip.earningsBelowFloor === true || trip.earningsUndecided === true;
    if (isProfitRisk && hasNotStarted(trip)) return true;

Two narrowings in that line:

- **Premier-only trips no longer qualify.** They were the bulk of the extra tab
  activity, and gained nothing from it.
- **`hasNotStarted` now guards the undecided branch too.** It previously had no
  such guard, so a trip already under way — or already finished — could still
  pull a tab. A trip that cannot be cancelled is not worth opening; knowing is
  the whole point.

The cooldown's `isCurrentlyFlagged` follows the same signal, so the two cannot
disagree about what "flagged" means.

Both halves of the Profit Risk report are kept: a trip **below $0.20** and one
we **could not price** are both profit-risk determinations, and dropping the
second would freeze the COULD NOT PRICE list permanently — an undecided trip can
only ever be resolved by reading its extras.

`EARNINGS_VERSION` bumped to **4** so `earningsBelowFloor` is populated.

## The activity feed's Premier alert was gated shut (2026-09-02)

Found while checking, at John's request, that Premier bookings still alert as
fast as possible. **They did not.**

The activity feed exists to catch a Premier plan **within about a minute of
booking**, before any card has rendered — so a feed record has `pickupDate:
null, returnDate: null` by design. But both alert paths gated on
`hasNotStarted`, which deliberately returns **false** for an unknown pickup
("an unknown pickup cannot be claimed as upcoming").

So the fast path was gated shut. A Premier booking discovered by the feed was
written to storage, triggered the listener, and then failed the filter — the
alert waited for a **detail scan** to supply dates: a background tab, a queue
position, and possibly a long wait. Exactly the delay the feed was built to
remove, and this is the alert Matt lost a windshield to.

`isUpcomingOrBrandNew` now gates both the email and the Chrome notification:

    hasNotStarted(trip) || (!trip.pickupDate && !trip.returnDate)

A trip with **neither** date is a brand-new booking, not one already running —
an active trip still yields a `returnDate` from its "Ending at" card, so this
cannot fire for a trip on rent. And if one somehow has started, the cost is a
single message, against a Premier booking going unmentioned.

### What was verified alongside it

- `isPremier` reads `protectionLevel` / `maxOutOfPocket` **only**. Nothing
  about Premier detection touches `earningsRisk`, `earningsBelowFloor` or
  any of the earnings chain — none of this month's pricing work can affect it.
- A `silent` save still writes `hostosTrips`, so `storage.onChanged` fires
  and alerting runs. Silent only skips the scan timestamp.
- The protection sweep runs over **JSON APIs**, needing no tab, and is not
  paused by the pause toggle — deliberately, since silently muting Matt's
  alerts would be a nasty surprise.
- An undelivered Premier alert is only marked sent on success, so it retries.
- Excluding Premier from the detail-scan exemption does **not** affect
  alerting: that exemption is about opening reservation pages for extras, and
  Premier alerting never needed a page.

## One unopenable receipt starved the whole detail queue (2026-09-02)

John spotted a background tab sitting on
`/reservation/56608637/receipt?source=activity_feed&hostos_bg=1`, showing
**"Error loading receipt"** — and asked why HostOS was scanning receipts at all.
It should not have been. A co-host account has no receipt access.

The chain:

1. `selectors.tripLinks` is `a[href*='/reservation/']`, which matches **any**
   anchor containing that path — including the activity feed's link to a
   reservation **receipt**.
2. The id regex still pulled `56608637` out of it, so a real trip record was
   created with a **receipt URL** as its `tripUrl`.
3. The background scan opened that URL. The page errors, so no license, no
   sections, no dates render.
4. `detailScanComplete: Boolean(pickupDate || returnDate)` → **false**.
5. `recentlyScanned` requires `detailScanComplete !== false`, so an
   incomplete scan **deliberately bypasses the rescan cooldown** — a trip whose
   dates were merely slow deserves another look immediately.
6. Instantly eligible again. Forever.

The scrape queue is **single-flight**. So one unopenable receipt held it
permanently, and every other trip was starved of detail scans — which is very
likely why extras were not being read across the fleet, and why the footer read
`checking reservation #56608637` in screenshot after screenshot for hours.

### It kept happening after the first fix — storage was already poisoned

Rebuilding the URL in `buildTrip` stops **new** bad records. It does nothing
for one already saved: that trip keeps its receipt URL until a list scan happens
to re-read its card, and a trip discovered through the **activity feed may have
no Booked card at all**, so it would never be repaired.

So the canonicalisation also lives at the **point of use**.
`backgroundScanUrl` rebuilds from the id in the path, meaning nothing that
reaches it can send a tab anywhere but the trip page, whatever storage holds:

    /reservation/56608637/receipt?source=activity_feed  ->  /reservation/56608637?hostos_bg=1
    /reservation/60557889/messages                      ->  /reservation/60557889?hostos_bg=1
    /reservation/56608637?hostos_bg=1                   ->  /reservation/56608637?hostos_bg=1

That last case is belt-and-braces rather than a bug fix: `buildDetailTrip`
already stripped `hostos_bg` before storing, so a doubled marker was never
actually reaching storage. Handling it here costs nothing and means the point of
use does not depend on that stripping staying correct.

`scan()` additionally rewrites saved trips whose URL is not canonical, so the
card's "Open trip" button stops pointing at a receipt too.

**The lesson**: a fix to how data is *written* does nothing for data already
written. This project stores almost everything, so every such fix needs a
matching answer for the existing rows — either a repair pass, a version bump,
or a defence where the value is used.

### Two fixes, because either alone leaves the trap open

**The id is authoritative.** `canonicalTripUrl(id, url)` rebuilds
`https://turo.com/us/en/reservation/{id}` from the parsed id rather than
trusting whichever anchor matched. Robust against every link variant — receipt,
messages, photos, query strings — and it also strips `hostos_bg=1` when a
detail scan reads its own address, which was quietly polluting stored URLs.

**A page that can never render must stop retrying.**
`detailScanFailures` counts consecutive scans that produced no dates, and
after `MAX_DETAIL_SCAN_FAILURES` (3) the trip stops bypassing the cooldown and
waits its turn. It is not abandoned — it still retries on the ordinary
30-minute cadence, so a genuine outage recovers on its own. The counter resets
the moment a scan succeeds.

Without the second fix, any future unopenable page — a deleted reservation, a
Turo outage — reproduces the same starvation.

## Two of the three alerts could not be tested at all (2026-09-10)

**Send test alert never proved what people assumed it proved.** It sends
`kind: "test"`, and `postAlert` routes `premier` and `test` to the **urgent**
list. So a green test result says: the URL is right, the deployment answers,
Apps Script can send mail, and the urgent recipients are correct. It says
**nothing** about the two risks Matt actually asked to be warned about —
below `$0.20`/mile and unverified licenses inside 24 hours — because those
exist only in the 9 PM report, which uses different wording, different compose
code and the *other* recipient list.

Verifying those meant waiting until 9 PM and seeing whether an email arrived,
which is one attempt per day. Worse, the failure is invisible: a report that
threw while composing a card, or one addressed to an empty nightly list, looks
exactly like a quiet night with nothing flagged — the same "no news means no
problems" trap the alert status line exists to close.

**Send tonight's report now** (options page) sends the real digest, built from
the trips currently in `hostosTrips`, addressed to the nightly list.

Two properties it must keep, both asserted in the suite:

- **It must not stand in for the real report.** It calls `sendDailyDigest`
  directly, never `maybeSendDigest` — only the latter writes
  `hostosLastDigestDate`. Wired to `maybeSendDigest`, pressing preview at
  8:55 PM would silently cancel that evening's actual report.
- **It must not read as the real report.** The subject carries `(PREVIEW)` and
  the HTML masthead says `preview, sent on request` under the date. An
  unlabelled turnover report landing mid-afternoon reads as the real one going
  out early, and would be acted on as a settled list. The **body is otherwise
  identical**, and that is asserted — the moment the preview composes anything
  differently it stops being evidence about the report.

A dead-button test now walks every `<button id=...>` in `options.html` and
requires a matching `$("id")` in `options.js`. A button with no listener looks
like a working button and does nothing.

**What still cannot be tested from here:** whether Turo's session cookie
attaches to `sweepProtection()`'s tabless fetch (see the alerting section),
and the overnight coverage gap — the extension only runs while Chrome is open.

## The Premier dedupe was asserted by grep, and shipped a duplicate (2026-09-10)

The send-once guard was covered by a source-text match:
`sw.includes("if (result.ok) next[trip.reservationId")`. That line stayed in
the file the whole time reservation **61156935** produced **two** "Premier plan
booked" emails — the first reading `unknown → unknown`, the second with real
dates. The bug was never in that line.

`alertPremierTrips` fires from `chrome.storage.onChanged` on `hostosTrips`,
and the background **detail scan writes `hostosTrips`** when it resolves a
trip's dates. So the scan that fills in the schedule re-fires the alert. The
old code read `hostosAlerted`, awaited a slow Apps Script round-trip, and only
wrote the dedupe key once every send had finished — so the second invocation
read the map before the first had written to it.

Both guards are load-bearing:

1. **Serialise.** `alertPremierInFlight` chains concurrent invocations so each
   sees what the previous actually wrote.
2. **Claim before sending, not after.** A service worker can be torn down
   mid-send; a key written only on success means a delivered email whose claim
   never landed, and a resend on the next scan. Claims are **released again**
   only for sends that genuinely failed — re-reading storage rather than
   reusing the snapshot, since a later run may have added keys meanwhile. That
   preserves the retry property the mark-on-success version was protecting.

The test now drives the function against a fake storage and a deliberately
slow send, arranged as the live failure was. It was **reproduced against the
old implementation first** — it sends twice. A grep-shaped assertion about a
race is worth nothing; the race lives between the lines, not in one of them.

## A cancelled reservation was indistinguishable from a live one (2026-09-10)

**The failure.** Reservation **61109808** was cancelled by Matt on 9/8. On
9/10 the extension emailed URGENT about its Premier plan — at 8:50 AM and
again at 5:44 PM — reading `unknown → unknown` for the dates. Nothing in the
extension had ever read a cancellation from anywhere: a cancelled reservation
kept its record, its plan and its future dates, and every check treated it as
live.

The same gap produced the evening's other symptom. The panel read **Profit
Risk 4** while the 9 PM report read **BELOW $0.20/MILE (0)**. The panel counts
Premier trips under Profit Risk (`earningsRisk || premierProtection`) and the
report omitted them by design, so cancelled Premier bookings Matt had already
handled — cancel, change plan, guest rebooks — sat in the panel's count with
nothing in the report to reconcile against.

**How a cancelled trip got a "brand new" alert.** The immediate Premier alert
treated any record with no dates as a fresh feed discovery. 61109808 was
stood up by a `Booked trip` feed event processed days late — no card, no
dates — and the rule read "no dates" as "just booked". The dedupe did not save
it because the second email nine hours later came after a claim was released
on a failed-looking send (most likely a network drop after Apps Script had
already sent; John's connection was suffering typhoon latency that day).
**Ask whether HostOS is also loaded in Chrome** — a Chrome icon appeared in
the taskbar that afternoon, and a second profile has its own storage and
would alert independently. Not confirmed either way.

**The fix, in three parts:**

1. **Cancellation is recognised, from two sources.**
   - The detail scan reads the page heading (`HostOS.selectors.pageHeadings`).
     "Cancelled trip" is Turo's own statement and the one place it cannot
     also be a guest's message — body-text matching was rejected for that
     reason. Writes `cancelled: true, cancelledSignal: "page heading"`.
   - The reservation API is read by `HostOS.parser.cancellationSignal`,
     pinned to the top-level **`statusCode`** — confirmed live the same
     evening: 61109808 reads `"CANCELLED"` with `cancelledRequest` populated
     and `statusExplanation.summaryText` "You canceled on Sep 8"; every
     completed trip checked reads `"COMPLETED"`. An earlier version walked
     the whole payload for any CANCELLED-shaped value; that was replaced,
     not widened, because a wrong match here is a Premier alert that never
     sends. What matched is stored as `cancelledSignal`.
   - The activity feed emits **"Trip canceled"** with the reservation id
     (seen for 61156935 — Kumar, the reservation from the original duplicate
     email, cancelled by Matt on 9/9). `activityScanner` flags the stored
     record the moment it reads the event, no request needed, and never
     stands up a record for a cancellation it has no trip for.
   - Both write **true only**. A reader that cannot tell says nothing, never
     false, so neither source overwrites the other.

2. **Cancelled is a trip STATE.** `HostOS.dates.hasNotStarted` is false for
   a cancelled trip whatever its dates say, so every consumer that means
   "still ahead of us" is gated once: the panel's earnings queue, the
   notifications, the Premier alert, the report's rate/undecided/Premier
   lists, detail-scan flagging. The two licence filters and the protection
   sweeps take a date rather than a trip and carry `isCancelled` themselves.
   `eligibleForDetailScan` and `needsProtectionCheck` refuse cancelled trips
   outright.

3. **"Brand new" means the BOOKING is new.** The feed stamps `bookedAt` from
   the event's own `created`. `isUpcomingOrBrandNew` alerts a no-dates
   record only within `BRAND_NEW_BOOKING_MS` (24h) of that. A record with no
   `bookedAt` — every no-dates record that existed before this change — waits
   for a detail scan to supply dates. That stopped 61109808 on reload before
   any scan ran.

**The report now recaps Premier trips still on the books** ("PREMIER PLAN,
ALREADY ALERTED (n)"), so panel and report reconcile and Matt has his
cancel-and-rebook checklist in one place. The footnote is restated: a NEW
Premier booking is still emailed the moment it is found; the section is the
recap, not the alert. The old "Premier plan bookings are NOT listed above"
wording is gone on purpose.

**Existing rows.** `DETAIL_SCAN_VERSION` 6 re-reads every eligible page.
`EARNINGS_VERSION` 5 changes no math — it forces one re-sweep of every stored
trip so the API check runs fleet-wide within ~10 minutes of a Turo tab being
open, instead of waiting up to six hours per trip. Cancelled records are kept,
flagged, for `CANCELLED_RETENTION_MS` (7 days) so nothing can stand one back
up, then pruned.

**Coverage:** the feed catches a cancellation within a minute while a Turo tab
is open; the API sweep catches the rest within one pass; the page heading is
the backstop for anything opened by the detail scan.

## What Turo exposes for a Post-Trip Review feature (2026-09-10, read live)

Matt asked for a review assistant (pending reviews, a checklist, a 5-star
recommendation, promo-code reminder) and for more guest risk indicators
(smoking, cancellations, late returns, behaviour). Read directly from John's
signed-in Brave session via Claude in Chrome, read-only. Everything below is
observed, not assumed.

**John's account is a co-host** — `driverRole: "CO_HOST"` on every
reservation. **Turo web shows this account no rate-guest control anywhere**:
not on History, not on the trip page, not on the Booked card, and
Business → Ratings & reviews renders "There's been an error". Matt asked
whether John can rate guests; the answer from the web UI is no. Matt rates
from the app (his review of Kaushal is dated 9/9). So the feature is a
**review queue + one-click prep**, not a submitter: "Open Guest Review" opens
the trip page, and Matt rates in the app.

**Trip status: `/api/reservation/detail` → `statusCode`** — `COMPLETED`,
`CANCELLED`, otherwise live. Also on a completed trip:
- `tripStart` / `tripEnd` as `{epochMillis, localDate, localTime}` —
  populated on completed trips (null on a fresh booking, which is what the
  old "always null" comment saw).
- `odometerDetail`: `checkInOdometerReading`, `checkOutOdometerReading`,
  `distanceDriven`, `distanceLimit`, `excessDistance`, `distanceOverageFee`
  — all `{scalar, unit}`. Randeep: 2294 MI driven, 794 MI excess. **Extra
  mileage is readable.**
- `checkInParkingRecord.dropOffTime` populated; `checkOutParkingRecord.dropOffTime`
  was **null on every completed trip checked**, so "late return" cannot be
  read from there. The Booked list card shows "Ended at 7:00 AM" for a trip
  that ended today — that DOM text against the stored return time is the
  only late-return signal seen.
- `reimbursementStatus`: null, or `{disputed, explanation}` while an
  incidental invoice is open (sean: "resolve by September 11"). History
  cards show a "Reimbursement requested" tag for the same state.
- `cleaningRecord: {cleaned, cleanedAt}`.
- `statusExplanation.summaryText`: "Rate this trip" on completed trips
  Matt has not rated; but it is a single "next action" slot, and a pending
  reimbursement takes it over (sean), so it is a hint, not the flag.
- `needsFeedback` was false on every trip, rated or not. Not the flag.
- `reservationActions`: `UPLOAD_TRIP_PHOTOS`, `REPORT_ISSUE`,
  `VIEW_INVOICE_HUB`… — no review action in the list.

**The guest's reviews: `/api/driver/reviews_from_owners?driverId=X&page=1&pageSize=10`**
(the bare `?driverId=` form is a 400). Returns
`{ list: [{ author:{id, firstName, lastName, allStarHost…}, autoPosted,
date:{epochMillis, localDate, localTime}, feedbackReply, overallRating,
review }], numPages }`. This is the review TEXT other hosts wrote about the
guest — "Great guest! Communicative and took care of our car." — which is
what Matt reads by hand today for "history of smoking". Two things follow:
- **Behaviour badges are buildable** by keyword over `review` (smok, dirty,
  late, damage, rude…), quoting the line. Not a score.
- **"Has Matt reviewed this trip" is derivable**: a `COMPLETED` trip with no
  review whose `author.id` is Matt's and whose date is after `tripEnd`. No
  Turo flag needed. Randeep — "a complete pain" — has "No reviews yet".
  `driverId` is `renter.id` on the reservation; it is fetched today but
  **not stored** on the trip. Store it.

**`/api/v2/driver/detail`** (already used) has nothing behavioural: rating
aggregates, counts, `memberSince`, `bio`, `verifications`,
`hasCompletedHostCleaningCourse`. No reviews, no cancellations, no lates.

**Activity feed titles seen** (last 50): Booked trip, Guest checked out
("Doug has marked their trip as complete", with reservationId — the
trip-ended trigger), Trip canceled, Prepare for checkout, New message,
Reimbursement invoice, "<guest> paid your reimbursement invoice", "Your trip
with <guest> starts soon" (links to `/reservation/<id>/check-in`). **No
review-reminder event exists**, so "days remaining" has no source; Turo's
review window is not exposed anywhere read. Do not invent one.

**History page**: `[data-testid="trip-history-list"]` → `baseTripCard`
(an `<a>` to the reservation), infinite scroll, no actions on cards. Lists
cancelled reservations too ("You canceled on Sep 9", "Dalton canceled on
Sep 7").

**Not readable anywhere seen**: a guest's cancellations across Turo,
roadside-assistance use, disputes, communication quality. On Matt's own
fleet, cancellations are now stored (`cancelled`), so "cancelled on us
before" is derivable once `driverId` is stored.

**The promo code**: Matt's closing message to guests mentions a 15% code
after a 5-star review. John (2026-09-10, twice): **Turo sends the guest the
code itself once they are rated 5 stars.** There is no promo step for the
host and the extension must not invent one — an earlier build tracked a
"promo sent" chore and was corrected.

## Post-Trip Reviews — stage one (2026-09-10)

Built the same evening the API was read (section above). Matt: "I forget to
rate people a lot." Everything here is the decision laid out and the one
thing he does tracked; **nothing submits a rating**, because Turo web gives
this co-host account no control for it.

**Where it lives.**
- `utils/reviews.js` — the state machine and the signal/recommendation
  logic, loaded by content scripts, popup AND service worker, so the panel,
  the badge, the 9 PM report and the notifications cannot disagree. States:
  `pending` (completed, in window, no rating known), `done` (rated on the
  card or seen in Turo, or dismissed), `expired`, `none`.
- `content/reviewScanner.js` — the sweep, every 90s with a Turo tab, 8 trips
  a pass, most recently ended first. Two requests per trip (detail +
  `reviews_from_owners`). Stores on the trip: `completed`, `completedAt`
  (real `tripEnd`), `milesDriven/Excess/Limit`, `reimbursementOpen/Note`,
  `cleaned`, `driverId`, `hostReviewedAt`, `hostReviewRating`,
  `guestReviewFlags`, `postTripCheckedAt`, `postTripVersion`. Re-reads an
  unrated trip every 3h so a rating given in the app is noticed the same
  day; a rated trip is left alone.
- `hostosReviews` (storage) — Matt's own record per reservation: `rating`,
  `reviewedAt`, `problems[]`, `notes`, `dismissedAt`, `driverId`. Written
  only by taps on the card, never by a sweep.
- The Pending Reviews tile (panel + popup), REVIEWS WAITING ON YOU in the
  report, a once-a-day notification while anything waits, one per trip when
  its window is about to close.

**Decisions, and why.**
- **Problems are marked by exception**, not ticked as positives. The spec's
  fourteen checkboxes per trip is not the thirty-second workflow it asks
  for; an untouched list means the car came back fine.
- **"Days left" is Turo's 10-day policy, labelled as such.** No endpoint
  reports a deadline and the feed emits no review reminder. The card and the
  report both say "Turo's 10-day window". Do not present it as read.
- **The recommendation lists reasons; there is no confidence percentage.**
  The spec's "AI Confidence 98%" was dropped on purpose — an invented number
  is exactly what has cost Matt trust three times in this project.
- **"Rated in Turo" is inferred, not read**: a review by anyone on the host
  team (`owner.id` + `cohosts[].id`) dated after `tripEnd` minus a day of
  slack for early checkouts. A team review from an earlier trip with the
  same guest does not count.
- **A rating given in the app takes the trip off the list** the next time
  the sweep sees it (every 3h while unrated).
- **Late return is not shown.** `checkOutParkingRecord.dropOffTime` was null
  on every completed trip read. The only signal seen is the Booked card's
  "Ended at" text against the stored return; not wired yet.

**Existing rows:** every trip that has come back within the last 30 days is
swept on the first pass after reload (`postTripVersion` is new, so nothing
counts as checked). ~10 requests a minute until caught up.

**Preview:** `node tests/preview/server.js` then open
`http://localhost:8765/tests/preview/reviews.html` — the real modules and
popup stylesheet with sample data, for layout checks without a reload.
Static: taps do nothing there.

**Matt's rule — he rates back only after the guest has rated him 5 stars
(John, 2026-09-11).** Two things read live the same night decide how that is
handled:

- **Turo publishes reviews double-blind.** `/api/driver/reviews_from_renters`
  on Matt's own id lists Kaushal's review of him dated 9/9 — the day Matt
  rated Kaushal — and none from Randeep, Doug, Nitish, sean or Aaron, whose
  trips ended 9/8–9/10 and whom Matt has not rated. A guest's review of the
  host is not visible until the host reviews back, so **the API cannot say
  who has rated him first.** Do not build on it.
- **The trip's thread is readable as JSON**:
  `/api/v2/reservation/conversation?reservationId=<id>` — an array, newest
  first, of `{ author, authorDriverRole (GUEST/HOST/CO_HOST), text, sentTime }`.
  Matt's closing message asks guests to say when they have given 5 stars,
  so the guest saying so is the signal. `reviewScanner` reads the thread as
  a third request, keeps the first GUEST message after the trip that matches
  `HostOS.reviews.saysRated` ("5 star", "left you a review", "rated you"…)
  as `guestSaysRated: {at, quote}`, and the feed's "New message" event on a
  completed trip clears `postTripCheckedAt` so the next sweep re-reads it
  within a minute. `HostOS.reviews.readiness` is the one place the rule is
  expressed; ready trips sort first, badge **Guest rated you** (green, with
  the quote), the rest read **Waiting on guest** / days left. The report
  says the same. Null means "has not said so", never "has not rated".

**Not built yet (stage two candidates):** a History-page scan for trips the
extension never saw while live; late return from the Booked card; the Host
Workflow Center the spec ends with.

## The take rate is the RESERVATION's plan, not the vehicle's (2026-09-12)

**The fourth wrong number.** The 2026-09-11 report listed nine trips below
$0.20/mile. Two were checked against Turo directly, in John's signed-in
session:

| | Isaiah #60907051 | Lisa #61004613 |
|---|---|---|
| plan on the reservation | `NINETYPLAN_US_2026` | `NINETYPLAN_US_2026` |
| vehicle's current plan | `SEVENTYPLAN_US_2026` (0.7) | same |
| report said | $194 · $0.16/mi | $275 · $0.18/mi |
| on the trip's own plan | ≈$264 · **$0.22/mi** | ≈$378 · **$0.25/mi** |

The extension took `hostTakeRate` from `/api/vehicle/detail →
currentVehicleProtection` — the vehicle's plan **today**. The fleet moved from
the 90 plan to the 70 plan, and every earlier booking kept its 90. Every
90-plan trip was being priced a fifth low. The one receipt ever verified
(Brent, 60634202) was a 90-plan trip while the vehicle was also on 90, which
is why it matched and why this stayed invisible until the plan changed.

**Two rates, not one.** Also read live: `currentVehicleProtection.hostDeliveryTakeRate`
is **0.9 on the 70 plan** — delivery fees pay the host at their own rate
whatever the plan (Matt: "you get 90 percent of this" about the $120 fee).

**Now:**
- `HostOS.parser.planTakeRate(detail)` reads `vehicleProtectionLevelDetail.key`
  — SIXTY/SEVENTY/SEVENTYFIVE/EIGHTY/EIGHTYFIVE/NINETY — and the sweep stores
  it as `hostTakeRate` with `hostTakeRateSource`. The vehicle's current
  rate is kept as `vehicleCurrentTakeRate` for reference only.
- `earnings.compute`: `(rental + extras) × planRate + delivery × deliveryTakeRate`.
- An unreadable plan is priced at `MIN_HOST_TAKE_RATE` (0.6) as a floor,
  named "earnings plan" in `earningsUnknownInputs`, and `riskEngine` never
  asserts a floor built on it — such a trip lands in COULD NOT PRICE, where
  an unread plan used to make it vanish entirely.
- `EARNINGS_VERSION` 6 re-prices every stored trip. The card and the email
  say "(90 plan)" on every earnings figure.

**Actual payouts are not readable from this account.** Business → Earnings
renders "No access… co-hosting permissions", and the two APIs behind it
(`/api/drivers/<id>/owner-scorecard/earnings`, `…/owner-scorecard/vehicles`)
return 403 for the co-host's own id and for Matt's. If Matt grants John the
earnings permission in Turo's co-hosting settings, those endpoints are the
place to read real per-trip payouts and retire the estimate. Until then the
chain stays a reconstruction.

**Still the one approximation:** the nightly rate from the fleet calendar.
`dateRangeRate` on `/api/vehicle/detail` now shows `rentalPriceBeforeDiscount`,
`rentalPrice` (after the length discount) and `defaultAverageDailyPrice` for
the trip's exact dates — today's asking price, not the booked one, but a
useful cross-check (Isaiah: $33.18/day asked vs ≈$29.70/day from the
calendar).

## Premier tile, report tables, earnings outlook (2026-09-12)

- **Premier Plan Bookings** is its own queue and the first tile, red while
  anything is on it. **Profit Risk is the $0.20 rule alone**
  (`earningsBelowFloor && !premierProtection`), so its count equals the
  report's BELOW $0.20/MILE count. "Profit Risk 14" had been two things.
- **The report is tables**: one row per trip under bold white column labels,
  reason on a muted second line, shell 780px. `htmlTable` + the cell
  builders in the service worker. Every rule the cards carried is kept (see
  the tests); `htmlTripCard` survives for the urgent Premier email.
  Characters mail clients mis-decode are entities outside `escapeHtml` and
  plain inside it — `reportStrong` escapes, so no entities inside it.
- **Earnings outlook** — `utils/outlook.js`, loaded everywhere: this week
  (Mon–Sun), this month, booked ahead; sums each trip's stored
  `estimatedEarnings`, counted at its END, unpriced trips named and never
  counted as $0. In the panel above today's list and at the top of the
  report.
- `tests/preview/report.js` renders the report; `tests/preview/panel.html`
  the tiles, Premier queue and outlook. Preview server sends charset now.

## UI pass (2026-09-12)

- **Hero** counts deadline-bound work only (Premier + licences + thin trips)
  and names the most urgent thing; reviews ride underneath with how many are
  ready to rate. `computeHeroSummary`. "41 items need attention" had been
  25 reviews plus 16 real items, added together.
- **Tile subtitles** carry the rule each count is of (`tileSubtitles`):
  "3 trips · pickup within 24h", "2 waiting · 1 ready to rate", "≈$1,373
  today · ≈$7,910 this month". A trip due back today that is not yet priced
  is counted, never shown as $0.
- **Footer sentence → six stat cells** (`statCells` + `renderStats`):
  Active, Booked, Available, Plans checked, Scanned, Queue.
- **Review card**: problems and notes sit behind one disclosure, open only
  when something is in it. The default card is signals, standing,
  recommendation, rating — half the height.
- **Bug fixed in passing**: the popup's Premier tile showed literal
  `⚠` / `—` / `›` text — a patch had written JS escapes into
  an HTML file. Pinned by a test. (Lesson for patch scripts: HTML files take
  characters, JS files take either.)
- `tests/preview/popup.html` + `popup-shim.js` render the REAL popup.js
  against sample storage through a small chrome shim, so the whole popup can
  be looked at without the extension. The test harness forwards the queue's
  `extras` argument.

## Joining a reservation to a calendar row

The **license plate is the only shared identifier**, and it must be used:
this fleet runs six "Nissan Pathfinder 2024"s and five "Mazda CX-50 2024"s,
so a model name cannot identify a row, and the calendar's reservation bars
carry **no reservation id** (just
`data-testid="calendar-day-unavailability-reservation0"`).

On the Booked list the plate is the **last `<p>` in the card** — confirmed
present on all 149 live cards. Turo gives it no `data-testid` and only a
hashed class, so `content/scanner.js` reads it by position plus a shape check
(5–8 alphanumerics containing both a letter and a digit; observed shapes
include `DJIF67`, `DXZQO1`, `EOD073`). On the calendar it's the second
`<span>` in the row button.

## Selector notes

Everything in `content/selectors.js` was verified against real, live-captured
Turo HTML (not guessed) — that file's own header comment explains this.
`css-xxxxx` hash classes are deliberately never relied on (they regenerate
on every Turo deploy); only real `data-testid` attributes and stable text
patterns are used. If Turo changes its markup, this file is the first place
to check, and the standard for any replacement selector is the same: get
real captured HTML first, don't guess.

## Known limitations (by design, not bugs)

- **Discovery requires the card to have rendered at least once.** A
  reservation can't be scanned (list or detail) until the Booked page has
  actually shown its card in the DOM — Turo's list is virtualized, so
  scrolling through it helps discovery. There's no current mechanism to
  force full-list discovery without the user scrolling or an
  auto-scrolling background scan (discussed, not built — see below).
- **No fully invisible background scanning is possible** — see above.
- **72-hour scan window** — trips further out simply have no risk data yet
  until they enter the window.
- **Fleet/vehicle earnings requires a manual visit to the Calendar page**
  at least once; it isn't scanned automatically the way Booked is.

## Discussed but not built (ask before doing, these are real tradeoffs)

- **Auto-scrolling a background copy of the Booked list** to force full
  discovery without the user scrolling — would need to mirror the
  background-tab mechanism but drive scroll events in that tab. Not built;
  offered to the user once, not requested.
- **Widening the 72-hour scan window** — straightforward, but directly
  increases background-tab frequency. Confirm before changing.
- **Migrating the rest of the detail scan onto `/api/reservation/detail`** —
  it already returns the per-mile rate, both trip dates and the license
  approval timestamp, so moving those off the DOM would make the risk-critical
  data far more reliable and could cut background tabs to almost nothing.
  Offered on 2026-08-25; John chose to keep the change small and do protection
  plans only. Keep the DOM scrapers as a fallback if this is ever done — the
  endpoint is undocumented.
- Notifications and the combined `riskScore` badge threshold logic in
  `background/service-worker.js` are simple and haven't been a focus of
  debugging — check them if the user reports notification issues, but they
  weren't part of the saga above.

## If something "still doesn't work" after a fix

This project has a long history of fixes that were correct in principle but
didn't visibly help because of *stale cached data*, not a wrong fix. Before
concluding a fix failed:
1. Confirm the extension was reloaded **and** the relevant Turo tab was
   actually refreshed (not just the extension).
2. Consider whether the affected data was cached *before* the fix landed —
   if so, it needs `DETAIL_SCAN_VERSION` bumped to force re-verification,
   or it'll sit wrong until its natural rescan cooldown (5–30 min) expires.
3. Ask for the actual service worker console output
   (`chrome://extensions` → HostOS → "service worker") rather than
   guessing again — most real bugs in this project were only found this
   way, not by re-reading the code.
