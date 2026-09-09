create or replace function public.admin_get_dashboard_overview(p_admin_id text)
returns jsonb as $$
declare v_recent jsonb; v_ledger jsonb; v_pending_sellers integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'dashboard.view');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_recent from (select id, product_title, price, status, created_at from public.orders order by created_at desc limit 7) q;
  select count(*)::integer into v_pending_sellers from public.seller_registrations where status = 'PENDING';
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_ledger from (select l.id, l.user_id, p.name as user_name, l.type, l.amount, l.order_id, l.description, l.created_at from public.wallet_ledger l left join public.profiles p on p.id = l.user_id order by l.created_at desc limit 20) q;
  return jsonb_build_object(
    'orders', (select count(*) from public.orders), 'customers', (select count(*) from public.profiles), 'products', (select count(*) from public.products where is_digital = true),
    'pending', (select count(*) from public.orders where status in ('PENDING_PAYMENT','ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED')), 'disputes', (select count(*) from public.order_disputes where status in ('REPORTED','UNDER_REVIEW')), 'sellers', v_pending_sellers,
    'revenue', coalesce((select sum(price) from public.orders where status in ('ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED','COMPLETED')),0),
    'total_wallet_balance', coalesce((select sum(available_balance) from public.wallet_balances),0), 'wallet_users', (select count(*) from public.wallet_balances),
    'unread_chats', coalesce((select sum(buyer_unread_count + seller_unread_count) from public.chat_threads),0), 'unread_notifications', (select count(*) from public.notifications where is_read = false),
    'ledger_entries', (select count(*) from public.wallet_ledger), 'recent_orders', v_recent, 'recent_ledger', v_ledger
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_get_finance_overview(p_admin_id text)
returns jsonb as $$
declare v_ledger jsonb; v_types jsonb;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.finance');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_ledger from (select l.id, l.user_id, p.name as user_name, l.type, l.amount, l.order_id, l.description, l.created_at from public.wallet_ledger l left join public.profiles p on p.id=l.user_id order by l.created_at desc limit 200) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.type), '[]'::jsonb) into v_types from (select type, count(*) as entries, coalesce(sum(amount),0) as net_amount from public.wallet_ledger group by type) q;
  return jsonb_build_object('total_wallet_balance',coalesce((select sum(available_balance) from public.wallet_balances),0),'wallet_users',(select count(*) from public.wallet_balances),'ledger_entries',(select count(*) from public.wallet_ledger),'by_type',v_types,'transactions',v_ledger);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;
revoke all on function public.admin_get_dashboard_overview(text) from public, anon, authenticated;
revoke all on function public.admin_get_finance_overview(text) from public, anon, authenticated;
grant execute on function public.admin_get_dashboard_overview(text) to service_role;
grant execute on function public.admin_get_finance_overview(text) to service_role;
