-- Admin controls for the server-only seller payout and buyer refund destinations.
-- Uses the existing sales.finance permission and admin audit log.

create or replace function public.admin_list_payment_accounts(p_admin_id text)
returns table(
  id uuid,
  user_id text,
  user_name text,
  user_email text,
  provider text,
  purpose text,
  transaction_type text,
  account_type text,
  account_number text,
  account_holder_name text,
  merchant_name text,
  is_default boolean,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  return query
  select a.id, a.user_id, p.name, p.email, a.provider, a.purpose,
         a.transaction_type, a.account_type, a.account_number,
         a.account_holder_name, a.merchant_name, a.is_default,
         a.created_at, a.updated_at
  from public.payment_accounts a
  left join public.profiles p on p.id = a.user_id
  order by a.is_default desc, a.updated_at desc
  limit 1000;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_upsert_payment_account(
  p_admin_id text,
  p_account_id uuid,
  p_user_id text,
  p_provider text,
  p_purpose text,
  p_transaction_type text,
  p_account_type text,
  p_account_number text,
  p_account_holder_name text default null,
  p_merchant_name text default null,
  p_is_default boolean default true
) returns public.payment_accounts as $$
declare v_row public.payment_accounts;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  if not exists (select 1 from public.profiles where id = trim(p_user_id)) then raise exception 'Customer profile not found'; end if;
  if p_provider not in ('BKASH', 'NAGAD', 'ROCKET', 'UPAY') then raise exception 'Invalid payment provider'; end if;
  if p_purpose not in ('SELLER_RECEIVE', 'BUYER_REFUND') then raise exception 'Invalid payment purpose'; end if;
  if p_transaction_type not in ('CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'PAYMENT') then raise exception 'Invalid transaction type'; end if;
  if p_account_type not in ('PERSONAL', 'MERCHANT') then raise exception 'Invalid account type'; end if;
  if trim(p_account_number) !~ '^01[0-9]{9}$' then raise exception 'Invalid Bangladesh mobile account number'; end if;
  if p_account_type = 'PERSONAL' and nullif(trim(coalesce(p_account_holder_name, '')), '') is null then raise exception 'Account holder name is required'; end if;
  if p_account_type = 'MERCHANT' and nullif(trim(coalesce(p_merchant_name, '')), '') is null then raise exception 'Merchant name is required'; end if;

  if coalesce(p_is_default, true) then
    update public.payment_accounts
    set is_default = false, updated_at = now()
    where user_id = trim(p_user_id) and purpose = p_purpose and (p_account_id is null or id <> p_account_id);
  end if;

  if p_account_id is null then
    insert into public.payment_accounts(user_id, provider, purpose, transaction_type, account_type, account_number, account_holder_name, merchant_name, is_default, updated_at)
    values (trim(p_user_id), p_provider, p_purpose, p_transaction_type, p_account_type, trim(p_account_number), nullif(trim(p_account_holder_name), ''), nullif(trim(p_merchant_name), ''), coalesce(p_is_default, true), now())
    returning * into v_row;
  else
    update public.payment_accounts
    set user_id = trim(p_user_id), provider = p_provider, purpose = p_purpose,
        transaction_type = p_transaction_type, account_type = p_account_type,
        account_number = trim(p_account_number), account_holder_name = nullif(trim(p_account_holder_name), ''),
        merchant_name = nullif(trim(p_merchant_name), ''), is_default = coalesce(p_is_default, true), updated_at = now()
    where id = p_account_id
    returning * into v_row;
    if not found then raise exception 'Payment account not found'; end if;
  end if;

  perform public.admin_log(p_admin_id, 'UPSERT_PAYMENT_ACCOUNT', 'PAYMENT_ACCOUNT', v_row.id::text,
    jsonb_build_object('user_id', v_row.user_id, 'purpose', v_row.purpose, 'provider', v_row.provider, 'is_default', v_row.is_default));
  return v_row;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_delete_payment_account(p_admin_id text, p_account_id uuid)
returns void as $$
declare v_row public.payment_accounts;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  select * into v_row from public.payment_accounts where id = p_account_id;
  if not found then raise exception 'Payment account not found'; end if;
  delete from public.payment_accounts where id = p_account_id;
  perform public.admin_log(p_admin_id, 'DELETE_PAYMENT_ACCOUNT', 'PAYMENT_ACCOUNT', p_account_id::text,
    jsonb_build_object('user_id', v_row.user_id, 'purpose', v_row.purpose, 'provider', v_row.provider));
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.admin_list_payment_accounts(text) from public, anon, authenticated;
revoke all on function public.admin_upsert_payment_account(text, uuid, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_delete_payment_account(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_payment_accounts(text) to service_role;
grant execute on function public.admin_upsert_payment_account(text, uuid, text, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.admin_delete_payment_account(text, uuid) to service_role;
