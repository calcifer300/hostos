# HostOS

An operations dashboard for Turo hosts. Next.js 16 · React 19 · Supabase · a Chrome extension that does the scraping.

Every signed-in user gets their own fleet, named from their Google profile and renameable in Settings. Fleets never see each other's data.

This is the merged build: HostOS plus Karl's five automation tools, converged
into one web app and one extension. See [What came from where](#what-came-from-where).

## What came from where

Each tool was ported into the app's own architecture rather than wrapped, and
the parts that were wrong were fixed rather than carried across.

| Karl's tool | Where it lives now | What changed |
|---|---|---|
| **turo-tracker v2.55** | `lib/timezones`, `lib/board/bulk-paste`, `lib/board/countdown`, `/board` | His parser and countdown engine, typed and tested. Timezone detection gained a city pass — the original fell back to Central for anything unreadable, which puts a Kahului pickup five hours out and presents it as fact. |
| **turo-cohost-manager v0.7.3** | `components/board/timezone-clocks` | Superseded by the tracker, which is the later and better of his two. The live clock bar survives, driven by the fleets you're actually on rather than a fixed row of five US zones. |
| **Turo-Context-Library** | `turo_articles`, `/library`, `lib/ihost/prompt` | 725 help articles, full-text searchable — and wired into reply grounding, which is the point of having them here rather than in a separate tool. |
| **ai-reply-extension v1.2** | `extension/assist.js`, `/api/companion/draft` | Drafts now come from HostOS, grounded in the fleet's knowledge base and the relevant Turo policy, using the pairing key. His version called Gemini directly with no context. |
| **browser-content-scanner v1.2** | `extension/alerts.js` | Rule model kept, polling dropped. Sync already returns the events HostOS recorded, so alerts come from a diff that names what changed rather than keyword-matching every open tab. |

Originals are kept unmodified in `../vendor/` for reference.

### The board

`/board` is the one genuinely new surface. Every other page shows ONE fleet —
whichever the switcher is set to. A co-host watching nine hosts across five
timezones needs them in one list sorted by what blows up next, or the switcher
becomes nine tabs checked in rotation.

It needs no new tenancy concept: `host_members` already allows one person on
many fleets. Countdowns recompute client-side every second from the same engine
the server rendered with — a server-rendered "2h 14m" is wrong the moment it
paints.

Two overdue states are tracked separately, because they need opposite actions:
the guest never collected the car, versus the guest never brought it back. A
single flag keyed off the end time never fires for a trip that never began.

The board falls back to the pre-0014 columns when that migration hasn't run,
so deploying ahead of it degrades to a working board without the co-host
fields rather than an empty one.

## Tests

```bash
npm test
```

No framework: the ported engines are pure functions, so a runner would be more
setup than the tests. `tests/alias-hook.mjs` teaches Node's type-stripping the
`@/` alias so library code doesn't switch to relative imports just because it
happens to be covered.

65 assertions over timezone maths (including both DST changeovers), the bulk
parser (against a real Turo list — curly apostrophes, doubled guest names, the
"Swap pending" prefix line), and the countdown engine.

## How the pieces fit

```
  HostOS Companion (Chrome extension)          Google Gmail (optional)
          │  reads turo.com in your browser              │  OAuth, opt-in
          │  6 background loops, 1min – 6h               │
          ▼                                              ▼
   POST /api/turo/{sync,messages,                NextAuth session
        license-status,enrichment}                + Gmail API
          │  Authorization: Bearer <pairing key>          │
          └──────────────────┬───────────────────────────┘
                             ▼
                    Supabase (Postgres)
                    every table host_id-keyed
                             │
                             ▼
                  Next.js 16 App Router
```

**The Companion is the only real data source.** Gmail is supplementary and
entirely optional; a fleet that never connects Google works fully. A fleet that
never installs the Companion sees an empty dashboard and a setup checklist
explaining why.

The extension authenticates with a per-fleet pairing key, not a Google session,
so it works for operators who have no Google account at all.

## Run it locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the values it documents
npm run dev
```

`npm run build` packages the extension into `public/hostos-companion.zip`
before building the app, so the download a deployment serves always matches
the extension source in that commit.

### Environment

Only two variables are genuinely required — `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Everything else turns a feature on. Startup prints
exactly what is missing and what each absence disables; see `src/lib/env.ts`.

| Variable | Without it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Every data-backed page renders empty. Must be the **service-role** key — RLS is on with no policies, so an anon key reads back as empty tables. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No sign-in, so no fleets. |
| `AUTH_SECRET` | Sessions break in production. `npx auth secret` generates one. |
| `GEMINI_API_KEY` | The AI Briefing card only. Every other surface is deterministic. |
| `HOSTOS_REQUIRE_AUTH` | Defaults on in production, off in development. |
| `CRON_SECRET` | `/api/cron/digest` refuses to run rather than exposing a URL that emails people on demand. |
| `RESEND_API_KEY` + `DIGEST_FROM_EMAIL` | Digests are computed but not sent. |
| `GMAIL_SYNC_ENABLED` | Gmail sync stays off. Off by default. |

### Database

Run `supabase/migrations/*.sql` in order against your Supabase project. They are
additive and idempotent — re-running is safe.

**Migration order matters for 0012 and 0013.** Apply them *before* deploying the
code that reads them: 0013 moves the knowledge base from `user_email` to
`host_id`, and code deployed ahead of it reads a column that doesn't exist and
falls back to the shipped default house rules.

## Multi-tenancy

`src/lib/host/context.ts` resolves which fleet a request operates on, and it is
the only place that decision lives. Every query takes that host id.

- **First sign-in provisions a fleet.** `src/lib/host/provision.ts` creates it,
  names it from the Google profile, and makes the user its owner.
- **The race is real.** Opening the app fires the document plus several RSC
  prefetches at once, each a separate invocation with its own React cache. The
  partial unique index on `hosts.created_by_email` is what stops one person
  ending up with three fleets; the losing insert re-reads the winner.
- **Provisioning lives inside the cached `getFleetsForUser`,** not in a layout.
  A layout and the pages beneath it render in *parallel*, so a layout that
  provisions on render loses to a page resolving its host id first.
- **No fleet resolves to `NO_FLEET_HOST_ID`,** a valid uuid that matches no row.
  Every query then returns empty by construction, so no code path has to
  remember to check.

## Auth

`src/middleware.ts` is the gate, and it must stay middleware. Two earlier
attempts put it in a layout and both leaked: in the App Router a layout and its
child page render in parallel, so a layout refusing to render `{children}`
does not stop the page beneath it from running its queries — and the result is
serialised into the RSC payload of the same response. Measured against a
production build, both `<SignInRequired />` (200) and `redirect("/login")` (307)
carried guest names, plates and vehicle models in the body.

`/api/turo/*` is exempt because the extension authenticates with a bearer key
and has no session cookie; those routes do their own auth
(`src/lib/api/companion-auth.ts` for ingest, `browser-auth.ts` for the GETs).

## Conventions

- **Query modules never throw.** Every `src/lib/*/queries.ts` function wraps its
  Supabase call and degrades to `[]` / `null`, so a missing table or a bad env
  var takes down one feature, never a page.
- **Server actions return `{ ok, error? }`** and never throw to the client.
- **Writes check `canEditCurrentFleet()`.** A hidden button is a UI convenience;
  a server action is a public endpoint.
- **AI is quarantined.** Exactly one surface calls a model. Butler
  recommendations, fleet health scoring, risk queues and all sorting are plain
  rule-based TypeScript.
- **Comments explain why, not what** — several cite the specific bug that
  shaped the code they sit above.
- Lint and build clean before anything is called done.

## The Companion extension

Source lives in `extension/`. It is MV3, excluded from the app's ESLint config
(its files share one global scope via `importScripts`, so cross-file functions
read as unused), and packaged by `scripts/build-extension.mjs`.

That script writes the ZIP itself with `node:zlib` rather than shelling out —
`Compress-Archive` is Windows-only and `zip` is missing from some Linux build
images, and the archive has to come out identical on a laptop and on a build
container.

Users install it from **Connectors**: download, unzip, load unpacked, paste the
pairing key. The extension defaults its HostOS URL to the deployment, so pairing
is one paste.
