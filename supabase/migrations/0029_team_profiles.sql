-- HostOS — migration 0029: the public "Our Team" roster
-- Additive and idempotent. Safe to run twice.
--
-- Company-wide (no host_id): the people, titles, responsibilities and photos
-- shown on hostoscollective.com/team. Edited only by the Founder
-- (lib/actions/team-page.ts checks isFounderEmail). Until a row exists the
-- page shows the defaults in src/lib/team/profiles.ts.
create table if not exists team_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text not null,
  department text not null default 'operations',
  focus text[] not null default '{}',
  quote text not null default '',
  responsibilities text[] not null default '{}',
  photo_url text,
  email text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table team_profiles enable row level security;
drop trigger if exists team_profiles_set_updated_at on team_profiles;
create trigger team_profiles_set_updated_at before update on team_profiles
  for each row execute function set_updated_at();
