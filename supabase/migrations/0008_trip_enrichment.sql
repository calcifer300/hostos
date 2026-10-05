-- Guest risk signals, read from Turo's own JSON APIs by the Companion
-- extension's enrichment loop (hostosEnrichment alarm, every 10 min — see
-- enrichment.js and sync.js's performEnrichmentSync). Written by
-- src/app/api/turo/enrichment/route.ts.
--
-- WHY THESE COLUMNS EXIST
-- -----------------------
-- A guest on Turo's Premier plan has a $0 out-of-pocket maximum, so damage
-- cannot be billed to them and the host recovers nothing. That, combined with
-- a first-time or badly-rated guest, is the case worth acting on before a trip
-- starts — and HostOS previously had no field for either signal.
--
-- Deliberately NOT sourced from the reservation page's "Earnings plan"
-- section: its "Damage responsibility" figure is the HOST's own deductible,
-- not the guest's cap. Verified against reservation 57760996 — a Premier
-- booking showing $2,750 there while the guest held a $0 plan.

-- protection_level is Turo's enum, stored raw rather than reduced to a
-- boolean: "SUPREME" is Premier, "DECLINED" means the guest took no cover, and
-- new values should surface as themselves instead of silently collapsing into
-- "not Premier".
alter table trips add column if not exists protection_level text;
alter table trips add column if not exists protection_plan_name text;

-- Numeric, and a genuine 0 is the meaningful value (that IS Premier). Null
-- means "not checked yet", never "$0 cap" — collapsing the two would report
-- every unchecked trip as the highest-risk kind.
alter table trips add column if not exists guest_max_out_of_pocket numeric;
alter table trips add column if not exists protection_checked_at timestamptz;

-- guest_rating is null when nobody has rated the guest yet. "Unrated" and
-- "rated zero" are very different things to put in front of a host, so the
-- count is stored alongside it rather than inferred.
alter table trips add column if not exists guest_rating numeric;
alter table trips add column if not exists guest_rating_count integer;
alter table trips add column if not exists guest_trip_count integer;
alter table trips add column if not exists guest_member_since text;
alter table trips add column if not exists guest_checked_at timestamptz;

-- The dashboard's risk surfaces filter on "Premier and not yet started", so
-- this is the access path that matters. Partial, because Premier bookings are
-- a small minority of rows.
create index if not exists trips_protection_level_idx
  on trips (host_id, protection_level)
  where protection_level is not null;
