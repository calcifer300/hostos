-- Guest message threads scraped from Turo reservation detail pages by the
-- HostOS Companion extension (src/app/api/turo/messages/route.ts writes
-- this; src/lib/messages/queries.ts reads it). Same access model as prior
-- migrations: RLS on, no policies, service-role key only.
--
-- message_time/date_label are kept as the raw scraped strings ("1:01 AM",
-- "THU, FEB 8, 2024") rather than a constructed timestamp — the scraper has
-- no reliable timezone signal to build a real timestamptz from, and a
-- fabricated one would be worse than an honest raw string.

create table if not exists trip_messages (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id),
  trip_id text not null,          -- Turo reservation number
  guest_name text,
  plate text,
  body text not null,
  from_host boolean not null default false,
  message_time text,
  date_label text,
  synced_at timestamptz not null default now(),
  unique (host_id, trip_id, body, message_time)
);

alter table trip_messages enable row level security;

create index if not exists trip_messages_host_synced_idx
  on trip_messages (host_id, synced_at desc);
