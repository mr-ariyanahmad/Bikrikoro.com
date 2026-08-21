-- BikriKoro: optional delivery email for digital fulfillment.
-- Digital orders never require a physical address. Email is optional and is
-- collected only when the product category needs an account or recipient inbox.

alter table public.orders add column if not exists delivery_email text;

-- Remove legacy signatures so RPC calls cannot accidentally select the old
-- address-required functions.
drop function if exists public.create_order_pending_payment(uuid, text, text);
drop function if exists public.create_order_pending_payment_with_coupon(uuid, text, text, text);
drop function if exists public.create_order_wallet_payment(uuid, text, text);
drop function if exists public.create_order_wallet_payment_with_coupon(uuid, text, text, text);

create or replace function public.create_order_pending_payment(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
  p_delivery_email text default null
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_escrow_fee numeric(12,2);
  v_order_id uuid;
  v_email text := nullif(trim(p_delivery_email), '');
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
    and is_digital = true
  for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_escrow_fee := greatest(v_product.price * 0.01, 10);

  insert into public.orders (
    product_id, product_title, product_image, price, seller_id, buyer_id,
    delivery_address, delivery_email, payment_method, status, escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''),
    v_product.price, v_product.seller_id, p_buyer_id, null, v_email, null,
    'PENDING_PAYMENT', v_escrow_fee
  ) returning id into v_order_id;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_pending_payment_with_coupon(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
  p_delivery_email text default null,
  p_coupon_code text default null
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_escrow_fee numeric(12,2);
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_code text := null;
  v_order_id uuid;
  v_coupon record;
  v_email text := nullif(trim(p_delivery_email), '');
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
    and is_digital = true
  for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_subtotal := v_product.price;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount;
    v_code := v_coupon.normalized_code;
  end if;

  v_escrow_fee := greatest(greatest(v_subtotal - v_discount, 0) * 0.01, 10);
  insert into public.orders (
    product_id, product_title, product_image, price, subtotal,
    discount_amount, coupon_code, seller_id, buyer_id, delivery_address,
    delivery_email, payment_method, status, escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''),
    greatest(v_subtotal - v_discount, 0), v_subtotal, v_discount, v_code,
    v_product.seller_id, p_buyer_id, null, v_email, null,
    'PENDING_PAYMENT', v_escrow_fee
  ) returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
    values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_wallet_payment_with_coupon(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
  p_delivery_email text default null,
  p_coupon_code text default null
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_balance numeric := 0;
  v_reserved numeric := 0;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_price numeric(12,2);
  v_escrow_fee numeric(12,2);
  v_total numeric(12,2);
  v_code text := null;
  v_order_id uuid;
  v_coupon record;
  v_email text := nullif(trim(p_delivery_email), '');
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
    and is_digital = true
  for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;

  v_subtotal := v_product.price;
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount;
    v_code := v_coupon.normalized_code;
  end if;

  v_price := greatest(v_subtotal - v_discount, 0);
  v_escrow_fee := greatest(v_price * 0.01, 10);
  v_total := v_price + v_escrow_fee;
  perform public.sync_wallet_balance(p_buyer_id);

  select coalesce(b.available_balance, 0) into v_balance
  from public.wallet_balances b where b.user_id = p_buyer_id for update;
  if not found then raise exception 'Wallet balance not found'; end if;

  select coalesce(sum(r.amount), 0) into v_reserved
  from public.wallet_withdrawal_requests r
  where r.user_id = p_buyer_id and r.status in ('PENDING', 'APPROVED');
  if v_total > greatest(v_balance - v_reserved, 0) then
    raise exception 'Insufficient spendable wallet balance: available %, reserved %, requested %', v_balance, v_reserved, v_total;
  end if;

  insert into public.orders (
    product_id, product_title, product_image, price, subtotal, discount_amount,
    coupon_code, seller_id, buyer_id, delivery_address, delivery_email,
    payment_method, status, escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_price,
    v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, null,
    v_email, 'WALLET', 'ESCROW_HELD', v_escrow_fee
  ) returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
    values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;

  insert into public.payments(order_id, invoice_id, amount, fee, payment_method, transaction_id, status, raw_payload)
  values (v_order_id, 'WALLET-' || v_order_id::text, v_total, 0, 'WALLET', 'WALLET-' || v_order_id::text, 'COMPLETED', jsonb_build_object('source', 'wallet', 'buyer_id', p_buyer_id));
  insert into public.wallet_ledger(user_id, type, amount, order_id, description)
  values (p_buyer_id, 'WALLET_ORDER_PAYMENT', -v_total, v_order_id, 'ওয়ালেট দিয়ে অর্ডার পেমেন্ট — ' || v_product.title);
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_wallet_payment(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
  p_delivery_email text default null
) returns uuid as $$
begin
  return public.create_order_wallet_payment_with_coupon(p_product_id, p_buyer_id, p_delivery_address, p_delivery_email, null);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.create_order_pending_payment(uuid, text, text, text) from public;
grant execute on function public.create_order_pending_payment(uuid, text, text, text) to service_role;
revoke all on function public.create_order_pending_payment_with_coupon(uuid, text, text, text, text) from public;
grant execute on function public.create_order_pending_payment_with_coupon(uuid, text, text, text, text) to service_role;
revoke all on function public.create_order_wallet_payment(uuid, text, text, text) from public;
grant execute on function public.create_order_wallet_payment(uuid, text, text, text) to service_role;
revoke all on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text, text) from public;
grant execute on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text, text) to service_role;
