-- 0034: HostOS is by invitation. Strangers ask; the Founder approves; only then does Google sign-in let them in.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  business text not null default '',
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create unique index if not exists access_requests_email_key on public.access_requests (lower(email));
alter table public.access_requests enable row level security;
-- no policies: only the service role (the app server) reads or writes this table
