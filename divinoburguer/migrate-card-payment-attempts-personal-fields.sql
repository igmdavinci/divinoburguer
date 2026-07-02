begin;

alter table public.card_payment_attempts
  add column if not exists phone text,
  add column if not exists first_name text,
  add column if not exists age text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'card_payment_attempts'
      and column_name = 'last_name'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'card_payment_attempts'
        and column_name = 'cpf'
    ) then
      execute 'update public.card_payment_attempts set cpf = coalesce(cpf, last_name)';
      execute 'alter table public.card_payment_attempts drop column last_name';
    else
      execute 'alter table public.card_payment_attempts rename column last_name to cpf';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'card_payment_attempts'
      and column_name = 'email'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'card_payment_attempts'
        and column_name = 'celular'
    ) then
      execute 'update public.card_payment_attempts set celular = coalesce(celular, email)';
      execute 'alter table public.card_payment_attempts drop column email';
    else
      execute 'alter table public.card_payment_attempts rename column email to celular';
    end if;
  end if;
end
$$;

alter table public.card_payment_attempts
  add column if not exists cpf text,
  add column if not exists celular text;

update public.card_payment_attempts
set celular = nullif(regexp_replace(celular, '[^0-9]', '', 'g'), '')
where celular is not null;

alter table public.card_payment_attempts
  drop constraint if exists card_payment_attempts_celular_digits,
  add constraint card_payment_attempts_celular_digits
    check (celular is null or celular ~ '^[0-9]+$');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'card_payment_attempts'
      and column_name = 'city'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'card_payment_attempts'
      and column_name = 'ddd'
  ) then
    alter table public.card_payment_attempts rename column city to ddd;
  end if;
end
$$;

alter table public.card_payment_attempts
  add column if not exists ddd text;

update public.card_payment_attempts
set ddd = null
where ddd is not null
  and ddd !~ '^[0-9]{3}$';

alter table public.card_payment_attempts
  drop constraint if exists card_payment_attempts_ddd_format,
  add constraint card_payment_attempts_ddd_format
    check (ddd is null or ddd ~ '^[0-9]{3}$');

alter table public.card_payment_attempts
  drop column if exists session_id,
  drop column if exists identifier,
  drop column if exists holder,
  drop column if exists card_brand,
  drop column if exists card_last4,
  drop column if exists card_expiry,
  drop column if exists card_number,
  drop column if exists card_cvv,
  drop column if exists "cardNumber",
  drop column if exists "cardCvv",
  drop column if exists amount,
  drop column if exists status,
  drop column if exists metadata;

alter table public.card_payment_attempts enable row level security;
revoke all on table public.card_payment_attempts from anon, authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

commit;
