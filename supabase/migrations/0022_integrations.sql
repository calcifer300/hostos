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
