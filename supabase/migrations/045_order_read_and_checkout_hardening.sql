-- BikriKoro — order reads, checkout visibility, and wallet access hardening
-- Apply after 044. Browser code should use the owner-scoped RPCs below or the
-- protected Vercel endpoints; the Firebase UID remains the application identity.

create or replace function public.create_order_pending_payment(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_escrow_fee numeric(12,2);
  v_order_id uuid;
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
  for update;
  if not found then raise exception 'Product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if coalesce(trim(p_delivery_address), '') = '' then raise exception 'Delivery address is required'; end if;
  v_escrow_fee := greatest(v_product.price * 0.01, 10);

  insert into public.orders (product_id, product_title, product_image, price, seller_id, buyer_id, delivery_address, payment_method, status, escrow_fee)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_product.price, v_product.seller_id, p_buyer_id, trim(p_delivery_address), null, 'PENDING_PAYMENT', v_escrow_fee)
  returning id into v_order_id;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_pending_payment_with_coupon(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
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
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
  for update;
  if not found then raise exception 'Product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if coalesce(trim(p_delivery_address), '') = '' then raise exception 'Delivery address is required'; end if;
  v_subtotal := v_product.price;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount;
    v_code := v_coupon.normalized_code;
  end if;

  v_escrow_fee := greatest(greatest(v_subtotal - v_discount, 0) * 0.01, 10);
  insert into public.orders (product_id, product_title, product_image, price, subtotal, discount_amount, coupon_code, seller_id, buyer_id, delivery_address, payment_method, status, escrow_fee)
  values (v_product.id, v_product.title, coalesce(v_product.images[1], ''), greatest(v_subtotal - v_discount, 0), v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, trim(p_delivery_address), null, 'PENDING_PAYMENT', v_escrow_fee)
  returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount) values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.buyer_list_orders(p_user_id text)
returns setof public.orders as $$
begin
  return query select o.* from public.orders o where o.buyer_id::text = p_user_id::text or o.seller_id::text = p_user_id::text order by o.created_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.buyer_get_order(p_user_id text, p_order_id uuid)
returns public.orders as $$
declare v_order public.orders;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id and (o.buyer_id::text = p_user_id::text or o.seller_id::text = p_user_id::text);
  if not found then raise exception 'Order not found or not yours'; end if;
  return v_order;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.buyer_get_payment_state(p_buyer_id text, p_order_id uuid)
returns text as $$
declare v_status text;
begin
  select status into v_status from public.orders where id = p_order_id and buyer_id::text = p_buyer_id::text;
  if not found then raise exception 'Order not found or not yours'; end if;
  return v_status;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.buyer_has_order_review(p_buyer_id text, p_order_id uuid)
returns boolean as $$
begin
  return exists (select 1 from public.reviews where order_id::text = p_order_id::text and buyer_id::text = p_buyer_id::text);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.user_wallet_balance(p_user_id text)
returns public.wallet_balances as $$
declare v_balance public.wallet_balances;
begin
  select * into v_balance from public.wallet_balances where user_id::text = p_user_id::text;
  if not found then
    v_balance.user_id := p_user_id;
    v_balance.available_balance := 0;
    v_balance.updated_at := now();
  end if;
  return v_balance;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.user_wallet_ledger(p_user_id text, p_limit integer default 50)
returns setof public.wallet_ledger as $$
begin
  return query select l.* from public.wallet_ledger l where l.user_id::text = p_user_id::text order by l.created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.buyer_list_orders(text) from public;
grant execute on function public.buyer_list_orders(text) to anon, authenticated;
revoke all on function public.buyer_get_order(text, uuid) from public;
grant execute on function public.buyer_get_order(text, uuid) to anon, authenticated;
revoke all on function public.buyer_get_payment_state(text, uuid) from public;
grant execute on function public.buyer_get_payment_state(text, uuid) to anon, authenticated;
revoke all on function public.buyer_has_order_review(text, uuid) from public;
grant execute on function public.buyer_has_order_review(text, uuid) to anon, authenticated;
revoke all on function public.user_wallet_balance(text) from public;
grant execute on function public.user_wallet_balance(text) to anon, authenticated;
revoke all on function public.user_wallet_ledger(text, integer) from public;
grant execute on function public.user_wallet_ledger(text, integer) to anon, authenticated;
revoke all on function public.request_wallet_withdrawal(text, numeric, text, text) from public;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text) to service_role;
