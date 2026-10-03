-- HostOS — migration 0024: workspace roles and invitations
-- Additive and idempotent. Safe to run twice.
--
-- host_members has carried three roles since 0009 (owner / member / viewer).
-- A platform for many businesses needs two more between owner and member —
-- an admin who can manage people and integrations without being the owner,
-- and a manager who can change how the workspace runs (knowledge, templates,
-- alerts) without being able to add or remove anyone. The permission matrix
-- lives in src/lib/roles/permissions.ts; this only widens what the column
-- may hold and records how each membership came to exist.

alter table host_members add column if not exists invited_by text;
alter table host_members add column if not exists invited_at timestamptz;
alter table host_members add column if not exists accepted_at timestamptz;
alter table host_members add column if not exists display_name text;

-- A role the app does not know is treated as 'viewer' on read (least
-- privilege), so this check is documentation as much as enforcement.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'host_members'::regclass and conname = 'host_members_role_check'
  ) then
    alter table host_members
      add constraint host_members_role_check
      check (role in ('owner', 'admin', 'manager', 'member', 'viewer'));
  end if;
end $$;

-- Existing rows predate invitations; mark them accepted so the roster does
-- not show every founding member as "invited, not yet joined".
update host_members set accepted_at = coalesce(accepted_at, created_at);
