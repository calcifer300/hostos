-- HostOS — migration 0038: the Command Center snapshot.
--
-- The HostOS extension scrapes Turo in a browser and sends one snapshot of the Command Center to the
-- workspace (POST /api/companion/command-sync, authenticated by the workspace's pairing key). Every number
-- and row in it was worked out by the extension, so the website only draws it. One row per workspace: the
-- latest snapshot replaces the previous one.
--
-- `built_at` is when the extension built it (so the page can say how old the data is);
-- `received_at` is when this server stored it.

create table if not exists command_snapshots (
  host_id uuid primary key references hosts(id) on delete cascade,
  snapshot jsonb not null,
  version integer not null default 1,
  built_at timestamptz not null,
  received_at timestamptz not null default now(),
  size_bytes integer not null default 0
);

alter table command_snapshots enable row level security;
