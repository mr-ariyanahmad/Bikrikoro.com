create or replace function public.admin_get_finance_overview(p_admin_id text)
returns jsonb as $$
declare v_ledger jsonb; v_types jsonb; v_wallets jsonb;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_ledger
  from (select l.id, l.user_id, p.name as user_name, p.email, l.type, l.amount, l.order_id, l.description, l.created_at from public.wallet_ledger l left join public.profiles p on p.id=l.user_id order by l.created_at desc limit 200) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.available_balance desc), '[]'::jsonb) into v_wallets
  from (select w.user_id, p.name as user_name, p.email, w.available_balance, w.reserved_amount, greatest(w.available_balance - w.reserved_amount, 0) as spendable_balance from public.wallet_balances w left join public.profiles p on p.id=w.user_id order by w.available_balance desc limit 500) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.type), '[]'::jsonb) into v_types from (select type, count(*) as entries, coalesce(sum(amount),0) as net_amount from public.wallet_ledger group by type) q;
  return jsonb_build_object('total_wallet_balance',coalesce((select sum(available_balance) from public.wallet_balances),0),'wallet_users',(select count(*) from public.wallet_balances),'ledger_entries',(select count(*) from public.wallet_ledger),'by_type',v_types,'wallets',v_wallets,'transactions',v_ledger);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;
revoke all on function public.admin_get_finance_overview(text) from public, anon, authenticated;
grant execute on function public.admin_get_finance_overview(text) to service_role;
