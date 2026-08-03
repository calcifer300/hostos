-- Sprint 3: Gmail sync storage.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).
-- Both tables are accessed exclusively through the service-role key from
-- server-only code (src/lib/supabase/server.ts) — RLS is enabled with no
-- policies so the anon/authenticated keys can never read or write them.

create table if not exists gmail_accounts (
  user_email text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table gmail_accounts enable row level security;

create table if not exists synced_emails (
  id text primary key,                    -- Gmail message id
  user_email text not null,               -- the HostOS user this message was synced for
  thread_id text,
  from_name text,
  from_email text,
  subject text,
  snippet text,
  body text,
  received_at timestamptz not null,
  is_unread boolean not null default true,
  guest_name text,                        -- best-effort heuristic parse, may be null
  vehicle text,                           -- best-effort heuristic parse, may be null
  synced_at timestamptz not null default now()
);

alter table synced_emails enable row level security;

create index if not exists synced_emails_user_received_idx
  on synced_emails (user_email, received_at desc);
