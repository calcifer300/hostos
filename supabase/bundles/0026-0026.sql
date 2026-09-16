-- HostOS — migrations 0026 to 0026, bundled 2026-09-15
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0026_members_notes.sql
-- ======================================================================
-- HostOS — migration 0026: per-member verticals, quick notes, workspace names
-- Additive and idempotent. Safe to run twice.

-- ================================================ per-member verticals
--
-- A member can be limited to some of the verticals the workspace runs
-- ("Juan manages Shopify and Turo, nothing else"). Null means every vertical
-- the workspace runs; owners and admins always see everything regardless.
alter table host_members add column if not exists modules text[];
comment on column host_members.modules is
  'Verticals this member may open; null = every vertical the workspace runs. Owners and admins always see all.';

-- ======================================================== quick notes
--
-- A scratchpad that follows a person through the whole app, whatever page
-- or workspace they are on — so it is keyed by the person, not the host.
-- host_id only records where a note was written. Owners and admins only
-- (enforced in lib/actions/notes.ts).
create table if not exists quick_notes (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  host_id uuid references hosts(id) on delete set null,
  body text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quick_notes_user_idx on quick_notes (user_email, pinned desc, updated_at desc);
alter table quick_notes enable row level security;
drop trigger if exists quick_notes_set_updated_at on quick_notes;
create trigger quick_notes_set_updated_at before update on quick_notes
  for each row execute function set_updated_at();

-- ==================================================== workspace names
--
-- Workspaces provisioned before the seven verticals were auto-named
-- "<First>'s Fleet", which reads as "this workspace is Turo" once DoorDash
-- or Shopify is open in it. Provisioning says "Workspace" now; catch up the
-- ones already named. Only the auto-generated pattern is touched.
update hosts set name = regexp_replace(name, '''s Fleet$', '''s Workspace') where name ~ '''s Fleet$';
