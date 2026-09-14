# vendor/ — reference material, not runtime

Nothing in this folder is imported, built, linted, type-checked or deployed. It exists so the
next person can see what each merged tool originally looked like without diffing five archives.

| Folder | What it is | Where it lives in the app now |
|---|---|---|
| `karl/archives/` *(git-ignored)* | Karl's original `.rar` archives and the unpacked `turo-cohost-manager` (web + Electron) | `src/lib/timezones`, `src/lib/board/*`, `/board`, `/library`, `extension/{assist,alerts,replyMatcher}.js`, `src/app/(app)/restaurants` |
| `cc-extension/` | The "HostOS — Turo Ops Assistant" extension built for Colorado Cruisers (with its git history and 2,100-line PROJECT_STATUS) | `src/lib/risk/*`, `/risk`, `extension/widget.js`, `src/lib/alerts/*` — see `docs/history/cc-project-status.md` |
| `legacy/hostos-v0.1/` *(git-ignored)* | The older clone of this same repository (`demo-polish` @ 5131605) | Superseded by the `unified` history at the root |
| `legacy/host-haven-pro-v2/` *(git-ignored)* | Companion extension 2.0.0 — older than the 2.1.0 in the legacy clone | `extension/` |
| `migration-helpers/` | The paste-into-SQL-Editor copies of migrations 0014–0016 (wrapped in `begin;`/`commit;`) | `supabase/migrations/0014–0016` are canonical |

Full classification with reasons: `docs/AUDIT.md`.
