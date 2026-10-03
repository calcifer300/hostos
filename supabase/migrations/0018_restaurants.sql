-- HostOS — migration 0018: Restaurant (DoorDash) operations
-- Additive and idempotent. Safe to run twice.
--
-- Port of the "HostOS – DoorDash edition" draft, which stored everything in
-- the browser (IndexedDB via Dexie): one machine, one person, no sharing, no
-- history once site data was cleared. The same model, host_id-keyed like every
-- other table, so a restaurant workspace is a peer of a fleet workspace —
-- same tenancy, same members, same roles, same auth.
--
-- Same access model as every table since 0001: RLS on, zero policies,
-- reachable only through the service-role key from server-only code.

-- ============================================================== restaurants

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  -- Human contact at the store, not a login.
  contact_name text,
  email text,
  phone text,
  -- "NRS", "Square", "Clover", "Toast" — free text; the CSV headers vary per system.
  pos_system text,
  -- DoorDash's own store identifier, read from the merchant portal URL by the
  -- Companion. Null until the store has been observed.
  doordash_store_id text,
  address text,
  timezone text not null default 'America/Denver',
  -- Operating state as last observed: 'open' | 'closed' | 'paused' | 'deactivated' | 'unknown'.
  status text not null default 'unknown',
  status_observed_at timestamptz,
  -- Comparison thresholds, per store — a bodega and a restaurant disagree.
  low_stock_threshold integer not null default 5,
  price_tolerance numeric not null default 0.01,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table restaurants enable row level security;

create index if not exists restaurants_host_idx on restaurants (host_id, name);
create unique index if not exists restaurants_doordash_store_idx
  on restaurants (host_id, doordash_store_id) where doordash_store_id is not null;

drop trigger if exists restaurants_set_updated_at on restaurants;
create trigger restaurants_set_updated_at before update on restaurants
  for each row execute function set_updated_at();

-- ======================================================== status timeline

-- Every observed change of a store's state — from the Companion watching the
-- merchant portal, from a manual toggle, or from an order import that implies
-- the store was live. A store that flips to "paused" at dinner rush is the
-- restaurant equivalent of an overdue return.
create table if not exists restaurant_status_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status text not null,
  -- 'companion' | 'manual' | 'import'
  source text not null default 'manual',
  detail text,
  observed_at timestamptz not null default now()
);

alter table restaurant_status_events enable row level security;

create index if not exists restaurant_status_events_idx
  on restaurant_status_events (restaurant_id, observed_at desc);

-- ============================================================ menu uploads

-- A raw POS or DoorDash export, exactly as parsed, plus the column mapping
-- the operator confirmed. Rows are kept so a comparison can be re-run with a
-- different mapping without re-uploading, and so the audit trail shows what
-- the numbers were computed from.
create table if not exists menu_uploads (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  -- 'pos' | 'doordash'
  source text not null,
  file_name text not null,
  headers jsonb not null default '[]',
  mapping jsonb not null default '{}',
  rows jsonb not null default '[]',
  row_count integer not null default 0,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

alter table menu_uploads enable row level security;

create index if not exists menu_uploads_restaurant_idx
  on menu_uploads (restaurant_id, source, uploaded_at desc);

-- ========================================================= comparisons

-- One run of the POS-vs-DoorDash comparison. The summary is denormalised so
-- the restaurant list can show "12 need updates" without loading every row.
create table if not exists menu_comparisons (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  pos_upload_id uuid references menu_uploads(id) on delete set null,
  doordash_upload_id uuid references menu_uploads(id) on delete set null,
  summary jsonb not null default '{}',
  rows jsonb not null default '[]',
  created_by text,
  created_at timestamptz not null default now()
);

alter table menu_comparisons enable row level security;

create index if not exists menu_comparisons_restaurant_idx
  on menu_comparisons (restaurant_id, created_at desc);

-- ======================================================== manual links

-- "This POS item IS that DoorDash item", for the pairs the matcher can't
-- resolve on its own. Persist per restaurant so the override survives every
-- future comparison.
create table if not exists menu_item_links (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  pos_key text not null,
  doordash_key text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, pos_key, doordash_key)
);

alter table menu_item_links enable row level security;

-- ================================================================ orders

-- Orders, imported from a DoorDash order export or observed by the Companion
-- on the merchant portal. The analytics (volume, revenue, prep time, late
-- deliveries, cancellations) are computed from this table on read.
create table if not exists restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  -- DoorDash's order id; unique per restaurant so re-imports upsert.
  external_id text not null,
  -- 'doordash' | 'ubereats' | 'grubhub' | 'pos' | 'other'
  channel text not null default 'doordash',
  -- 'placed' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled' | 'unknown'
  status text not null default 'unknown',
  customer_name text,
  placed_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  subtotal numeric,
  total numeric,
  tip numeric,
  commission numeric,
  item_count integer,
  items jsonb not null default '[]',
  -- 'companion' | 'import' | 'manual'
  source text not null default 'import',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, external_id)
);

alter table restaurant_orders enable row level security;

create index if not exists restaurant_orders_placed_idx
  on restaurant_orders (restaurant_id, placed_at desc);
create index if not exists restaurant_orders_status_idx
  on restaurant_orders (host_id, status);

drop trigger if exists restaurant_orders_set_updated_at on restaurant_orders;
create trigger restaurant_orders_set_updated_at before update on restaurant_orders
  for each row execute function set_updated_at();

-- ============================================================== messages

-- Customer / support conversations for a store (DoorDash chat, email, SMS),
-- captured by the Companion or logged by hand. The restaurant counterpart of
-- trip_messages, and what the AI Butler drafts replies against.
create table if not exists restaurant_messages (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  external_id text,
  -- 'doordash' | 'email' | 'sms' | 'other'
  channel text not null default 'doordash',
  customer_name text,
  order_external_id text,
  body text not null,
  from_store boolean not null default false,
  sent_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  unique (restaurant_id, channel, external_id)
);

alter table restaurant_messages enable row level security;

create index if not exists restaurant_messages_idx
  on restaurant_messages (restaurant_id, sent_at desc);

-- ============================================================== inventory

-- Live stock levels for items the operator tracks directly (not via upload),
-- so a low-stock alert can fire between exports.
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  sku text,
  name text not null,
  category text,
  price numeric,
  quantity integer,
  available boolean not null default true,
  low_stock_threshold integer,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table inventory_items enable row level security;

create index if not exists inventory_items_restaurant_idx on inventory_items (restaurant_id, name);
create unique index if not exists inventory_items_sku_idx
  on inventory_items (restaurant_id, sku) where sku is not null;

drop trigger if exists inventory_items_set_updated_at on inventory_items;
create trigger inventory_items_set_updated_at before update on inventory_items
  for each row execute function set_updated_at();
