create table if not exists payment_intents (
  id text primary key,
  idempotency_key text not null,
  request_hash text not null,
  tenant_id text not null,
  customer_id text not null,
  order_id text not null,
  amount_cents integer not null,
  currency text not null,
  state text not null,
  gateway_charge_id text,
  gateway_status text,
  gateway_evidence jsonb not null default '{}'::jsonb,
  fulfillment_status text not null default 'hold',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  idempotency_key text primary key,
  request_hash text not null,
  payment_intent_id text not null references payment_intents(id),
  created_at timestamptz not null default now()
);

create table if not exists settlement_rows (
  id text primary key,
  payment_intent_id text not null references payment_intents(id),
  captured_cents integer not null,
  settled_cents integer not null,
  currency text not null,
  created_at timestamptz not null default now()
);

create table if not exists recovery_reports (
  id text primary key,
  generated_at timestamptz not null default now(),
  payload jsonb not null
);
