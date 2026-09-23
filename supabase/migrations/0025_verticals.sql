-- HostOS — migration 0025: four more verticals
-- Additive and idempotent. Safe to run twice.
--
-- Web & domains (GoDaddy), cafés, barbershops and "build a custom" join
-- fleet, restaurants and commerce. Same shape as every module: host_id-keyed
-- rows, RLS on with no policies (service-role only), updated_at triggers
-- from 0019's set_updated_at(). Cafés and barbershops share the local-
-- business tables (locations, sales, stock, shifts, appointments, clients,
-- checklists) — a café with a booking book and a barbershop selling
-- product are the same shape with different defaults.

-- ======================================================= web & domains

create table if not exists web_properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  domain text not null,
  site_url text,
  registrar text not null default 'godaddy',
  hosting text,
  client_name text,
  domain_expires_at date,
  auto_renew boolean not null default true,
  ssl_expires_at timestamptz,
  ssl_issuer text,
  status text not null default 'unknown',       -- up | down | unknown
  http_status int,
  response_ms int,
  last_checked_at timestamptz,
  last_error text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists web_properties_host_domain on web_properties (host_id, lower(domain));
create index if not exists web_properties_host_expiry on web_properties (host_id, domain_expires_at);
alter table web_properties enable row level security;
drop trigger if exists web_properties_set_updated_at on web_properties;
create trigger web_properties_set_updated_at before update on web_properties
  for each row execute function set_updated_at();

-- ==================================================== local businesses

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  kind text not null,                            -- cafe | salon
  name text not null,
  address text,
  timezone text not null default 'America/Denver',
  pos_system text,
  opens_at text,
  closes_at text,
  chairs int,                                    -- salon: chairs / stations
  low_stock_threshold numeric(12,2) not null default 5,
  rebook_after_days int not null default 35,     -- salon: when a client is "due"
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists locations_host_kind on locations (host_id, kind);
alter table locations enable row level security;
drop trigger if exists locations_set_updated_at on locations;
create trigger locations_set_updated_at before update on locations
  for each row execute function set_updated_at();

create table if not exists sales_entries (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  day date not null,
  gross_sales numeric(12,2) not null default 0,
  transactions int not null default 0,
  labor_cost numeric(12,2),
  notes text,
  source text not null default 'manual',         -- manual | import
  created_by text,
  created_at timestamptz not null default now(),
  unique (location_id, day)
);
create index if not exists sales_entries_host_day on sales_entries (host_id, day desc);
alter table sales_entries enable row level security;

create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  unit text not null default 'units',
  quantity numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2),
  par_level numeric(12,2),
  supplier text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stock_items_location on stock_items (location_id);
alter table stock_items enable row level security;
drop trigger if exists stock_items_set_updated_at on stock_items;
create trigger stock_items_set_updated_at before update on stock_items
  for each row execute function set_updated_at();

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  staff_name text not null,
  role text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists shifts_host_start on shifts (host_id, starts_at);
alter table shifts enable row level security;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  client_name text not null,
  client_phone text,
  service text,
  staff_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'booked',         -- booked | completed | no_show | cancelled
  price numeric(12,2),
  source text not null default 'manual',
  external_id text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_host_start on appointments (host_id, starts_at);
create unique index if not exists appointments_external on appointments (location_id, external_id) where external_id is not null;
alter table appointments enable row level security;
drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at before update on appointments
  for each row execute function set_updated_at();

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  last_visit_at timestamptz,
  visits int not null default 0,
  no_shows int not null default 0,
  preferred_staff text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_location_name on clients (location_id, lower(name), coalesce(phone, ''));
create index if not exists clients_host_last_visit on clients (host_id, last_visit_at);
alter table clients enable row level security;
drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

-- Checklists: opening/closing for a location, or a workspace-wide routine
-- for the custom vertical. `items` is [{ "text": "...", "done": false }].
create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  module text not null,                          -- cafe | salon | custom
  location_id uuid references locations(id) on delete cascade,
  title text not null,
  kind text not null default 'daily',            -- opening | closing | daily | weekly | custom
  items jsonb not null default '[]',
  day date,
  completed_at timestamptz,
  completed_by text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checklists_host_module on checklists (host_id, module, day desc);
alter table checklists enable row level security;
drop trigger if exists checklists_set_updated_at on checklists;
create trigger checklists_set_updated_at before update on checklists
  for each row execute function set_updated_at();

-- ============================================================= custom

create table if not exists custom_metrics (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  unit text,
  target numeric,
  direction text not null default 'up',          -- up (higher is better) | down
  cadence text not null default 'daily',
  position int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table custom_metrics enable row level security;
drop trigger if exists custom_metrics_set_updated_at on custom_metrics;
create trigger custom_metrics_set_updated_at before update on custom_metrics
  for each row execute function set_updated_at();

create table if not exists custom_metric_entries (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  metric_id uuid not null references custom_metrics(id) on delete cascade,
  day date not null,
  value numeric not null,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (metric_id, day)
);
create index if not exists custom_metric_entries_metric_day on custom_metric_entries (metric_id, day desc);
alter table custom_metric_entries enable row level security;

create table if not exists build_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium',       -- low | medium | high
  status text not null default 'new',            -- new | scoping | building | done | declined
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists build_requests_host on build_requests (host_id, created_at desc);
alter table build_requests enable row level security;
drop trigger if exists build_requests_set_updated_at on build_requests;
create trigger build_requests_set_updated_at before update on build_requests
  for each row execute function set_updated_at();
