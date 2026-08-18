-- BikriKoro — payout reconciliation and idempotency
-- Apply after 041 and 045. Existing rows are not deleted automatically; the
-- admin queue exposes their reserved total so an admin can reject invalid or
-- duplicate requests deliberately.

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

  -- The lock serializes concurrent requests for the same wallet.
  select available_balance into v_balance
  from public.wallet_balances
  where user_id = p_user_id
  for update;
  if v_balance is null then
    raise exception 'Seller wallet balance not found';
  end if;

  -- A browser double-submit with exactly the same active details is idempotent.
  select id into v_request_id
  from public.wallet_withdrawal_requests
  where user_id = p_user_id
    and status in ('PENDING', 'APPROVED')
    and amount = p_amount
    and method = p_method
    and account_details = trim(p_account_details)
  order by requested_at desc
  limit 1;
  if v_request_id is not null then
    return v_request_id;
  end if;

  -- Pending and approved requests reserve balance before settlement. Without
  -- this check, several different requests could all pass against one balance.
  select coalesce(sum(amount), 0) into v_reserved
  from public.wallet_withdrawal_requests
  where user_id = p_user_id
    and status in ('PENDING', 'APPROVED');
  if v_balance < v_reserved + p_amount then
    raise exception 'Insufficient wallet balance after pending payouts: available %, reserved %, requested %', v_balance, v_reserved, p_amount;
  end if;

  insert into public.wallet_withdrawal_requests(user_id, amount, method, account_details)
  values (p_user_id, p_amount, p_method, trim(p_account_details))
  returning id into v_request_id;
  return v_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_list_withdrawals_reconciled(p_admin_id text)
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
  reserved_amount numeric
) as $$
begin
  perform public.admin_assert(p_admin_id);
  return query
  select r.id, r.user_id, r.amount, r.method, r.account_details, r.status,
         r.admin_note, r.requested_at, r.processed_at,
         coalesce(b.available_balance, 0) as available_balance,
         coalesce((select sum(active.amount) from public.wallet_withdrawal_requests active
                   where active.user_id = r.user_id and active.status in ('PENDING', 'APPROVED')), 0) as reserved_amount
  from public.wallet_withdrawal_requests r
  left join public.wallet_balances b on b.user_id = r.user_id
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
  v_balance numeric;
  v_reserved numeric;
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('APPROVED', 'REJECTED', 'PAID') then
    raise exception 'Invalid withdrawal status';
  end if;
  select status into v_current from public.wallet_withdrawal_requests where id = p_request_id for update;
  if v_current is null then
    raise exception 'Withdrawal request not found';
  end if;
  if v_current = 'PAID' then
    raise exception 'Withdrawal is already paid';
  end if;
  if v_current = 'PENDING' and p_status = 'PAID' then
    raise exception 'Withdrawal must be approved before it can be paid';
  end if;
  if v_current = 'REJECTED' then
    raise exception 'Rejected withdrawal cannot be changed';
  end if;
  if p_status = 'APPROVED' then
    select available_balance into v_balance from public.wallet_balances b
    where b.user_id = (select user_id from public.wallet_withdrawal_requests where id = p_request_id)
    for update;
    select coalesce(sum(amount), 0) into v_reserved
    from public.wallet_withdrawal_requests
    where user_id = (select user_id from public.wallet_withdrawal_requests where id = p_request_id)
      and status in ('PENDING', 'APPROVED');
    if v_balance is null or v_reserved > v_balance then
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

revoke all on function public.admin_list_withdrawals_reconciled(text) from public;
grant execute on function public.admin_list_withdrawals_reconciled(text) to service_role;
revoke all on function public.request_wallet_withdrawal(text, numeric, text, text) from public;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text) to service_role;
revoke all on function public.admin_review_withdrawal(text, uuid, text, text) from public;
grant execute on function public.admin_review_withdrawal(text, uuid, text, text) to service_role;
