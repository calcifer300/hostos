# HostOS

An operations dashboard for Turo hosts. Next.js 16 · React 19 · Supabase · a Chrome extension that does the scraping.

Every signed-in user gets their own fleet, named from their Google profile and renameable in Settings. Fleets never see each other's data.

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
