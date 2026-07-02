create extension if not exists pgcrypto;

create table if not exists public.amplopay_orders (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  identifier text not null unique,
  transaction_id text,
  status text not null default 'CHECKOUT_STARTED',
  amount numeric(12, 2) not null,
  client jsonb,
  products jsonb not null default '[]'::jsonb,
  pix jsonb,
  gateway_response jsonb,
  cart_payload jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.amplopay_callbacks (
  id uuid primary key default gen_random_uuid(),
  identifier text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.card_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  identifier text,
  holder text,
  email text,
  phone text,
  cpf text,
  card_brand text,
  card_last4 text not null,
  card_expiry text,
  amount numeric(12, 2),
  status text not null default 'Recusado',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists amplopay_orders_identifier_idx
  on public.amplopay_orders (identifier);

create index if not exists amplopay_orders_session_id_idx
  on public.amplopay_orders (session_id);

create index if not exists amplopay_orders_transaction_id_idx
  on public.amplopay_orders (transaction_id);

create index if not exists amplopay_callbacks_identifier_idx
  on public.amplopay_callbacks (identifier);

create index if not exists card_payment_attempts_created_at_idx
  on public.card_payment_attempts (created_at desc);

create index if not exists card_payment_attempts_session_id_idx
  on public.card_payment_attempts (session_id);

create index if not exists card_payment_attempts_identifier_idx
  on public.card_payment_attempts (identifier);
