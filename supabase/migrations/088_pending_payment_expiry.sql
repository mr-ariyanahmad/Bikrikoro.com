-- BikriKoro: expire unpaid website orders after 30 minutes.

alter table public.orders
  add column if not exists payment_expires_at timestamptz,
  add column if not exists pending_payment_reminder_sent_at timestamptz;

update public.orders
set payment_expires_at = created_at + interval '30 minutes'
where status = 'PENDING_PAYMENT' and payment_expires_at is null;

create index if not exists idx_orders_pending_payment_expiry
  on public.orders(payment_expires_at)
  where status = 'PENDING_PAYMENT';

create or replace function public.expire_pending_payment_orders(p_limit integer default 500)
returns integer as $$
declare
  v_count integer;
begin
  with expired as (
    select id
    from public.orders
    where status = 'PENDING_PAYMENT'
      and payment_expires_at is not null
      and payment_expires_at <= now()
    order by payment_expires_at asc
    limit greatest(1, least(coalesce(p_limit, 500), 2000))
    for update skip locked
  )
  update public.orders o
  set status = 'CANCELLED', updated_at = now()
  from expired e
  where o.id = e.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.expire_pending_payment_orders(integer) from public;
grant execute on function public.expire_pending_payment_orders(integer) to service_role;

-- Keep all newly created website pending orders on the same 30-minute deadline.
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
  where id = p_product_id and approval_status = 'APPROVED' and is_hidden = false and is_digital = true
  for update;
  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Delivery email is invalid'; end if;
  v_escrow_fee := greatest(v_product.price * 0.01, 10);

  insert into public.orders (
    product_id, product_title, product_image, price, seller_id, buyer_id,
    delivery_address, delivery_email, payment_method, status, escrow_fee, payment_expires_at
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_product.price,
    v_product.seller_id, p_buyer_id, null, v_email, null, 'PENDING_PAYMENT',
    v_escrow_fee, now() + interval '30 minutes'
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
  where id = p_product_id and approval_status = 'APPROVED' and is_hidden = false and is_digital = true
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
    product_id, product_title, product_image, price, subtotal, discount_amount,
    coupon_code, seller_id, buyer_id, delivery_address, delivery_email,
    payment_method, status, escrow_fee, payment_expires_at
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''), greatest(v_subtotal - v_discount, 0),
    v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, null, v_email,
    null, 'PENDING_PAYMENT', v_escrow_fee, now() + interval '30 minutes'
  ) returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
    values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;
  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
