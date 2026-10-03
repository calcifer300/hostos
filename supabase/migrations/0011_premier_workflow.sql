-- Supports the workflow the host actually runs on a Premier booking.
--
-- The alert was built around "cancel before pickup". That is step 3 of 5. What
-- he described, and has already run on two live trips:
--
--   1. alert fires
--   2. confirm the guest is at their phone or computer
--   3. cancel the trip
--   4. change HIS OWN protection plan to the $250 tier
--   5. guest rebooks — the two plans now match
--
-- Two columns make that possible.

-- The guest's Turo profile id. Previously fetched to look up their rating and
-- then deliberately discarded as an "internal identifier with no use on the
-- HostOS side". That was wrong: a low rating is used as a prompt to go read the
-- guest's review history — "if low can go in and see if they have a history of
-- smoking in cars" — and without this the rating is a dead end.
alter table trips add column if not exists guest_driver_id text;

-- The HOST's own per-trip deductible, from the reservation page's "Earnings
-- plan" section.
--
-- Emphatically NOT the guest's protection plan: reservation 57760996 reads
-- $2,750 here while the guest held a $0 Premier plan, and an earlier build that
-- confused the two could never fire its zero-deductible check for any trip.
-- Stored under an honest name because the host's own exposure is exactly what
-- step 4 above changes — showing it beside the guest's $0 cap is what makes the
-- mismatch concrete.
--
-- Nullable and expected to stay null for most rows: unlike protection level and
-- guest rating, which come from JSON for every trip, this is only readable from
-- rendered markup. It is captured opportunistically when the licence sweep
-- already has the detail page open, so it exists for near-term check-ins and
-- nothing else. Consumers must render it only when present and never infer a
-- figure from its absence.
alter table trips add column if not exists host_damage_responsibility numeric;
