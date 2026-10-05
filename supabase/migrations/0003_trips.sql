-- Project Aurora Phase 1: Companion sync foundation.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).
--
-- Unlike 0001/0002 (user_email-keyed, tied to a Google session), these
-- tables are host_id-keyed: the app is moving to a public shell where
-- viewing/using HostOS never requires signing in, so tenancy for
-- Companion-sourced data is anchored to the pairing API key, not a Google
-- session. Gmail-derived tables are untouched and still key on user_email,
-- present only once a host optionally connects Google.
--
-- Same access model as prior migrations: RLS enabled with no policies, so
-- the anon/authenticated keys can never read or write these tables —
-- access is exclusively through the service-role key from server-only code
-- (src/lib/supabase/server.ts).

create table if not exists hosts (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,                       -- filled in once Google is connected; null until then
  companion_api_key text unique,    -- bearer token the extension authenticates with; null until generated
  created_at timestamptz not null default now()
);

alter table hosts enable row level security;

-- Exactly one host row for this deployment. A fixed, known id means no
-- bootstrap race and no setup flow is needed — every query can resolve
-- "the host" without any identity/session resolution.
insert into hosts (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Host')
on conflict (id) do nothing;

create table if not exists vehicles (
  host_id uuid not null references hosts(id),
  plate text not null,
  year text,
  color text,
  make text,
  model text,
  lockbox text,
  permit text,
  updated_at timestamptz not null default now(),
  primary key (host_id, plate)
);

alter table vehicles enable row level security;

create table if not exists trips (
  id text primary key,              -- Turo reservation number
  host_id uuid not null references hosts(id),
  guest_name text,
  plate text,                       -- soft reference to vehicles(plate) — a trip may arrive for an unmatched plate
  vehicle_make text,
  vehicle_model text,
  vehicle_year text,
  action text,                      -- "checkin" | "checkout" | "skip" (raw extension vocabulary)
  skip_reason text,
  start_ts timestamptz,
  end_ts timestamptz,
  date_label text,                  -- raw scraped date label, e.g. "7/19", for reference/debugging
  extras jsonb not null default '[]',
  raw jsonb,                        -- full incoming record, forward-compatible with fields not yet modeled
  synced_at timestamptz not null default now()
);

alter table trips enable row level security;

create index if not exists trips_host_synced_idx on trips (host_id, synced_at desc);

create table if not exists trip_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id),
  trip_id text not null,
  kind text not null,               -- "created" | "rescheduled" | "cancelled" | "plate_changed"
  description text not null,        -- human-readable, e.g. "Check-out moved 7/19 6:30 PM -> 7/20 9:00 AM"
  payload jsonb,
  occurred_at timestamptz not null default now()
);

alter table trip_events enable row level security;

create index if not exists trip_events_host_occurred_idx on trip_events (host_id, occurred_at desc);
