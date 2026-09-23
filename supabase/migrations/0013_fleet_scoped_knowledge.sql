-- Re-key knowledge_base and automation_settings from user_email to host_id.
--
-- These two are the last tables from the pre-Companion era still keyed on a
-- Google address. That was right when they were written — 0002 predates the
-- hosts table entirely — but it produces two wrong behaviours now:
--
--   1. A co-host invited to a fleet gets their OWN empty knowledge base and
--      their own automation toggles. Two people running one fleet silently
--      operate on different configuration, and Butler grounds its replies in
--      whichever one happens to be signed in.
--   2. A Companion-only operator has no Google session at all, so they can
--      never save either. PROJECT_STATE has carried this as an open bug.
--
-- Both are per-FLEET settings, so they key on the fleet.
--
-- The old column is kept, not dropped. A migration that drops a column and a
-- deploy that stops writing it cannot be made simultaneous, and the gap
-- between them is a 500 on every save. Dropping is a later, separate step
-- once nothing reads it.

-- ---------------------------------------------------------------- knowledge

alter table knowledge_base add column if not exists host_id uuid references hosts(id) on delete cascade;

-- Backfill through membership: whoever owns a fleet had their knowledge base
-- attached to their address, so it becomes that fleet's knowledge base.
--
-- distinct on (host_id) because a fleet can have several owners and only one
-- row can win. Oldest membership first — that is the account that created the
-- fleet, and so the one whose knowledge base is the real one.
update knowledge_base k
   set host_id = m.host_id
  from (
    select distinct on (host_id) host_id, user_email
      from host_members
     where role = 'owner'
     order by host_id, created_at asc
  ) m
 where m.user_email = k.user_email
   and k.host_id is null;

-- One knowledge base per fleet. Partial so rows that could not be backfilled
-- (an address belonging to no fleet) stay put rather than blocking the index.
create unique index if not exists knowledge_base_host_idx
  on knowledge_base (host_id)
  where host_id is not null;

-- -------------------------------------------------------------- automations

alter table automation_settings add column if not exists host_id uuid references hosts(id) on delete cascade;

update automation_settings a
   set host_id = m.host_id
  from (
    select distinct on (host_id) host_id, user_email
      from host_members
     where role = 'owner'
     order by host_id, created_at asc
  ) m
 where m.user_email = a.user_email
   and a.host_id is null;

-- The upsert target for toggling a rule. The old (user_email, automation_id)
-- primary key stays as-is; this is the key the app now writes against.
create unique index if not exists automation_settings_host_rule_idx
  on automation_settings (host_id, automation_id)
  where host_id is not null;
