-- BikriKoro — safe withdrawal reservation and spendable balance
--
-- A pending/approved withdrawal reserves funds without creating a ledger debit.
-- The ledger is debited exactly once when the request becomes PAID. Rejected
-- requests immediately leave the active reservation set.

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
$$ language plpgsql security definer stable set search_path = public, pg_temp;

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

  -- Safe browser double-submit: return the existing active request.
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

drop function if exists public.admin_list_withdrawals_reconciled(text);
create function public.admin_list_withdrawals_reconciled(p_admin_id text)
returns table(
  id uuid,
  user_id text,
  amount numeric,
  method text,
  account_details text,
  status text,
  admin_note text,
  requested_at timestamptz,
  processed_at timestamptz,
  available_balance numeric,
  reserved_amount numeric,
  spendable_balance numeric
) as $$
begin
  perform public.admin_assert(p_admin_id);
  return query
  select r.id,
         r.user_id,
         r.amount,
         r.method,
         r.account_details,
         r.status,
         r.admin_note,
         r.requested_at,
         r.processed_at,
         coalesce(b.available_balance, 0) as available_balance,
         coalesce(active.reserved_amount, 0) as reserved_amount,
         greatest(coalesce(b.available_balance, 0) - coalesce(active.reserved_amount, 0), 0) as spendable_balance
  from public.wallet_withdrawal_requests r
  left join public.wallet_balances b on b.user_id = r.user_id
  left join lateral (
    select coalesce(sum(ar.amount), 0) as reserved_amount
    from public.wallet_withdrawal_requests ar
    where ar.user_id = r.user_id and ar.status in ('PENDING', 'APPROVED')
  ) active on true
  order by r.requested_at desc;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_review_withdrawal(
  p_admin_id text,
  p_request_id uuid,
  p_status text,
  p_admin_note text
) returns void as $$
declare
  v_current text;
  v_user_id text;
  v_balance numeric;
  v_reserved numeric;
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('APPROVED', 'REJECTED', 'PAID') then
    raise exception 'Invalid withdrawal status';
  end if;

  select r.status, r.user_id
  into v_current, v_user_id
  from public.wallet_withdrawal_requests r
  where r.id = p_request_id
  for update;
  if v_current is null then
    raise exception 'Withdrawal request not found';
  end if;

  if v_current = 'REJECTED' then
    raise exception 'Rejected withdrawal cannot be changed';
  end if;
  if v_current = 'PAID' then
    raise exception 'Withdrawal is already paid';
  end if;
  if v_current = 'PENDING' and p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'Pending withdrawal can only be approved or rejected';
  end if;
  if v_current = 'APPROVED' and p_status not in ('PAID', 'REJECTED') then
    raise exception 'Approved withdrawal can only be marked paid or rejected before settlement';
  end if;

  if p_status in ('APPROVED', 'PAID') then
    select coalesce(b.available_balance, 0)
    into v_balance
    from public.wallet_balances b
    where b.user_id = v_user_id
    for update;
    if not found then
      raise exception 'Seller wallet balance not found';
    end if;
  end if;

  if p_status = 'APPROVED' then
    select coalesce(sum(r.amount), 0)
    into v_reserved
    from public.wallet_withdrawal_requests r
    where r.user_id = v_user_id and r.status in ('PENDING', 'APPROVED');
    if v_reserved > v_balance then
      raise exception 'Cannot approve payout: active payout reservations exceed available wallet balance';
    end if;
  end if;

  update public.wallet_withdrawal_requests
  set status = p_status,
      admin_note = coalesce(p_admin_note, ''),
      processed_at = case when p_status in ('APPROVED', 'REJECTED', 'PAID') then now() else processed_at end
  where id = p_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.user_wallet_withdrawal_summary(text) from public;
revoke all on function public.user_wallet_withdrawal_summary(text) from anon;
revoke all on function public.user_wallet_withdrawal_summary(text) from authenticated;
grant execute on function public.user_wallet_withdrawal_summary(text) to service_role;
revoke all on function public.request_wallet_withdrawal(text, numeric, text, text) from public;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text) to service_role;
revoke all on function public.admin_list_withdrawals_reconciled(text) from public;
grant execute on function public.admin_list_withdrawals_reconciled(text) to service_role;
revoke all on function public.admin_review_withdrawal(text, uuid, text, text) from public;
grant execute on function public.admin_review_withdrawal(text, uuid, text, text) to service_role;
