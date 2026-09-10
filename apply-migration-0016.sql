-- HostOS — migration 0016: per-fleet email alerts
-- Paste into the Supabase SQL Editor and Run.
-- Two new tables, nothing dropped. Safe to run twice.

begin;

-- Where each fleet's alerts get sent.
--
-- Alerts have been desktop notifications on whichever machine happens to be
-- running the extension. That is fine for the person at that machine and
-- useless for everyone else — and with one deployment serving many fleets,
-- "the machine running the extension" is a different person per fleet.
--
-- Two tables, because they answer different questions and have different
-- lifetimes: what a fleet WANTS, and what has already been SENT.

create table if not exists alert_settings (
  host_id uuid primary key references hosts(id) on delete cascade,

  -- Off by default. Email that nobody asked for is spam, including when the
  -- recipient is the account owner.
  email_enabled boolean not null default false,

  -- Plain text[], not a join table. These are a handful of addresses edited as
  -- one list on one screen; a row per recipient buys nothing and costs a join
  -- on every dispatch.
  recipients text[] not null default '{}',

  -- Which of the three are worth an email. Separate from the extension's local
  -- toggles on purpose: a host can reasonably want a desktop ping for
  -- everything and an email only for the one that costs money.
  on_licence boolean not null default true,
  on_premier boolean not null default true,
  on_profit  boolean not null default true,

  updated_at timestamptz not null default now()
);

alter table alert_settings enable row level security;

-- What has already gone out.
--
-- THIS TABLE IS THE DE-DUPE, and it is why alerting can be driven by a poll.
-- The extension asks every five minutes; an unverified licence stays
-- unverified for hours. Without a record of what was sent, the same trip
-- would be emailed twelve times an hour until someone acted on it — which is
-- how people learn to filter your alerts into a folder they never open.
--
-- The key is "kind:tripId" (see buildAlerts), so one trip that develops a
-- second problem still gets a second email.
create table if not exists alert_deliveries (
  host_id uuid not null references hosts(id) on delete cascade,
  alert_key text not null,
  -- 'email' today. Named rather than assumed so adding a channel later does
  -- not mean re-sending everything that already went out by email.
  channel text not null default 'email',
  sent_at timestamptz not null default now(),
  primary key (host_id, alert_key, channel)
);

alter table alert_deliveries enable row level security;

-- Dispatch reads "which of these keys have I already sent for this fleet",
-- and housekeeping deletes by age.
create index if not exists alert_deliveries_sent_idx on alert_deliveries (host_id, sent_at desc);

commit;
