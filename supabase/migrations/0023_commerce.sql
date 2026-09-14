-- HostOS — migration 0023: Commerce operations (Shopify first)
-- Additive and idempotent. Safe to run twice.
--
-- The third vertical. Same shape as the restaurant module: a store is a peer
-- of a restaurant and a fleet, host_id-keyed, with products and orders
-- synced from the platform (Shopify Admin API) or imported from its CSV
-- exports. Provider is a column rather than a table per platform so
-- WooCommerce, Square Online and the rest slot in without a migration each.

create table if not exists commerce_stores (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  -- 'shopify' | 'woocommerce' | 'square' | 'other'
  provider text not null default 'shopify',
  name text not null,
  -- e.g. "my-shop.myshopify.com" — the identity the Admin API is called on.
  domain text,
  external_id text,
  connection_id uuid references integration_connections(id) on delete set null,
  currency text not null default 'USD',
  timezone text not null default 'America/Denver',
  -- 'active' | 'paused' | 'unknown'
  status text not null default 'unknown',
  low_stock_threshold integer not null default 5,
  settings jsonb not null default '{}',
  notes text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table commerce_stores enable row level security;

create index if not exists commerce_stores_host_idx on commerce_stores (host_id, name);
create unique index if not exists commerce_stores_domain_idx
  on commerce_stores (host_id, provider, domain) where domain is not null;

drop trigger if exists commerce_stores_set_updated_at on commerce_stores;
create trigger commerce_stores_set_updated_at before update on commerce_stores
  for each row execute function set_updated_at();

-- ------------------------------------------------------------ products

create table if not exists commerce_products (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  store_id uuid not null references commerce_stores(id) on delete cascade,
  external_id text not null,
  title text not null,
  sku text,
  vendor text,
  product_type text,
  -- 'active' | 'draft' | 'archived' | 'unknown'
  status text not null default 'unknown',
  price numeric,
  compare_at_price numeric,
  inventory_quantity integer,
  image_url text,
  variant_count integer,
  raw jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

alter table commerce_products enable row level security;

create index if not exists commerce_products_store_idx on commerce_products (store_id, title);
create index if not exists commerce_products_low_stock_idx
  on commerce_products (store_id, inventory_quantity) where inventory_quantity is not null;

drop trigger if exists commerce_products_set_updated_at on commerce_products;
create trigger commerce_products_set_updated_at before update on commerce_products
  for each row execute function set_updated_at();

-- -------------------------------------------------------------- orders

create table if not exists commerce_orders (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  store_id uuid not null references commerce_stores(id) on delete cascade,
  external_id text not null,
  order_number text,
  -- 'open' | 'closed' | 'cancelled' | 'unknown'
  status text not null default 'unknown',
  -- Shopify's vocabulary, kept raw: 'paid' | 'pending' | 'refunded' | …
  financial_status text,
  -- 'fulfilled' | 'partial' | 'unfulfilled' | null
  fulfillment_status text,
  customer_name text,
  customer_email text,
  placed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  currency text,
  subtotal numeric,
  total numeric,
  shipping numeric,
  tax numeric,
  discount numeric,
  item_count integer,
  line_items jsonb not null default '[]',
  -- 'api' | 'import' | 'manual'
  source text not null default 'api',
  raw jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

alter table commerce_orders enable row level security;

create index if not exists commerce_orders_placed_idx on commerce_orders (store_id, placed_at desc);
create index if not exists commerce_orders_status_idx on commerce_orders (host_id, status, fulfillment_status);

drop trigger if exists commerce_orders_set_updated_at on commerce_orders;
create trigger commerce_orders_set_updated_at before update on commerce_orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------- sync log

-- One row per sync attempt, so "why is the count stale" has an answer
-- without opening a server log.
create table if not exists commerce_sync_runs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  store_id uuid not null references commerce_stores(id) on delete cascade,
  -- 'products' | 'orders' | 'full' | 'import'
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  products_synced integer not null default 0,
  orders_synced integer not null default 0,
  error text,
  triggered_by text
);

alter table commerce_sync_runs enable row level security;

create index if not exists commerce_sync_runs_store_idx on commerce_sync_runs (store_id, started_at desc);
