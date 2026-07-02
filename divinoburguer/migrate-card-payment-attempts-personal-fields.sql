begin;

alter table public.card_payment_attempts
  add column if not exists phone text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists age text,
  add column if not exists city text;

alter table public.card_payment_attempts
  drop column if exists session_id,
  drop column if exists identifier,
  drop column if exists holder,
  drop column if exists cpf,
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

commit;
