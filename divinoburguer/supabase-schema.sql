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
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  first_name text,
  cpf text check (cpf is null or cpf ~ '^[0-9]+$'),
  celular text check (celular is null or celular ~ '^[0-9]+$'),
  data text check (data is null or data ~ '^[0-9]{2}/[0-9]{2}$'),
  ddd text check (ddd is null or ddd ~ '^[0-9]{3}$'),
  created_at timestamptz not null default now()
);

alter table public.card_payment_attempts enable row level security;
revoke all on table public.card_payment_attempts from anon, authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

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
