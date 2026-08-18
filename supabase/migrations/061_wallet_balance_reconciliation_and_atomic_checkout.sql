-- BikriKoro wallet balance reconciliation and atomic checkout repair.
-- wallet_ledger is the source of truth; wallet_balances is a fast-read cache.

create or replace function public.sync_wallet_balance(p_user_id text)
returns numeric as $$
declare
  v_balance numeric;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null then
    raise exception 'Wallet user is required';
  end if;

  insert into public.wallet_balances(user_id, available_balance, updated_at)
  select
    p_user_id,
    coalesce(sum(l.amount), 0)::numeric(12,2),
    now()
  from public.wallet_ledger l
  where l.user_id = p_user_id
  on conflict (user_id) do update
    set available_balance = excluded.available_balance,
        updated_at = now()
  returning available_balance into v_balance;

  return coalesce(v_balance, 0);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Recreate the balance-maintenance trigger in case the original wallet
-- migration was only partially applied in the deployed database.
create or replace function public.apply_wallet_ledger_entry() returns trigger as $$
begin
  insert into public.wallet_balances (user_id, available_balance, updated_at)
  values (new.user_id, new.amount, now())
  on conflict (user_id) do update
    set available_balance = public.wallet_balances.available_balance + excluded.available_balance,
        updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_apply_wallet_ledger_entry on public.wallet_ledger;
create trigger trg_apply_wallet_ledger_entry
after insert on public.wallet_ledger
for each row execute function public.apply_wallet_ledger_entry();

-- Repair the fast-read cache for all existing profiles without inventing
-- credits: every value comes from the append-only ledger.
insert into public.wallet_balances(user_id, available_balance, updated_at)
select
  p.id,
  coalesce(sum(l.amount), 0)::numeric(12,2),
  now()
from public.profiles p
left join public.wallet_ledger l on l.user_id = p.id
group by p.id
on conflict (user_id) do update
  set available_balance = excluded.available_balance,
      updated_at = now()
where public.wallet_balances.available_balance is distinct from excluded.available_balance;

create or replace function public.user_wallet_balance(p_user_id text)
returns public.wallet_balances as $$
declare
  v_balance public.wallet_balances;
begin
  perform public.sync_wallet_balance(p_user_id);
  select * into v_balance
  from public.wallet_balances
  where user_id::text = p_user_id::text;
  return v_balance;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.user_wallet_withdrawal_summary(p_user_id text)
returns table(
  available_balance numeric,
  reserved_amount numeric,
  spendable_balance numeric,
  pending_amount numeric,
  approved_amount numeric
) as $$
declare
  v_available numeric := 0;
  v_pending numeric := 0;
  v_approved numeric := 0;
begin
  perform public.sync_wallet_balance(p_user_id);

  select coalesce(b.available_balance, 0)
  into v_available
  from public.wallet_balances b
  where b.user_id::text = p_user_id::text;

  select
    coalesce(sum(case when r.status = 'PENDING' then r.amount else 0 end), 0),
    coalesce(sum(case when r.status = 'APPROVED' then r.amount else 0 end), 0)
  into v_pending, v_approved
  from public.wallet_withdrawal_requests r
  where r.user_id::text = p_user_id::text
    and r.status in ('PENDING', 'APPROVED');

  return query select
    v_available,
    v_pending + v_approved,
    greatest(v_available - v_pending - v_approved, 0),
    v_pending,
    v_approved;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.request_wallet_withdrawal(
  p_user_id text,
  p_amount numeric,
  p_method text,
  p_account_details text
) returns uuid as $$
declare
  v_balance numeric;
  v_reserved numeric;
  v_request_id uuid;
begin
  perform public.sync_wallet_balance(p_user_id);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be positive';
  end if;
  if p_method not in ('BKASH', 'NAGAD', 'BANK') then
    raise exception 'Invalid withdrawal method';
  end if;
  if nullif(trim(coalesce(p_account_details, '')), '') is null then
    raise exception 'Withdrawal account details are required';
  end if;

  select coalesce(b.available_balance, 0)
  into v_balance
  from public.wallet_balances b
  where b.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Seller wallet balance not found';
  end if;

  select r.id into v_request_id
  from public.wallet_withdrawal_requests r
  where r.user_id = p_user_id
    and r.status in ('PENDING', 'APPROVED')
    and r.amount = p_amount
    and r.method = p_method
    and r.account_details = trim(p_account_details)
  order by r.requested_at desc
  limit 1;
  if v_request_id is not null then
    return v_request_id;
  end if;

  select coalesce(sum(r.amount), 0)
  into v_reserved
  from public.wallet_withdrawal_requests r
  where r.user_id = p_user_id
    and r.status in ('PENDING', 'APPROVED');

  if p_amount > greatest(v_balance - v_reserved, 0) then
    raise exception 'Insufficient spendable wallet balance: available %, reserved %, requested %', v_balance, v_reserved, p_amount;
  end if;

  insert into public.wallet_withdrawal_requests(user_id, amount, method, account_details)
  values (p_user_id, p_amount, p_method, trim(p_account_details))
  returning id into v_request_id;
  return v_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_adjust_customer_wallet(
  p_admin_id text,
  p_customer_id text,
  p_amount numeric,
  p_reason text
) returns void as $$
declare
  v_balance numeric;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  if not exists (select 1 from public.profiles where id = p_customer_id) then
    raise exception 'Customer not found';
  end if;
  if coalesce(p_amount, 0) = 0 or length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Amount and reason are required';
  end if;

  perform public.sync_wallet_balance(p_customer_id);
  select coalesce(available_balance, 0)
  into v_balance
  from public.wallet_balances
  where user_id = p_customer_id
  for update;
  if coalesce(v_balance, 0) + p_amount < 0 then
    raise exception 'Adjustment would make wallet negative';
  end if;

  insert into public.wallet_ledger(user_id, type, amount, description)
  values (p_customer_id, 'ADJUSTMENT', p_amount, 'Admin adjustment: ' || trim(p_reason));
  perform public.admin_log(
    p_admin_id,
    case when p_amount > 0 then 'CREDIT_CUSTOMER_WALLET' else 'DEBIT_CUSTOMER_WALLET' end,
    'PROFILE',
    p_customer_id,
    jsonb_build_object('amount', p_amount, 'reason', trim(p_reason))
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

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

  -- Rebuild the cache before locking it. This repairs users whose old
  -- adjustment was recorded in the ledger while the cache row was missing.
  perform public.sync_wallet_balance(p_buyer_id);
  select coalesce(b.available_balance, 0)
  into v_balance
  from public.wallet_balances b
  where b.user_id = p_buyer_id
  for update;
  if not found then raise exception 'Wallet balance not found'; end if;

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

revoke all on function public.sync_wallet_balance(text) from public;
grant execute on function public.sync_wallet_balance(text) to service_role;
revoke all on function public.user_wallet_balance(text) from public;
grant execute on function public.user_wallet_balance(text) to anon, authenticated, service_role;
revoke all on function public.user_wallet_withdrawal_summary(text) from public;
grant execute on function public.user_wallet_withdrawal_summary(text) to service_role;
revoke all on function public.request_wallet_withdrawal(text, numeric, text, text) from public;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text) to service_role;
revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from public;
grant execute on function public.admin_adjust_customer_wallet(text, text, numeric, text) to anon, authenticated, service_role;
revoke all on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text) from public;
grant execute on function public.create_order_wallet_payment_with_coupon(uuid, text, text, text) to service_role;
