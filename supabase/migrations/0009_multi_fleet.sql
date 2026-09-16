-- Multi-fleet support.
--
-- Every data table (trips, vehicles, trip_messages, trip_events) has been
-- host_id-keyed since migration 0003, so the storage layer was already
-- multi-tenant. What was missing is the mapping from a signed-in person to the
-- fleet(s) they may see: the app resolved a single hardcoded
-- '00000000-0000-0000-0000-000000000001' everywhere instead.
--
-- Adding membership here rather than reusing user_roles because the two answer
-- different questions. user_roles is global ("is this person a developer?");
-- membership is per-fleet ("may this person see Matt's Denver fleet?"). One
-- person can hold different roles on different fleets.

create table if not exists host_members (
  host_id uuid not null references hosts(id) on delete cascade,
  user_email text not null,
  -- 'owner'  — full control, may invite and remove members
  -- 'member' — full read/write on fleet data
  -- 'viewer' — read only
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (host_id, user_email)
);

alter table host_members enable row level security;

-- Lookups go both ways: "which fleets can this person see" on every page
-- render, and "who is on this fleet" on the settings screen.
create index if not exists host_members_email_idx on host_members (user_email);

-- A human-readable identifier for the fleet, used in the switcher and in URLs.
-- Nullable so existing rows stay valid; the app falls back to name, then id.
alter table hosts add column if not exists slug text;
create unique index if not exists hosts_slug_idx on hosts (slug) where slug is not null;

-- Timezone is per-fleet, not global. HOST_TIMEZONE was hardcoded to
-- America/Denver in lib/dashboard/queries.ts, which silently mis-labels
-- "today" for any fleet operating elsewhere — the exact class of bug the
-- greeting header already documents.
alter table hosts add column if not exists timezone text not null default 'America/Denver';

-- Seed the existing fleet so nothing changes for the current deployment.
update hosts
   set slug = coalesce(slug, 'denver')
 where id = '00000000-0000-0000-0000-000000000001';
