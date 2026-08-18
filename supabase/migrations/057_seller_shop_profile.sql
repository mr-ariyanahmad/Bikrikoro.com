-- Seller shop profile fields. Re-running this migration is safe.
alter table public.profiles
  add column if not exists shop_name text;

alter table public.profiles
  add column if not exists shop_description text;

comment on column public.profiles.shop_name is 'Seller-facing shop or store name';
comment on column public.profiles.shop_description is 'Seller-facing shop description shown on the public seller profile';

create index if not exists idx_profiles_shop_name on public.profiles(shop_name);
