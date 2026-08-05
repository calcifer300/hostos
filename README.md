# HostOS v0.1

The AI employee is **iHost**. This is the first vertical slice: turn an inbound Turo email into classified, explained, drafted guest communication.

## Run it

```
npm install
cp .env.local.example .env.local   # then add your real Gemini API key
npm run dev
```

Open http://localhost:3000. iHost starts "watching your inbox," then a seeded example email arrives and plays through the full pipeline automatically. Use "Next example" to cycle through three different event types, or paste a real guest message to run it live against your own text.

## The application shell

`src/components/shell/` is the permanent navigation frame every page lives inside — a desktop rail on `md+`, a slide-in drawer below it, both reading from one `navItems` array so adding a section later means one array edit, not a rewrite of two nav implementations.

Seven routes exist today: `/` (Home — the real iHost briefing) and six placeholders (`/inbox`, `/reservations`, `/knowledge`, `/automations`, `/notifications`, `/settings`) rendered by a single shared `SectionPlaceholder` component. Those six are real Next.js routes that really render and really navigate — they're just honest about not having features behind them yet, per "build the shell, not features yet." Each placeholder's copy says specifically what's missing and why, rather than showing empty tables or fake widgets pretending to be functional.

## What's real vs staged

**Real, and calling a live model:**
- `GET /api/ihost/briefing` summarizes your newest synced Gmail messages into the dashboard's AI briefing. Headline, highlights, and priorities are all model-generated from real message content — none of that copy is hardcoded.
- `POST /api/ihost/analyze` runs a single message through classification, summary, action reasoning, and reply drafting. Nothing about it is mocked.
- Both call Google Gemini server-side with `GEMINI_API_KEY` from your environment, through the provider layer in `src/lib/ai/`. `GEMINI_MODEL` overrides the `gemini-2.5-flash` default; `AI_PROVIDER` selects the provider.
- Without `GEMINI_API_KEY`, the briefing card shows a calm "AI briefings are turned off" notice reading "Gemini API key is missing.", and the rest of HostOS — login, Gmail sync, Inbox, dashboard — keeps working normally.
- The classification vocabulary, confidence bands, and escalation logic (`src/lib/ihost/prompt.ts`) implement the iHost Charter's Articles VI-VII directly, not a paraphrase of them.
- Copy-to-clipboard and "Open in Turo" are real browser actions.
- The reply is genuinely editable before copying — nothing about steps 6-9 of the MVP workflow is simulated.

**Staged, and clearly marked as such in code comments:**
- Steps 1-2 of the MVP workflow ("Gmail receives an email" / "HostOS detects it") are not implemented. `src/lib/mock/seed-emails.ts` stands in for what a real Gmail Connector would deliver via push notifications. That connector — OAuth, token storage, a webhook endpoint — is genuinely new infrastructure and is scoped as the next slice, not silently faked here.
- The Knowledge Base (`defaultKnowledgeBase` in the same file) is a hardcoded stand-in for a real per-host settings screen. The shape matches what a real Knowledge Base record would be; there's no UI to edit it yet in v0.1.

## Architecture notes

- `src/types/ihost.ts` — canonical domain types. No Turo-specific or Trello-shaped fields; `TuroEventType` is a classification vocabulary, not a wrapper around Turo's own notification types.
- `src/lib/ai/` — the provider layer. `types.ts` defines the `AiProvider` contract (`generateJson`, `isConfigured`) and `AiNotConfiguredError`; `gemini.ts` implements it against `@google/genai`; `index.ts` holds the registry and picks one via `AI_PROVIDER`. iHost never imports a vendor SDK directly, so adding a provider later is one new file plus a registry entry — no prompt or call-site changes.
- `src/lib/ihost/prompt.ts` + `src/lib/ihost/analyze.ts` — the single-message "brain." One function builds the system prompt, one calls the model and parses the result. Nothing about iHost's behavior is scattered across components.
- `src/lib/ihost/briefing.ts` — the multi-message digest behind the dashboard card. Same rules, batched across your latest synced mail.
- `src/components/ihost/*` — one component per concern (arrival, classification badge, analysis, reply editor), each usable independently once a real Gmail Connector replaces the seed data.
- `src/components/ui/*` — shadcn-pattern primitives (Button, Textarea, Card, Badge), hand-written rather than pulled via the shadcn CLI, because `ui.shadcn.com` isn't reachable from this build environment's network policy. Same conventions (cva variants, Radix Slot, Tailwind tokens) — a real shadcn CLI run against these files would recognize them as its own output.

## Next slice

The literal next piece of infrastructure, per the roadmap discussion: a real Gmail Connector (OAuth + push notifications) replacing `seed-emails.ts`, and a minimal Knowledge Base settings screen replacing the hardcoded default. Both are additive — nothing in `src/lib/ihost/` or `src/components/ihost/` needs to change to support them.
