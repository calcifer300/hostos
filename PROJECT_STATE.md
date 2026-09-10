HostOS — Project State
An AI operating system for Turo hosts. Next.js 16 · React 19 · Supabase · Chrome extension.

Compiled: August 5, 2026 · Latest commit: 5f97097 — Project Aurora: public shell, Companion extension pipeline, Gemini AI

At a glance
Auth model	Public shell — no route requires login
AI surface	One card only (AI Briefing) — everything else is deterministic
Data sources	HostOS Companion extension (authoritative) + Gmail (optional, supplementary)
Open bugs	9, one unauthenticated data-exposure route
Uncommitted work	None as of this commit
1. Architecture
Three systems cooperate, with the Chrome extension as the primary data source:

HostOS Companion (Chrome extension)          Google Gmail (optional)
        │  scrapes Turo tabs                          │  OAuth, opt-in
        │  auto-syncs every 1–5 min                    │
        ▼                                              ▼
  POST /api/turo/sync, /api/turo/messages    NextAuth session + Gmail API
        │  (bearer pairing-key auth)                   │
        └──────────────┬───────────────────────────────┘
                        ▼
                   Supabase (Postgres)
                        │
                        ▼
              Next.js 16 / React 19 / App Router
              (public shell — no login required to view)
Governing decisions:

Public shell. No route hard-gates on a session — src/proxy.ts was deleted, (app)/layout.tsx carries no redirect. Google sign-in is opt-in and required only by the specific pages that consume Gmail.
Companion is independent of Google. It authenticates via a bearer pairing key tied to a single seeded hosts row, not a Google session — it works with zero Gmail connection.
Companion wins on overlap. Wherever both pipelines can produce the same data (pickups, returns, vehicles, reservations), Companion's real scraped timestamps and plates are preferred over Gmail's heuristic subject-line parsing.
AI is quarantined. Exactly one surface — the AI Briefing card — calls a model. Butler recommendations, Fleet Health scoring, and all sorting are plain rule-based TypeScript, so the app is fully functional with no AI key configured.
2. File Structure
hostos/
├── src/
│   ├── app/
│   │   ├── (app)/                    # public-shell pages
│   │   │   ├── page.tsx              # Overview
│   │   │   ├── operations/           # today's pickups / returns / messages
│   │   │   ├── inbox/                # Gmail-only
│   │   │   ├── fleet/ , fleet/[vehicle]/
│   │   │   ├── butler/               # rule-based recommendations + automation toggles
│   │   │   ├── insights/
│   │   │   ├── connectors/           # Google + Companion pairing
│   │   │   ├── settings/ , knowledge/
│   │   │   └── reservations/ , notifications/ , automations/   # legacy, some now redirect
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── ihost/analyze/ , ihost/briefing/
│   │   │   └── turo/sync/ , turo/messages/
│   │   ├── login/
│   │   └── globals.css               # Aurora design tokens
│   ├── components/
│   │   ├── dashboard/                # 11 cards — briefing, messages, health, schedule, etc.
│   │   └── auth/ , automations/ , knowledge/ , inbox/ , settings/ , shell/ , ihost/ , ui/
│   ├── lib/
│   │   ├── ai/                       # provider abstraction — gemini.ts is the only impl.
│   │   ├── dashboard/queries.ts      # 708 lines — merges Gmail + Companion into UI shapes
│   │   ├── gmail/ , turo/ , trips/ , messages/ , host/ , knowledge/ , automations/
│   │   ├── actions/                  # server actions
│   │   └── supabase/server.ts        # lazy client + isUndefinedTableError()
│   └── types/
├── supabase/migrations/              # 0001 – 0004
└── (extension, separate folder)
    Random Files/HostOS_Extension_v2_Preview/Host Haven Pro/
    ├── manifest.json                 # "HostOS Companion" v2.0.0
    ├── background.js                 # chrome.alarms: 1 min trips, 5 min messages
    ├── sync.js                       # buildSyncPayload, performSync, performSyncMessages
    ├── content.js                    # scrapeTrips, scrapeReservationMessages, …
    ├── generator.js / parser.js / formatter.js / matcher.js / fleet.js / fleetStore.js / availability.js
    └── popup.js / .html / .css       # Operations / Vehicles / Activity / Sync tabs
