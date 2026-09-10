-- Per-user role assignments — replaces the hardcoded "Co-host/VA" constant
-- that used to live in src/components/auth/user-menu.tsx. Keyed by the
-- signed-in Google account's email (the only identity HostOS has), same
-- access model as every other table: RLS enabled, zero policies, reachable
-- only through the service-role key from server-only code.
--
-- A user can hold more than one role at once (e.g. "Co-host/VA" and
-- "Developer" for the same person), hence text[] rather than a single
-- enum column. Nobody is assigned a role by default — an email with no row
-- here just shows no role badge — so this only ever grants what's
-- explicitly assigned via Settings, never anything automatically.

create table if not exists user_roles (
  user_email text primary key,
  roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_roles enable row level security;

insert into user_roles (user_email, roles)
values ('johnbriones774@gmail.com', array['Founder', 'Lead Developer', 'Co-host/VA'])
on conflict (user_email) do update set roles = excluded.roles, updated_at = now();
