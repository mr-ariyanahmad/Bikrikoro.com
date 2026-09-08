-- Coupon funding policy:
-- PLATFORM coupons are funded by BikriKoro and do not reduce seller payout.
-- SELLER coupons reduce the seller's payout by the discount amount.
alter table public.coupons
  add column if not exists funding_source text not null default 'PLATFORM',
  add column if not exists seller_id text;

alter table public.orders
  add column if not exists coupon_funding_source text not null default 'PLATFORM',
  add column if not exists coupon_seller_id text;

alter table public.coupons drop constraint if exists coupons_funding_source_check;
alter table public.coupons add constraint coupons_funding_source_check check (funding_source in ('PLATFORM', 'SELLER'));
alter table public.orders drop constraint if exists orders_coupon_funding_source_check;
alter table public.orders add constraint orders_coupon_funding_source_check check (coupon_funding_source in ('PLATFORM', 'SELLER'));

-- Existing/admin-created coupons remain platform-funded unless explicitly changed.
update public.coupons set funding_source = 'PLATFORM' where funding_source is null or funding_source not in ('PLATFORM', 'SELLER');

create or replace function public.snapshot_coupon_funding()
returns trigger as $$
declare v_coupon public.coupons%rowtype;
begin
  if new.coupon_code is null or trim(new.coupon_code) = '' then
    new.coupon_funding_source := 'PLATFORM';
    new.coupon_seller_id := null;
    return new;
  end if;
  select * into v_coupon from public.coupons where code = upper(trim(new.coupon_code));
  if not found then raise exception 'Coupon not found for order'; end if;
  new.coupon_funding_source := coalesce(v_coupon.funding_source, 'PLATFORM');
  new.coupon_seller_id := v_coupon.seller_id;
  if new.coupon_funding_source = 'SELLER' and v_coupon.seller_id is distinct from new.seller_id then
    raise exception 'Seller coupon does not belong to this listing';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_snapshot_coupon_funding on public.orders;
create trigger trg_snapshot_coupon_funding
before insert or update of coupon_code on public.orders
for each row execute function public.snapshot_coupon_funding();

-- Backfill historical orders from their coupon definition where possible.
update public.orders o
set coupon_funding_source = coalesce(c.funding_source, 'PLATFORM'),
    coupon_seller_id = c.seller_id
from public.coupons c
where o.coupon_code = c.code;

-- Platform-funded discount is absorbed by BikriKoro. Seller-funded discount
-- remains deducted from the seller's net payout.
create or replace function public.apply_order_wallet_effects() returns trigger as $$
begin
  if new.status = 'CANCELLED' and old.status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED') then
    insert into public.wallet_ledger (user_id, type, amount, order_id, description)
    values (new.buyer_id, 'ORDER_REFUND', (new.price * new.quantity) + new.escrow_fee, new.id, 'অর্ডার বাতিল — রিফান্ড: ' || new.product_title);
  end if;
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    insert into public.wallet_ledger (user_id, type, amount, order_id, description)
    values (
      new.seller_id,
      'SELLER_PAYOUT',
      (new.price * new.quantity) + case when new.coupon_funding_source = 'PLATFORM' then coalesce(new.discount_amount, 0) else 0 end,
      new.id,
      'বিক্রয় সম্পন্ন — পেআউট: ' || new.product_title || case when coalesce(new.coupon_code, '') <> '' then ' (coupon: ' || new.coupon_code || ', ' || new.coupon_funding_source || ')' else '' end
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_apply_order_wallet_effects on public.orders;
create trigger trg_apply_order_wallet_effects after update on public.orders for each row execute function public.apply_order_wallet_effects();
