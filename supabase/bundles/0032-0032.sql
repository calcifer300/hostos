-- HostOS — migrations 0032 to 0032, bundled 2026-09-16
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0032_site_content.sql
-- ======================================================================
-- HostOS — migration 0032: editable public-site content (the landing intro).
--
-- One row per piece of site content, as JSON, so the Founder can edit copy
-- and photographs from Settings → Website without a deploy. The code holds
-- the defaults and makes any stored value whole (src/lib/site/intro.ts).

create table if not exists site_content (
  key text primary key,
  value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Only the service role reads and writes this table; nothing reaches it from the browser.
alter table site_content enable row level security;
