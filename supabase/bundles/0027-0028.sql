-- HostOS — migrations 0027 to 0028, bundled 2026-09-15
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0027_services.sql
-- ======================================================================
-- HostOS — migration 0027: the Service Businesses vertical
-- Additive and idempotent. Safe to run twice.
--
-- Appointment-, dispatch- and field-based businesses: auto glass, mobile
-- mechanics, towing, junk removal, HVAC, plumbing, cleaning, lawn care,
-- locksmiths, movers… One set of tables; the industry is a template applied
-- at setup (src/lib/services/industries.ts), never a separate schema.
-- Same shape as every module: host_id-keyed, RLS on with no policies
-- (service-role only), updated_at triggers from 0019's set_updated_at().

-- ------------------------------------------------------------ settings
create table if not exists service_settings (
  host_id uuid primary key references hosts(id) on delete cascade,
  industry text not null,                          -- key in industries.ts
  business_name text,
  timezone text not null default 'America/Denver',
  default_duration_min int not null default 90,
  service_catalog jsonb not null default '[]',     -- [{name, price, durationMin}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table service_settings enable row level security;
drop trigger if exists service_settings_set_updated_at on service_settings;
create trigger service_settings_set_updated_at before update on service_settings
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------- CRM
create table if not exists service_customers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  stage text not null default 'lead',              -- lead | customer | inactive
  source text,                                     -- referral | facebook | google | website | phone | other
  tags text[] not null default '{}',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_customers_host_idx on service_customers (host_id, stage, updated_at desc);
alter table service_customers enable row level security;
drop trigger if exists service_customers_set_updated_at on service_customers;
create trigger service_customers_set_updated_at before update on service_customers
  for each row execute function set_updated_at();

-- A customer can have several service addresses (home, rental, office).
create table if not exists service_properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  customer_id uuid not null references service_customers(id) on delete cascade,
  label text not null default 'Home',
  address text not null,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists service_properties_customer_idx on service_properties (host_id, customer_id);
alter table service_properties enable row level security;

-- --------------------------------------------------------------- staff
-- Technicians, dispatchers, managers and VAs. Independent of host_members:
-- a technician in the field may never sign in, and a VA may serve several.
create table if not exists service_staff (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  role text not null default 'technician',         -- technician | dispatcher | manager | va | owner
  email text,
  phone text,
  skills text[] not null default '{}',
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_staff_host_idx on service_staff (host_id, active, role);
alter table service_staff enable row level security;
drop trigger if exists service_staff_set_updated_at on service_staff;
create trigger service_staff_set_updated_at before update on service_staff
  for each row execute function set_updated_at();

-- ---------------------------------------------------------- work orders
-- Every visit is a job: an estimate visit, an inspection, the work itself,
-- a follow-up. Status drives the dispatch board; kind drives the calendar.
create table if not exists service_jobs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  number serial,
  customer_id uuid references service_customers(id) on delete set null,
  property_id uuid references service_properties(id) on delete set null,
  staff_id uuid references service_staff(id) on delete set null,
  estimate_id uuid,
  kind text not null default 'job',                -- job | estimate | inspection | follow_up | installation | maintenance
  title text not null,
  description text,
  status text not null default 'pending',          -- pending | assigned | in_progress | completed | cancelled
  priority text not null default 'normal',         -- low | normal | high | urgent
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  address text,
  lat double precision,
  lng double precision,
  price numeric(12,2),
  labor_hours numeric(6,2),
  materials jsonb not null default '[]',           -- [{name, quantity, cost}]
  photos jsonb not null default '[]',              -- [{url, caption, phase: before|after|other}]
  signature_name text,
  signed_at timestamptz,
  recurrence text,                                 -- weekly | biweekly | monthly | quarterly | null
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_jobs_host_status_idx on service_jobs (host_id, status, scheduled_start);
create index if not exists service_jobs_customer_idx on service_jobs (host_id, customer_id);
create index if not exists service_jobs_staff_idx on service_jobs (host_id, staff_id, scheduled_start);
alter table service_jobs enable row level security;
drop trigger if exists service_jobs_set_updated_at on service_jobs;
create trigger service_jobs_set_updated_at before update on service_jobs
  for each row execute function set_updated_at();

-- ------------------------------------------------------------ estimates
create table if not exists service_estimates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  number serial,
  customer_id uuid references service_customers(id) on delete set null,
  property_id uuid references service_properties(id) on delete set null,
  job_id uuid references service_jobs(id) on delete set null,
  title text not null,
  line_items jsonb not null default '[]',          -- [{name, quantity, unitPrice}]
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft',            -- draft | sent | accepted | declined | expired
  sent_at timestamptz,
  expires_at timestamptz,
  decided_at timestamptz,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_estimates_host_idx on service_estimates (host_id, status, updated_at desc);
alter table service_estimates enable row level security;
drop trigger if exists service_estimates_set_updated_at on service_estimates;
create trigger service_estimates_set_updated_at before update on service_estimates
  for each row execute function set_updated_at();

-- ------------------------------------------------- contact timeline
-- Everything that happened with a customer, in order: calls, texts,
-- emails, notes, status changes. Manual today; the unified inbox writes
-- here when it arrives.
create table if not exists service_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  customer_id uuid references service_customers(id) on delete cascade,
  job_id uuid references service_jobs(id) on delete cascade,
  kind text not null default 'note',               -- note | call | sms | email | whatsapp | messenger | status
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists service_events_customer_idx on service_events (host_id, customer_id, created_at desc);
alter table service_events enable row level security;

-- ------------------------------------------------------- knowledge
-- SOPs, policies, guides, FAQs — seeded from the industry template, edited
-- by the business. The AI assistant reads from here.
create table if not exists service_docs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  kind text not null default 'sop',                -- sop | policy | guide | faq | handbook | training
  title text not null,
  body text not null default '',
  position int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_docs_host_idx on service_docs (host_id, kind, position);
alter table service_docs enable row level security;
drop trigger if exists service_docs_set_updated_at on service_docs;
create trigger service_docs_set_updated_at before update on service_docs
  for each row execute function set_updated_at();

-- ======================================================================
-- 0028_dedupe_indexes.sql
-- ======================================================================
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
