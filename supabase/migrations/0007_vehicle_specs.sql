-- Adds fields only available from Colorado Cruisers' exported Vehicle
-- Summary report (VIN, odometer, fuel type, tank size, body type) — Companion
-- never scrapes these, so they're populated by a one-time import keyed on
-- plate, not by the sync pipeline. Additive-only: every existing column and
-- row is untouched.

alter table vehicles add column if not exists vin text;
alter table vehicles add column if not exists odometer integer;
alter table vehicles add column if not exists fuel_type text;
alter table vehicles add column if not exists tank_size text;
alter table vehicles add column if not exists vehicle_type text;
