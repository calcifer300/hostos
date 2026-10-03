-- Driver's-license confirmation status, scraped from each reservation's
-- detail page by the Companion extension's background license-check loop
-- (hostosLicenseCheck alarm, every 15 min, for check-ins starting within
-- the next 24h — see sync.js's performLicenseCheckSync). Written by
-- src/app/api/turo/license-status/route.ts, read by the pickups schedule.
--
-- license_confirmed is nullable on purpose: null means "not checked yet or
-- Turo's status text didn't match a known phrasing," not "not confirmed" —
-- collapsing that to false would be a guess this scraper deliberately
-- avoids making (see content.js's scrapeReservationLicenseStatus).

alter table trips add column if not exists license_confirmed boolean;
alter table trips add column if not exists license_status_text text;
alter table trips add column if not exists license_checked_at timestamptz;
