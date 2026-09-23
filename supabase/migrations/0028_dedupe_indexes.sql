-- HostOS — migration 0028: make dedupe indexes usable by ON CONFLICT
-- Additive and idempotent. Safe to run twice.
--
-- 0019 created the (host_id, dedupe_key) unique indexes on tasks and
-- notifications as PARTIAL indexes (where dedupe_key is not null). Postgres
-- only lets ON CONFLICT (host_id, dedupe_key) use such an index when the
-- statement repeats the predicate — which PostgREST's upsert cannot do — so
-- every deduplicated insert failed with "no unique or exclusion constraint
-- matching the ON CONFLICT specification". That is the path the Butler files
-- every task and notification through. A full unique index keeps the same
-- guarantee: NULL dedupe keys are distinct from each other, so undeduped
-- rows are unaffected.

drop index if exists tasks_dedupe_idx;
create unique index if not exists tasks_dedupe_idx on tasks (host_id, dedupe_key);

drop index if exists notifications_dedupe_idx;
create unique index if not exists notifications_dedupe_idx on notifications (host_id, dedupe_key);
