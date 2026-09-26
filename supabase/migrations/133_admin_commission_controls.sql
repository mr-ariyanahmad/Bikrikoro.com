-- BikriKoro — configurable customer/seller commission controls
-- Rates are snapshotted on each order so later admin changes do not rewrite history.

alter table public.orders
  add column if not exists customer_commission_rate numeric(5,2) not null default 1.00,
  add column if not exists customer_commission_amount numeric(12,2) not null default 0,
  add column if not exists seller_commission_rate numeric(5,2) not null default 0.00,
  add column if not exists seller_commission_amount numeric(12,2) not null default 0;

alter table public.orders drop constraint if exists orders_commission_rate_check;
alter table public.orders add constraint orders_commission_rate_check check (
  customer_commission_rate between 0 and 100 and seller_commission_rate between 0 and 100
);

-- Preserve the existing 1% / minimum ৳10 buyer fee for historical orders that
-- predate the snapshot columns, while keeping seller commission at zero.
update public.orders
set customer_commission_amount = coalesce(escrow_fee, 0),
    seller_commission_amount = 0
where customer_commission_amount = 0 and coalesce(escrow_fee, 0) <> 0;

insert into public.admin_settings(setting_key, setting_value)
values
  ('commission_customer_rate', '{"value":"1"}'::jsonb),
  ('commission_seller_rate', '{"value":"0"}'::jsonb)
on conflict (setting_key) do nothing;

update public.admin_roles
set permissions = case when permissions ? '*' then permissions else permissions || '["settings.commission"]'::jsonb end,
    updated_at = now()
where role_key = 'FINANCE_MANAGER';

create or replace function public.commission_rate(p_key text, p_default numeric)
returns numeric as $$
declare v_value numeric;
begin
  select nullif(trim(setting_value->>'value'), '')::numeric
    into v_value
  from public.admin_settings
  where setting_key = p_key;
  return greatest(0, least(100, coalesce(v_value, p_default)));
exception when others then
  return greatest(0, least(100, p_default));
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.customer_commission_amount(p_base numeric, p_rate numeric)
returns numeric as $$
begin
  if coalesce(p_rate, 0) <= 0 then return 0; end if;
  return round(greatest(coalesce(p_base, 0) * p_rate / 100, 10), 2);
end;
$$ language plpgsql immutable;

create or replace function public.seller_commission_amount(p_base numeric, p_rate numeric)
returns numeric as $$
begin
  return round(greatest(coalesce(p_base, 0), 0) * greatest(coalesce(p_rate, 0), 0) / 100, 2);
end;
$$ language plpgsql immutable;

-- Existing hosted checkout without coupon.
create or replace function public.create_order_pending_payment(
  p_product_id uuid, p_buyer_id text, p_delivery_address text, p_delivery_email text default null
) returns uuid as $$
declare
  v_product public.products%rowtype; v_customer_rate numeric; v_seller_rate numeric;
  v_commission numeric(12,2); v_order_id uuid; v_email text := nullif(trim(p_delivery_email), '');
begin
  select * into v_product from public.products
  where id = p_product_id and approval_status = 'APPROVED' and is_hidden = false and is_digital = true for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_customer_rate := public.commission_rate('commission_customer_rate', 1);
  v_seller_rate := public.commission_rate('commission_seller_rate', 0);
  v_commission := public.customer_commission_amount(v_product.price, v_customer_rate);
  insert into public.orders (product_id, product_title, product_image, price, seller_id, buyer_id, delivery_address, delivery_email, payment_method, status, escrow_fee, payment_expires_at, customer_commission_rate, customer_commission_amount, seller_commission_rate, seller_commission_amount)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_product.price, v_product.seller_id, p_buyer_id, null, v_email, null, 'PENDING_PAYMENT', v_commission, now() + interval '30 minutes', v_customer_rate, v_commission, v_seller_rate, public.seller_commission_amount(v_product.price, v_seller_rate)) returning id into v_order_id;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Hosted checkout with coupon.
