-- Sprint 4: database-backed Knowledge base and Automations framework.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).
-- Same access model as 0001: service-role only, RLS on with no policies, so
-- the anon/authenticated keys can never read or write these tables.

create table if not exists knowledge_base (
  user_email text primary key,
  check_in_process text not null default '',
  house_rules text not null default '',
  policy text not null default '',
  tone text not null default '',
  updated_at timestamptz not null default now()
);

alter table knowledge_base enable row level security;

-- One row per (host, automation). The rule catalog itself lives in code
-- (src/lib/automations/definitions.ts); this table stores only whether a
-- host has switched a rule on.
create table if not exists automation_settings (
  user_email text not null,
  automation_id text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_email, automation_id)
);

alter table automation_settings enable row level security;