3. Components
Component	Data source	Notes
GuestMessagesCard	/api/turo/messages (Companion)	No AI. Polls every 20s. Full-width, sits first — above the AI card by design.
AiBriefingCard	/api/ihost/briefing (Gemini)	The only AI-dependent surface. States: not-signed-in / not-configured / no-messages / failed.
FleetHealthCard	getDashboardData()	Deterministic score (100 − penalties), never AI-generated.
ScheduleCard ×2	Companion preferred, Gmail fallback	Today's pickups / today's returns.
MessagesCard	Gmail	
ActivityCard	mixed	
SuggestionsCard	mixed	Butler's Overview preview — links through to /butler.
CalendarTimelineCard	mixed	
FleetStatusGrid	Companion preferred	Date-aware "on trip" detection (see §6).
4. Database Schema
Supabase / Postgres, 4 migrations. Every table: RLS enabled, zero policies — reachable only through the service-role key from server-only code.

Migration	Tables	Keyed by
0001_gmail_sync.sql	gmail_accounts, synced_emails	user_email
0002_knowledge_automations.sql	knowledge_base, automation_settings	user_email — inconsistent, see §6
0003_trips.sql	hosts (single seeded row), vehicles, trips, trip_events	host_id
0004_trip_messages.sql	trip_messages	host_id
5. APIs
Route	Method	Auth	Purpose
/api/auth/[...nextauth]	GET / POST	NextAuth	Google OAuth
/api/ihost/analyze	POST	session-optional	Single-message AI classification
/api/ihost/briefing	GET	session-required	AI summary of synced Gmail
/api/turo/sync	POST	Bearer pairing key	Companion trips + vehicle roster — dedupes, prunes retired vehicles
/api/turo/messages	POST	Bearer pairing key	Companion guest-message ingestion
/api/turo/messages	GET	none	See §6, item 1
6. Outstanding Bugs
GET /api/turo/messages has no authentication. Anyone who reaches the URL — signed in or not — receives every guest's message content as raw JSON.
fleet.js still hardcodes 21 vehicles, none matching a real trip seen this session — suspected stale data from a prior client relationship. Awaiting confirmation on which to remove.
TEST123 test row likely still present in trips.
Gemini quota was returning 429 as of the last check — unrelated to code.
knowledge_base / automation_settings are Google-session-keyed, not host_id-keyed like everything built since — a Companion-only host can't save Knowledge or toggle Automations.
Nothing committed since Sprint 3 — resolved, 5f97097.
src.zip (125 KB, untracked, origin unclear) still sitting at the repo root.
Operations and Overview don't live-refresh after a Companion sync completes — only Guest Messages polls.
Both extension sync loops require an open Turo tab to fire at all.
7. Current TODO
 Decide on fleet.js's 21 hardcoded vehicles
 Confirm all 4 migrations have run in production
 Delete the TEST123 test row
 Resolve the Gemini quota
 Add auth to GET /api/turo/messages
 Move knowledge_base / automation_settings to host_id-keying
 Decide the fate of src.zip
 Real-time refresh for Operations / Overview, instead of manual reload
8. Recent Decisions
App is a public shell; authentication is per-feature, never global.
Companion is host_id-keyed and treated as authoritative over Gmail.
AI usage confined to exactly one card; the rest of the app is deterministic.
Trello integration fully removed from the extension; rebranded to HostOS Companion.
Dual auto-sync timers: 1 minute for trips, 5 minutes for messages.
Guest messages scraped directly from Turo (not just Gmail previews) and prioritized above the AI card, per explicit product direction.
Vehicle "on trip" status made date-aware, after discovering action: "checkout" means "next event is a checkout" — which can be months out, not imminent.
AI provider migrated Anthropic → OpenAI → Gemini, landing behind a provider-agnostic abstraction in src/lib/ai/.
9. Coding Standards
Query modules never throw — every src/lib/*/queries.ts function wraps its Supabase call and degrades to [] / null, so a missing table or bad env var takes down one feature, never a page.
Shared helpers over ad hoc checks: isUndefinedTableError(), isSupabaseConfigured().
rowToX() converters map snake_case rows to camelCase domain types, one per module.
Server actions return { ok, error? } and never throw to the client.
Comments explain why, not what — several cite the specific past bug that shaped the current code.
Lint clean at every checkpoint — zero errors or warnings before anything is called done.
Design tokens live in globals.css; dark-mode-first Aurora palette (#0D1117 / #161B22 / #4F8CFF).
Framer Motion throughout, one consistent easing curve.
Every feature verified with lint + build + a live browser check before being reported complete.