create or replace function public.create_order_pending_payment_with_coupon(
  p_product_id uuid, p_buyer_id text, p_delivery_address text, p_delivery_email text default null, p_coupon_code text default null
) returns uuid as $$
declare
  v_product public.products%rowtype; v_customer_rate numeric; v_seller_rate numeric;
  v_commission numeric(12,2); v_subtotal numeric(12,2); v_discount numeric(12,2) := 0;
  v_price numeric(12,2); v_code text := null; v_order_id uuid; v_coupon record;
  v_email text := nullif(trim(p_delivery_email), ''); v_seller_base numeric(12,2);
begin
  select * into v_product from public.products where id = p_product_id and approval_status = 'APPROVED' and is_hidden = false and is_digital = true for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_subtotal := v_product.price;
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount; v_code := v_coupon.normalized_code;
  end if;
  v_price := greatest(v_subtotal - v_discount, 0);
  v_customer_rate := public.commission_rate('commission_customer_rate', 1);
  v_seller_rate := public.commission_rate('commission_seller_rate', 0);
  v_commission := public.customer_commission_amount(v_price, v_customer_rate);
  v_seller_base := v_price + case when not exists (select 1 from public.coupons where code = v_code and funding_source = 'SELLER') then v_discount else 0 end;
  insert into public.orders (product_id, product_title, product_image, price, subtotal, discount_amount, coupon_code, seller_id, buyer_id, delivery_address, delivery_email, payment_method, status, escrow_fee, payment_expires_at, customer_commission_rate, customer_commission_amount, seller_commission_rate, seller_commission_amount)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_price, v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, null, v_email, null, 'PENDING_PAYMENT', v_commission, now() + interval '30 minutes', v_customer_rate, v_commission, v_seller_rate, public.seller_commission_amount(v_seller_base, v_seller_rate)) returning id into v_order_id;
  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount) values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Wallet checkout with coupon. Buyer commission is included in the wallet debit.
create or replace function public.create_order_wallet_payment_with_coupon(
  p_product_id uuid, p_buyer_id text, p_delivery_address text, p_delivery_email text default null, p_coupon_code text default null
) returns uuid as $$
declare
  v_product public.products%rowtype; v_balance numeric := 0; v_reserved numeric := 0;
  v_subtotal numeric(12,2); v_discount numeric(12,2) := 0; v_price numeric(12,2);
  v_commission numeric(12,2); v_total numeric(12,2); v_customer_rate numeric; v_seller_rate numeric;
  v_code text := null; v_order_id uuid; v_coupon record; v_email text := nullif(trim(p_delivery_email), '');
  v_seller_base numeric(12,2);
