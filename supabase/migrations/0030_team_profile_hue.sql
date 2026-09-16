-- HostOS — migration 0030: a colour per person on the team roster
-- Additive and idempotent. Safe to run twice.
alter table team_profiles add column if not exists hue text;
