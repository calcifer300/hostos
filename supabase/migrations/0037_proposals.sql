-- HostOS — migration 0037: the internal Client Proposal Center.
--
-- One row per client proposal. The whole proposal is a single JSON document
-- (src/lib/proposals/types.ts holds the shape and makes any stored value
-- whole), so a proposal can be duplicated, versioned and edited without a
-- schema change every time the sales story grows.
--
-- `share_token` is null until an admin deliberately turns sharing on for one
-- proposal; the Proposal Center itself is behind the app's auth gate and is
-- never public. `proposal_events` records opens of a shared link so the team
-- can see whether the client actually read it.

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  -- what the sales team sees in the list
  title text not null,
  client_company text not null default '',
  client_contact text not null default '',
  client_email text not null default '',
  industry text not null default '',
  -- draft · sent · viewed · won · lost
  status text not null default 'draft',
  -- the proposal itself
  doc jsonb not null default '{}'::jsonb,
  -- internal-only notes; never rendered in the client view
  notes text not null default '',
  -- null = not shared. A random, unguessable token when sharing is turned on.
  share_token text unique,
  version integer not null default 1,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_status_idx on proposals (status, updated_at desc);
create index if not exists proposals_share_token_idx on proposals (share_token) where share_token is not null;

-- Every save keeps the previous document, so a proposal can be rolled back.
create table if not exists proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  version integer not null,
  doc jsonb not null,
  saved_by text,
  saved_at timestamptz not null default now()
);

create index if not exists proposal_versions_proposal_idx on proposal_versions (proposal_id, version desc);

-- Opens, section reads and CTA clicks on a shared proposal.
create table if not exists proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  kind text not null,
  detail text not null default '',
  at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_idx on proposal_events (proposal_id, at desc);

-- Only the service role reads and writes these tables; nothing reaches them from the browser.
alter table proposals enable row level security;
alter table proposal_versions enable row level security;
alter table proposal_events enable row level security;
