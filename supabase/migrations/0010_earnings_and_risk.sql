-- Inputs for the earnings reconstruction and the Profit Risk queue.
--
-- Turo shows a co-host NO payout figure at all — booking.cost and
-- booking.hostShare come back nulled out — so what the host actually earns has
-- to be rebuilt. The chain (see src/lib/risk/earnings.ts) is:
--
--   nightly rate for the trip's own days   (vehicles.daily_prices)
--   x (1 - length discount)                 (trips.length_discount_percent)
--   x (1 - 10% if non-refundable)           (trips.cancellation_policy_type)
--   + extras                                (trips.extras)
--   + delivery fee                          (trips.delivery_fee)
--   = trip total
--   x host take rate                        (trips.host_take_rate)
--   = earnings
--
-- Every column here is nullable and every consumer treats null as "not read",
-- never as zero. That distinction is the whole point: an unknown spent as a
-- zero understates a trip by the entire missing amount, which is how a healthy
-- $0.26/mile trip got reported as thin.

-- The allowance the guest's mileage is measured against. Without it, earnings
-- per mile is undefined — and must stay undefined rather than defaulting.
alter table trips add column if not exists included_miles numeric;

-- Turo's OVERAGE rate: what a guest pays per mile BEYOND the allowance.
-- Display only. Never flag on it — it is unrelated to a trip's economics, and
-- an earlier build that flagged on it reported a healthy $0.35/mile trip as a
-- risk because its overage happened to be $0.19.
alter table trips add column if not exists price_per_mile numeric;

alter table trips add column if not exists host_take_rate numeric;
alter table trips add column if not exists length_discount_percent numeric;
alter table trips add column if not exists cancellation_policy_type text;

-- A real 0 means "Turo says this trip is not a delivery". Null means we never
-- read it. Absence of a delivery marker is NOT proof of no delivery.
alter table trips add column if not exists delivery_fee numeric;

alter table trips add column if not exists pricing_checked_at timestamptz;

-- The fleet calendar's nightly prices, index 0 = the day it was scanned.
-- Stored as arrays because the grid gives no date per cell — only a position —
-- so a trip's own days are picked out by offset from calendar_scanned_at.
alter table vehicles add column if not exists daily_prices jsonb;
alter table vehicles add column if not exists booked_day_flags jsonb;
alter table vehicles add column if not exists calendar_scanned_at timestamptz;

-- The Profit Risk and Unverified Licence queues both scan for near-term trips
-- on one fleet, which is the access path worth indexing.
create index if not exists trips_host_start_idx on trips (host_id, start_ts);