begin
  select * into v_product from public.products where id = p_product_id and approval_status = 'APPROVED' and is_hidden = false and is_digital = true for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_subtotal := v_product.price;
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount; v_code := v_coupon.normalized_code;
  end if;
  v_price := greatest(v_subtotal - v_discount, 0);
  v_customer_rate := public.commission_rate('commission_customer_rate', 1);
  v_seller_rate := public.commission_rate('commission_seller_rate', 0);
  v_commission := public.customer_commission_amount(v_price, v_customer_rate);
  v_total := v_price + v_commission;
  v_seller_base := v_price + case when not exists (select 1 from public.coupons where code = v_code and funding_source = 'SELLER') then v_discount else 0 end;
  perform public.sync_wallet_balance(p_buyer_id);
  select coalesce(b.available_balance, 0) into v_balance from public.wallet_balances b where b.user_id = p_buyer_id for update;
  if not found then raise exception 'Wallet balance not found'; end if;
  select coalesce(sum(r.amount), 0) into v_reserved from public.wallet_withdrawal_requests r where r.user_id = p_buyer_id and r.status in ('PENDING', 'APPROVED');
  if v_total > greatest(v_balance - v_reserved, 0) then raise exception 'Insufficient spendable wallet balance: available %, reserved %, requested %', v_balance, v_reserved, v_total; end if;
  insert into public.orders (product_id, product_title, product_image, price, subtotal, discount_amount, coupon_code, seller_id, buyer_id, delivery_address, delivery_email, payment_method, status, escrow_fee, customer_commission_rate, customer_commission_amount, seller_commission_rate, seller_commission_amount)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_price, v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, null, v_email, 'WALLET', 'ESCROW_HELD', v_commission, v_customer_rate, v_commission, v_seller_rate, public.seller_commission_amount(v_seller_base, v_seller_rate)) returning id into v_order_id;
  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount) values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;
  insert into public.payments(order_id, invoice_id, amount, fee, payment_method, transaction_id, status, raw_payload) values (v_order_id, 'WALLET-' || v_order_id::text, v_total, 0, 'WALLET', 'WALLET-' || v_order_id::text, 'COMPLETED', jsonb_build_object('source', 'wallet', 'buyer_id', p_buyer_id));
  insert into public.wallet_ledger(user_id, type, amount, order_id, description) values (p_buyer_id, 'WALLET_ORDER_PAYMENT', -v_total, v_order_id, 'ওয়ালেট দিয়ে অর্ডার পেমেন্ট — ' || v_product.title);
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Wallet payout uses the immutable seller commission snapshot.
create or replace function public.apply_order_wallet_effects() returns trigger as $$
declare v_seller_base numeric(12,2); v_payout numeric(12,2);
begin
  if new.status = 'CANCELLED' and old.status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'DIGITAL_DELIVERED', 'DISPUTED') then
    insert into public.wallet_ledger(user_id, type, amount, order_id, description)
    values (new.buyer_id, 'ORDER_REFUND', (new.price * new.quantity) + new.escrow_fee, new.id, 'অর্ডার বাতিল — রিফান্ড: ' || new.product_title);
  end if;
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    v_seller_base := (new.price * new.quantity) + case when new.coupon_funding_source = 'PLATFORM' then coalesce(new.discount_amount, 0) else 0 end;
    v_payout := greatest(v_seller_base - coalesce(new.seller_commission_amount, 0), 0);
    insert into public.wallet_ledger(user_id, type, amount, order_id, description)
    values (new.seller_id, 'SELLER_PAYOUT', v_payout, new.id, 'বিক্রয় সম্পন্ন — পেআউট: ' || new.product_title || ' (seller commission ' || coalesce(new.seller_commission_rate, 0)::text || '%)' );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop function if exists public.admin_set_commission_rates(text, numeric, numeric);
create or replace function public.admin_set_commission_rates(p_admin_id text, p_customer_rate numeric, p_seller_rate numeric) returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'settings.commission');
  if p_customer_rate is null or p_customer_rate < 0 or p_customer_rate > 100 then raise exception 'Customer commission must be between 0 and 100'; end if;
  if p_seller_rate is null or p_seller_rate < 0 or p_seller_rate > 100 then raise exception 'Seller commission must be between 0 and 100'; end if;
  insert into public.admin_settings(setting_key, setting_value, updated_by) values ('commission_customer_rate', jsonb_build_object('value', round(p_customer_rate, 2)::text), p_admin_id)
    on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now();
  insert into public.admin_settings(setting_key, setting_value, updated_by) values ('commission_seller_rate', jsonb_build_object('value', round(p_seller_rate, 2)::text), p_admin_id)
    on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now();
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.admin_set_commission_rates(text, numeric, numeric) from public;
grant execute on function public.admin_set_commission_rates(text, numeric, numeric) to service_role;

-- Legacy atomic checkout path used by older clients.
create or replace function public.create_order_atomic(
  p_product_id uuid, p_buyer_id text, p_delivery_address text, p_payment_method text
) returns uuid as $$
declare
  v_product public.products%rowtype; v_customer_rate numeric; v_seller_rate numeric;
  v_commission numeric(12,2); v_order_id uuid;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.seller_id = p_buyer_id then raise exception 'Cannot order your own listing'; end if;
  v_customer_rate := public.commission_rate('commission_customer_rate', 1);
  v_seller_rate := public.commission_rate('commission_seller_rate', 0);
  v_commission := public.customer_commission_amount(v_product.price, v_customer_rate);
  insert into public.orders (product_id, product_title, product_image, price, seller_id, buyer_id, delivery_address, payment_method, status, escrow_fee, customer_commission_rate, customer_commission_amount, seller_commission_rate, seller_commission_amount)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_product.price, v_product.seller_id, p_buyer_id, p_delivery_address, p_payment_method, 'ESCROW_HELD', v_commission, v_customer_rate, v_commission, v_seller_rate, public.seller_commission_amount(v_product.price, v_seller_rate)) returning id into v_order_id;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
