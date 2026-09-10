-- HostOS — migration 0014: cross-fleet board + Turo policy library
-- Paste into the Supabase SQL Editor and Run.
-- Additive and idempotent: new columns, three new tables, no drops.
-- Safe to run twice.

begin;

-- Karl's tooling, merged.
--
-- Two capabilities HostOS did not have, from two of Karl's tools:
--
--  1. A cross-fleet operations board. Karl's trackers exist because one VA
--     watches many hosts in many timezones at once, which HostOS could not
--     express — it shows one fleet at a time. host_members already allows one
--     person on many fleets, so the board needs no new tenancy concept, only
--     the per-trip fields Karl's engine runs on.
--
--  2. The Turo help centre, 725 articles, as searchable text. Today the
--     knowledge base holds only the host's OWN house rules, so a drafted reply
--     can be perfectly on-brand and still contradict Turo's actual policy.

-- =========================================================== trips, extended

-- Where the row came from. The Companion writes 'companion'; a VA pasting
-- Turo's trip list writes 'manual'.
--
-- This matters for pruning. Vehicles absent from a sync payload get retired
-- (see api/turo/sync), and if trips ever gain the same behaviour, a manual row
-- the Companion has never seen must not be swept up with it.
alter table trips add column if not exists source text not null default 'companion';

-- The trip's OWN timezone, as an IANA id.
--
-- start_ts/end_ts are absolute instants and always were, which is right for
-- storage and useless for the board: a VA covering Hawaii and Florida needs to
-- read each trip in ITS local wall time, not theirs. Karl's tracker detects
-- this from the pickup address — airport code first, then state — and flags
-- the thirteen states that genuinely span zones.
alter table trips add column if not exists timezone text;

-- True when the detected zone came from a state that spans more than one, so
-- the board can mark it for a human to confirm rather than quietly present a
-- guess as fact.
alter table trips add column if not exists timezone_uncertain boolean not null default false;

-- Free-text pickup/return location, as pasted. The Companion supplies plates
-- and reservation ids but not addresses; this is where the paste's address
-- lands, and what timezone detection reads.
alter table trips add column if not exists location text;

-- The operational status a VA actually works from, distinct from `action`
-- (which is the extension's raw scraped vocabulary: checkin/checkout/skip).
--
-- Karl's list, unchanged, because it maps to what a co-host does in a day:
--   Not Checked-In · Pending DL · Checked-In · Extended · Late
--   Not Checked-Out · Returned · Checked-Out · Canceled
--
-- Canceled rows stay visible and filterable rather than being deleted — a
-- guest cancellation is a record worth keeping.
alter table trips add column if not exists op_status text;

-- Who the trip belongs to, in the VA's own words ("Ethan", "Limitless Rentals
-- LLC"). A fleet has one name; a VA pasting a mixed list needs the per-trip
-- attribution Turo prints in "(Ethan's vehicle)".
alter table trips add column if not exists host_label text;

alter table trips add column if not exists notes text;

-- The board's primary sort is "what needs attention next across every fleet",
-- which reads start_ts and end_ts over a set of host_ids.
create index if not exists trips_board_idx on trips (host_id, op_status, start_ts);
create index if not exists trips_source_idx on trips (source) where source <> 'companion';

-- ============================================================= trip history

-- Every field edit, timestamped.
--
-- Karl's tracker logs these because a co-host team hands trips between people
-- and "who changed this pickup time, and when" is a real question. Bulk paste
-- also uses it: re-pasting an existing reservation shows a diff instead of
-- silently overwriting, and the accepted change is recorded here.
create table if not exists trip_history (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  trip_id text not null,
  -- Null for a system action (an import, a sync); an address for a person.
  actor_email text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

alter table trip_history enable row level security;

create index if not exists trip_history_trip_idx on trip_history (host_id, trip_id, created_at desc);

-- ============================================================ turo articles

-- Turo's public help centre, scraped by Karl's Turo-Context-Library.
--
-- NOT fleet-scoped, and deliberately so: this is Turo's own published policy,
-- identical for every operator on the platform. Scoping it per fleet would
-- mean 725 duplicated rows per signup to no purpose.
create table if not exists turo_articles (
  id text primary key,              -- Turo's own article slug
  title text not null,
  url text not null,
  category text,
  excerpt text,
  content text not null,
  -- Karl's scraper hashes each article body so a re-sync can skip unchanged
  -- pages. Kept so re-importing stays incremental rather than wholesale.
  content_hash text,
  last_updated text,
  imported_at timestamptz not null default now()
);

alter table turo_articles enable row level security;

-- Search is the entire point of this table, so it gets a real index rather
-- than ILIKE over 725 rows of prose.
--
-- Title is weighted above body ('A' vs 'B'): someone searching "cancellation
-- fee" wants the article named for it, not the twelve that mention it in
-- passing. Generated + stored so the vector is maintained by Postgres and
-- cannot drift from the row it describes.
alter table turo_articles
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored;

create index if not exists turo_articles_search_idx on turo_articles using gin (search_vector);
create index if not exists turo_articles_category_idx on turo_articles (category);

-- ========================================================= board locations

-- Address -> timezone, learned per fleet.
--
-- Detection from state and airport code is right most of the time and wrong
-- for the split states, so a correction a VA makes by hand has to stick.
-- Karl shipped 21 of these hardcoded for his own client list; here they are
-- per-fleet and accumulate as trips are corrected.
create table if not exists board_locations (
  host_id uuid not null references hosts(id) on delete cascade,
  -- Lowercased, whitespace-collapsed address, so lookups don't miss on casing.
  address_key text not null,
  address text not null,
  timezone text not null,
  city text,
  created_at timestamptz not null default now(),
  primary key (host_id, address_key)
);

alter table board_locations enable row level security;

commit;
