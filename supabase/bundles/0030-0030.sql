-- HostOS — migrations 0030 to 0030, bundled 2026-09-16
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0030_team_profile_hue.sql
-- ======================================================================
-- HostOS — migration 0030: a colour per person on the team roster
-- Additive and idempotent. Safe to run twice.
alter table team_profiles add column if not exists hue text;
