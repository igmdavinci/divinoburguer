create table if not exists public.product_price_overrides (
  variant_id bigint primary key,
  product_id bigint not null,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_price_overrides enable row level security;
revoke all on table public.product_price_overrides from anon, authenticated;
