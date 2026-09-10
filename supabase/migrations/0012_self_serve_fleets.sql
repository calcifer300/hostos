-- Self-serve fleet provisioning.
--
-- 0009 added the membership table that maps a person to the fleets they may
-- see, but nothing ever creates a row in it. The only membership in
-- production was inserted by hand. So a new Google account signs in, resolves
-- to NO_FLEET_HOST_ID, and every page renders empty with no way forward —
-- which is why HostOS could only ever serve one operator.
--
-- This migration adds the one thing provisioning needs to be safe: a way to
-- ask "does this person already own an auto-created fleet?" atomically.

-- The account whose first sign-in created this fleet.
--
-- Nullable, because the original seeded fleet ('Matthew's Fleet') predates
-- this and must keep working untouched. Only auto-provisioned fleets set it.
alter table hosts add column if not exists created_by_email text;

-- THIS INDEX IS THE CONCURRENCY CONTROL, not a lookup optimisation.
--
-- Provisioning runs during a page render, and a browser opening the app fires
-- several requests at once (the document, then RSC fetches for prefetched
-- links). Without a uniqueness constraint, "select, see nothing, insert"
-- races with itself and one user ends up owning three fleets, each holding a
-- different slice of their synced data.
--
-- With it, concurrent inserts collapse: the first wins, the rest hit the
-- conflict and re-read the winner's row. See lib/host/provision.ts.
--
-- Partial, so the pre-existing rows with a null created_by_email don't
-- collide with each other.
create unique index if not exists hosts_created_by_email_idx
  on hosts (created_by_email)
  where created_by_email is not null;

-- Backfill: the seeded fleet is owned by the account that has been operating
-- it, so a re-run of provisioning for that account finds the existing fleet
-- rather than creating a second one alongside it.
--
-- Written as a correlated update against host_members instead of a hardcoded
-- address so this migration carries no personal data, and so it does the
-- right thing on any deployment that already hand-inserted an owner.
update hosts h
   set created_by_email = m.user_email
  from (
    select distinct on (host_id) host_id, user_email
      from host_members
     where role = 'owner'
     order by host_id, created_at asc
  ) m
 where m.host_id = h.id
   and h.created_by_email is null;

-- Fleet display name, tightened.
--
-- `name` has been nullable since 0003 and the UI falls back through
-- name -> slug -> a truncated uuid. That fallback is fine as a safety net but
-- a fleet with no name is not a state worth being able to reach, now that
-- every fleet is named at creation from the owner's Google profile.
update hosts set name = 'Fleet' where name is null or btrim(name) = '';
