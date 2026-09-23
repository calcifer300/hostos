-- HostOS — migrations 0017 to 0025, bundled 2026-09-15
-- Paste into the Supabase SQL editor and run once. Every migration below is
-- additive and idempotent, so running the bundle twice is harmless.

-- ======================================================================
-- 0017_platform_repairs.sql
-- ======================================================================
-- HostOS — migration 0017: platform repairs found by the unification audit
-- Additive and idempotent. Safe to run twice. Nothing is dropped except two
-- primary-key constraints that are immediately replaced (see section 2).
--
-- Every item here is a defect the audit (docs/AUDIT.md §3) traced to a real
-- behaviour, not a tidy-up.

-- ============================================================ 1. updated_at

-- Every writer in the app sets updated_at by hand, which means the one that
-- forgets leaves a row claiming it was last touched months ago. One trigger
-- function, applied to every table that carries the column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'knowledge_base', 'automation_settings', 'user_roles',
    'alert_settings', 'gmail_accounts'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
      execute format(
        'create trigger %I before update on %I for each row execute function set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end $$;

-- ============================================ 2. knowledge_base / automation_settings

-- Migration 0013 re-keyed both tables to host_id but left user_email as the
-- NOT NULL primary key from 0002. The app upserts { host_id, ... } with no
-- email — so for any fleet whose row was not backfilled (every fleet created
-- after 0013, and every Companion-only operator) the insert failed on the
-- not-null constraint and "Save" reported "Couldn't save that".
--
-- Fix: a surrogate id becomes the primary key, user_email becomes an optional
-- legacy column, and the host_id unique indexes from 0013 remain the keys the
-- app actually writes against.

alter table knowledge_base add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'knowledge_base'::regclass and conname = 'knowledge_base_pkey'
       and pg_get_constraintdef(oid) like '%user_email%'
  ) then
    alter table knowledge_base drop constraint knowledge_base_pkey;
    alter table knowledge_base add primary key (id);
  end if;
end $$;

alter table knowledge_base alter column user_email drop not null;

alter table automation_settings add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'automation_settings'::regclass and conname = 'automation_settings_pkey'
       and pg_get_constraintdef(oid) like '%user_email%'
  ) then
    alter table automation_settings drop constraint automation_settings_pkey;
    alter table automation_settings add primary key (id);
  end if;
end $$;

alter table automation_settings alter column user_email drop not null;

-- The unique indexes from 0013 are what the upserts conflict on. Re-asserted
-- here so this migration is complete on its own.
create unique index if not exists knowledge_base_host_idx
  on knowledge_base (host_id) where host_id is not null;
create unique index if not exists automation_settings_host_rule_idx
  on automation_settings (host_id, automation_id) where host_id is not null;

-- ================================================= 3. cascading fleet deletes

-- trips, trip_messages and trip_events were created (0003/0004) before the
-- cascade convention 0009+ use. Deleting a fleet would fail on the first
-- referencing row rather than take its data with it.
do $$
declare
  rec record;
begin
  for rec in
    select c.conname, c.conrelid::regclass::text as tbl
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'hosts'::regclass
       and c.conrelid::regclass::text in ('trips', 'trip_messages', 'trip_events', 'vehicles')
       and c.confdeltype <> 'c'
  loop
    execute format('alter table %I drop constraint %I', rec.tbl, rec.conname);
    execute format(
      'alter table %I add constraint %I foreign key (host_id) references hosts(id) on delete cascade',
      rec.tbl, rec.conname
    );
  end loop;
end $$;

-- ========================================================= 4. missing indexes

-- The vehicle detail page and the sync route's prune guard both ask "which
-- trips reference this plate on this fleet".
create index if not exists trips_host_plate_idx on trips (host_id, plate) where plate is not null;

-- Conversation lists sort by the newest message per trip.
create index if not exists trip_messages_host_trip_idx on trip_messages (host_id, trip_id, synced_at desc);

-- =========================================================== 5. host profile

-- The tenant row grows two descriptive fields the platform now needs: what
-- kind of operation this workspace runs (fleet, restaurants, or both — used
-- to shape the sidebar and the dashboard), and a short public-facing label.
alter table hosts add column if not exists modules text[] not null default '{fleet}';
alter table hosts add column if not exists brand_color text;
alter table hosts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists hosts_set_updated_at on hosts;
create trigger hosts_set_updated_at before update on hosts
  for each row execute function set_updated_at();

-- ======================================================================
-- 0018_restaurants.sql
-- ======================================================================
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

