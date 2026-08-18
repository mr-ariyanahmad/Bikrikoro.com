-- BikriKoro — wallet checkout and customer-visible withdrawal history
--
-- Wallet checkout is atomic: it locks the product and wallet, checks the
-- spendable balance, creates an ESCROW_HELD order, records a completed wallet
-- payment, and writes one wallet debit in the same transaction.

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'CARD', 'CASH_ON_MEETUP', 'WALLET'));

alter table public.wallet_ledger drop constraint if exists wallet_ledger_type_check;
alter table public.wallet_ledger add constraint wallet_ledger_type_check
  check (type in ('ORDER_REFUND', 'SELLER_PAYOUT', 'WITHDRAWAL', 'ADJUSTMENT', 'WALLET_ORDER_PAYMENT'));

create or replace function public.user_wallet_withdrawal_history(
  p_user_id text,
  p_limit integer default 50
) returns setof public.wallet_withdrawal_requests as $$
begin
  return query
  select r.*
  from public.wallet_withdrawal_requests r
  where r.user_id::text = p_user_id::text
  order by r.requested_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.create_order_wallet_payment_with_coupon(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
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

  v_price := greatest(v_subtotal - v_discount, 0);
  v_escrow_fee := greatest(v_price * 0.01, 10);
  v_total := v_price + v_escrow_fee;

  select coalesce(b.available_balance, 0)
  into v_balance
  from public.wallet_balances b
  where b.user_id = p_buyer_id
  for update;

  select coalesce(sum(r.amount), 0)
  into v_reserved
  from public.wallet_withdrawal_requests r
  where r.user_id = p_buyer_id
    and r.status in ('PENDING', 'APPROVED');

  if v_total > greatest(v_balance - v_reserved, 0) then
    raise exception 'Insufficient spendable wallet balance: available %, reserved %, requested %', v_balance, v_reserved, v_total;
  end if;

  insert into public.orders (
    product_id, product_title, product_image, price, subtotal, discount_amount,
    coupon_code, seller_id, buyer_id, delivery_address, payment_method, status,
    escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_price,
    v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id,
    trim(p_delivery_address), 'WALLET', 'ESCROW_HELD', v_escrow_fee
  ) returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
    values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;

  insert into public.payments(
    order_id, invoice_id, amount, fee, payment_method, transaction_id, status, raw_payload
  ) values (
    v_order_id, 'WALLET-' || v_order_id::text, v_total, 0, 'WALLET',
    'WALLET-' || v_order_id::text, 'COMPLETED',
    jsonb_build_object('source', 'wallet', 'buyer_id', p_buyer_id)
  );

  insert into public.wallet_ledger(user_id, type, amount, order_id, description)
  values (p_buyer_id, 'WALLET_ORDER_PAYMENT', -v_total, v_order_id, 'ওয়ালেট দিয়ে অর্ডার পেমেন্ট — ' || v_product.title);

  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_wallet_payment(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text
) returns uuid as $$
begin
  return public.create_order_wallet_payment_with_coupon(p_product_id, p_buyer_id, p_delivery_address, null);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.user_wallet_withdrawal_history(text, integer) from public;
grant execute on function public.user_wallet_withdrawal_history(text, integer) to service_role;
revoke all on function public.create_order_wallet_payment(uuid, text, text) from public;
grant execute on function public.create_order_wallet_payment(uuid, text, text) to service_role;
revoke all on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text) from public;
grant execute on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text) to service_role;
