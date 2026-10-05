-- HostOS — migration 0021: public site
-- Additive and idempotent. Safe to run twice.

-- Messages sent through the landing page's contact form. Not fleet-scoped —
-- the sender has no account yet. Read by nobody but an operator with the
-- service-role key; RLS on, no policies, same as every other table.
create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  company text,
  -- The service they picked from the form's list.
  interest text,
  message text not null,
  -- Where the request came from (page path, campaign), for later attribution.
  source text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table contact_requests enable row level security;

create index if not exists contact_requests_created_idx on contact_requests (created_at desc);