-- ======================================================================
-- 0019_workspace.sql
-- ======================================================================
-- HostOS — migration 0019: the shared workspace layer
-- Additive and idempotent. Safe to run twice.
--
-- Three things both products (fleet operations and restaurant operations)
-- need and neither had as data: notifications that outlive the browser tab
-- that raised them, tasks a team can hand each other, and a dashboard layout
-- a person can arrange once and keep.

-- ========================================================== notifications

-- Every event worth a person's attention, from any module, in one table.
--
-- Until now "notifications" was a Gmail view, desktop pings lived in the
-- extension, and email alerts were recorded only as sent/not-sent. Nothing
-- gave a co-host who logged in at 9am the list of what happened overnight.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  -- Null means "everyone on this fleet". An address targets one member —
  -- used for mentions and personal reminders.
  user_email text,
  -- 'trip' | 'message' | 'alert' | 'restaurant' | 'order' | 'task' | 'system' | 'butler'
  kind text not null,
  -- 'info' | 'success' | 'warning' | 'critical'
  severity text not null default 'info',
  title text not null,
  body text,
  -- Where clicking it goes. A HostOS route, or a turo.com / DoorDash URL.
  href text,
  -- Stable key so the same underlying fact is never inserted twice
  -- ("licence:57760996", "store_paused:<restaurant_id>:<date>").
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create unique index if not exists notifications_dedupe_idx
  on notifications (host_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_inbox_idx
  on notifications (host_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (host_id, user_email) where read_at is null;

-- ================================================================== tasks

-- The unit of work. Generated by the AI Butler from what it sees (an
-- unverified licence, a store paused during service), by an automation rule,
-- or typed by a person. Every task names where it came from so a generated
-- one can be regenerated or dismissed as a class rather than one by one.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  title text not null,
  description text,
  -- 'open' | 'in_progress' | 'done' | 'dismissed'
  status text not null default 'open',
  -- 'low' | 'medium' | 'high' | 'critical'
  priority text not null default 'medium',
  due_at timestamptz,
  assignee_email text,
  -- 'manual' | 'butler' | 'automation'
  source text not null default 'manual',
  -- What the task is about, so the UI can deep-link: ('trip', '57760996'),
  -- ('restaurant', '<uuid>'), ('order', '<uuid>').
  related_kind text,
  related_id text,
  href text,
  -- Same purpose as notifications.dedupe_key: the Butler must be able to
  -- re-run without creating the same task twice.
  dedupe_key text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table tasks enable row level security;

create unique index if not exists tasks_dedupe_idx
  on tasks (host_id, dedupe_key) where dedupe_key is not null;
create index if not exists tasks_board_idx
  on tasks (host_id, status, priority, due_at);

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();

-- ====================================================== dashboard layouts

-- One row per (fleet, person): which widgets are visible and in what order.
-- The catalogue of widgets lives in code; this stores only the arrangement,
-- so a widget that is removed from the catalogue is simply ignored on read.
create table if not exists dashboard_layouts (
  host_id uuid not null references hosts(id) on delete cascade,
  user_email text not null,
  layout jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (host_id, user_email)
);

alter table dashboard_layouts enable row level security;

drop trigger if exists dashboard_layouts_set_updated_at on dashboard_layouts;
create trigger dashboard_layouts_set_updated_at before update on dashboard_layouts
  for each row execute function set_updated_at();

-- ======================================================= activity feed

-- Cross-module activity, one line per event, for the dashboard's "Recent
-- events" widget. trip_events stays the fleet's authoritative change log;
-- this is the human-readable stream that the restaurant module and the
-- Butler also write to.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  actor_email text,
  -- 'fleet' | 'restaurant' | 'butler' | 'system' | 'team'
  module text not null,
  -- e.g. 'trip.rescheduled', 'store.paused', 'task.completed', 'draft.sent'
  event text not null,
  description text not null,
  href text,
  payload jsonb,
  occurred_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create index if not exists activity_log_host_idx on activity_log (host_id, occurred_at desc);

-- ======================================================================
-- 0020_reply_templates.sql
-- ======================================================================
-- HostOS — migration 0020: reply templates
-- Additive and idempotent. Safe to run twice.
--
-- The saved replies lived in three places: Karl's cohost-manager shipped
-- five hard-coded templates (messages.js), the Companion kept "saved replies"
-- in chrome.storage on whichever machine typed them, and lib/host/templates.ts
-- holds the app's own check-in/return messages. One table, fleet-scoped, so
-- every member and the extension read the same list, and the Butler can offer
-- a template before it reaches for the model.

create table if not exists reply_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  -- 'fleet' | 'restaurant' — which product the template belongs to.
  module text not null default 'fleet',
  title text not null,
  -- 'check_in' | 'in_trip' | 'return' | 'post_trip' | 'host_report' | 'customer' | 'other'
  category text not null default 'other',
  -- Comma-separated trigger phrases the reply matcher scores against.
  triggers text,
  -- Body with {GUEST_NAME}-style placeholders (see lib/templates/render.ts).
  body text not null,
  sort_order integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reply_templates enable row level security;

create index if not exists reply_templates_host_idx on reply_templates (host_id, module, sort_order);

drop trigger if exists reply_templates_set_updated_at on reply_templates;
create trigger reply_templates_set_updated_at before update on reply_templates
  for each row execute function set_updated_at();

-- ======================================================================
-- 0021_marketing.sql
-- ======================================================================
-- HostOS — migration 0021: public site
-- Additive and idempotent. Safe to run twice.

-- Messages sent through the landing page's contact form. Not fleet-scoped —
-- the sender has no account yet. Read by nobody but an operator with the
-- service-role key; RLS on, no policies, same as every other table.
create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  company text,
  -- The service they picked from the form's list.
  interest text,
  message text not null,
  -- Where the request came from (page path, campaign), for later attribution.
  source text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table contact_requests enable row level security;

create index if not exists contact_requests_created_idx on contact_requests (created_at desc);

-- ======================================================================
-- 0022_integrations.sql
-- ======================================================================
-- HostOS — migration 0022: integration connections
-- Additive and idempotent. Safe to run twice.
--
-- HostOS connects to platforms — Turo (through the Companion), DoorDash
-- (Companion + exports), Shopify (Admin API), Gmail (OAuth), and more to
-- come. Each connection is a row here so the Connectors page, the sync
-- loops and the Butler all read one truth about what is wired up.
--
-- Credentials are stored ENCRYPTED by the application (AES-256-GCM, key from
-- HOSTOS_ENCRYPTION_KEY — see src/lib/crypto.ts). The column type is text
-- because the ciphertext is opaque to Postgres on purpose: a database dump
-- must not be a credential dump.

create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  -- 'turo' | 'doordash' | 'shopify' | 'gmail' | 'google_calendar' | 'slack' | 'sms' | …
  provider text not null,
  -- Where the connection points: a Shopify shop domain, a DoorDash store id,
  -- a Gmail address. Null for providers with one connection per workspace.
  external_id text,
  display_name text,
  -- 'connected' | 'disconnected' | 'error' | 'pending'
  status text not null default 'pending',
  credentials_encrypted text,
  settings jsonb not null default '{}',
  last_synced_at timestamptz,
  last_error text,
  connected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table integration_connections enable row level security;

create unique index if not exists integration_connections_provider_idx
  on integration_connections (host_id, provider, coalesce(external_id, ''));

drop trigger if exists integration_connections_set_updated_at on integration_connections;
create trigger integration_connections_set_updated_at before update on integration_connections
  for each row execute function set_updated_at();

-- ======================================================================
-- 0023_commerce.sql
-- ======================================================================
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

-- ======================================================================
-- 0024_workspace_roles.sql
-- ======================================================================
-- HostOS — migration 0024: workspace roles and invitations
-- Additive and idempotent. Safe to run twice.
--
-- host_members has carried three roles since 0009 (owner / member / viewer).
-- A platform for many businesses needs two more between owner and member —
-- an admin who can manage people and integrations without being the owner,
-- and a manager who can change how the workspace runs (knowledge, templates,
-- alerts) without being able to add or remove anyone. The permission matrix
-- lives in src/lib/roles/permissions.ts; this only widens what the column
-- may hold and records how each membership came to exist.

alter table host_members add column if not exists invited_by text;
alter table host_members add column if not exists invited_at timestamptz;
alter table host_members add column if not exists accepted_at timestamptz;
alter table host_members add column if not exists display_name text;

-- A role the app does not know is treated as 'viewer' on read (least
-- privilege), so this check is documentation as much as enforcement.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'host_members'::regclass and conname = 'host_members_role_check'
  ) then
    alter table host_members
      add constraint host_members_role_check
      check (role in ('owner', 'admin', 'manager', 'member', 'viewer'));
  end if;
end $$;

-- Existing rows predate invitations; mark them accepted so the roster does
-- not show every founding member as "invited, not yet joined".
update host_members set accepted_at = coalesce(accepted_at, created_at);

-- ======================================================================
-- 0025_verticals.sql
-- ======================================================================
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
