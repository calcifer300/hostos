-- HostOS — migration 0017: platform repairs found by the unification audit
-- Additive and idempotent. Safe to run twice. Nothing is dropped except two
-- primary-key constraints that are immediately replaced (see section 2).
--
-- Every item here is a defect the audit (docs/AUDIT.md §3) traced to a real
-- behaviour, not a tidy-up.

-- ============================================================ 1. updated_at

-- Every writer in the app sets updated_at by hand, which means the one that
-- forgets leaves a row claiming it was last touched months ago. One trigger
-- function, applied to every table that carries the column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'knowledge_base', 'automation_settings', 'user_roles',
    'alert_settings', 'gmail_accounts'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
      execute format(
        'create trigger %I before update on %I for each row execute function set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;

-- ============================================ 2. knowledge_base / automation_settings

-- Migration 0013 re-keyed both tables to host_id but left user_email as the
-- NOT NULL primary key from 0002. The app upserts { host_id, ... } with no
-- email — so for any fleet whose row was not backfilled (every fleet created
-- after 0013, and every Companion-only operator) the insert failed on the
-- not-null constraint and "Save" reported "Couldn't save that".
--
-- Fix: a surrogate id becomes the primary key, user_email becomes an optional
-- legacy column, and the host_id unique indexes from 0013 remain the keys the
-- app actually writes against.

alter table knowledge_base add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'knowledge_base'::regclass and conname = 'knowledge_base_pkey'
       and pg_get_constraintdef(oid) like '%user_email%'
  ) then
    alter table knowledge_base drop constraint knowledge_base_pkey;
    alter table knowledge_base add primary key (id);
  end if;
end $$;

alter table knowledge_base alter column user_email drop not null;

alter table automation_settings add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'automation_settings'::regclass and conname = 'automation_settings_pkey'
       and pg_get_constraintdef(oid) like '%user_email%'
  ) then
    alter table automation_settings drop constraint automation_settings_pkey;
    alter table automation_settings add primary key (id);
  end if;
end $$;

alter table automation_settings alter column user_email drop not null;

-- The unique indexes from 0013 are what the upserts conflict on. Re-asserted
-- here so this migration is complete on its own.
create unique index if not exists knowledge_base_host_idx
  on knowledge_base (host_id) where host_id is not null;
create unique index if not exists automation_settings_host_rule_idx
  on automation_settings (host_id, automation_id) where host_id is not null;

-- ================================================= 3. cascading fleet deletes

-- trips, trip_messages and trip_events were created (0003/0004) before the
-- cascade convention 0009+ use. Deleting a fleet would fail on the first
-- referencing row rather than take its data with it.
do $$
declare
  rec record;
begin
  for rec in
    select c.conname, c.conrelid::regclass::text as tbl
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'hosts'::regclass
       and c.conrelid::regclass::text in ('trips', 'trip_messages', 'trip_events', 'vehicles')
       and c.confdeltype <> 'c'
  loop
    execute format('alter table %I drop constraint %I', rec.tbl, rec.conname);
    execute format(
      'alter table %I add constraint %I foreign key (host_id) references hosts(id) on delete cascade',
      rec.tbl, rec.conname
    );
  end loop;
end $$;

-- ========================================================= 4. missing indexes

-- The vehicle detail page and the sync route's prune guard both ask "which
-- trips reference this plate on this fleet".
create index if not exists trips_host_plate_idx on trips (host_id, plate) where plate is not null;

-- Conversation lists sort by the newest message per trip.
create index if not exists trip_messages_host_trip_idx on trip_messages (host_id, trip_id, synced_at desc);

-- =========================================================== 5. host profile

-- The tenant row grows two descriptive fields the platform now needs: what
-- kind of operation this workspace runs (fleet, restaurants, or both — used
-- to shape the sidebar and the dashboard), and a short public-facing label.
alter table hosts add column if not exists modules text[] not null default '{fleet}';
alter table hosts add column if not exists brand_color text;
alter table hosts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists hosts_set_updated_at on hosts;
create trigger hosts_set_updated_at before update on hosts
  for each row execute function set_updated_at();
