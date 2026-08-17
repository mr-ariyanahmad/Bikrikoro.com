-- BikriKoro marketplace badges and delivery preferences
-- Safe to run after migrations 013-016.
alter table public.products add column if not exists supports_cod boolean not null default false;
alter table public.products add column if not exists free_delivery boolean not null default false;
alter table public.products add column if not exists fast_delivery boolean not null default false;
alter table public.products add column if not exists free_return boolean not null default false;

comment on column public.products.supports_cod is 'Seller confirms cash-on-delivery is available for this physical listing.';
comment on column public.products.free_delivery is 'Seller or campaign covers delivery cost for this listing.';
comment on column public.products.fast_delivery is 'Listing is eligible for the platform fast-delivery promise.';
comment on column public.products.free_return is 'Listing has a free-return promise subject to platform policy.';

create index if not exists products_delivery_badges_idx on public.products (supports_cod, free_delivery, fast_delivery, free_return);
