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
