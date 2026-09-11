create or replace function public.admin_get_dashboard_overview(p_admin_id text)
returns jsonb as $$
declare v_recent jsonb; v_ledger jsonb; v_analytics jsonb; v_pending_sellers integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'dashboard.view');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_recent
  from (select o.id, o.product_title, o.price, o.status, o.created_at, bp.name as buyer_name, sp.name as seller_name from public.orders o left join public.profiles bp on bp.id=o.buyer_id left join public.profiles sp on sp.id=o.seller_id order by o.created_at desc limit 7) q;
  select count(*)::integer into v_pending_sellers from public.seller_registrations where status = 'PENDING';
  select coalesce(jsonb_agg(to_jsonb(q) order by q.day), '[]'::jsonb) into v_analytics from (select date_trunc('day', created_at)::date as day, count(*)::integer as orders, coalesce(sum(price) filter (where status in ('ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED','COMPLETED')),0) as revenue from public.orders where created_at >= now() - interval '12 months' group by 1 order by 1) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_ledger from (select l.id, l.user_id, p.name as user_name, l.type, l.amount, l.order_id, l.description, l.created_at from public.wallet_ledger l left join public.profiles p on p.id=l.user_id order by l.created_at desc limit 20) q;
  return jsonb_build_object('orders',(select count(*) from public.orders),'customers',(select count(*) from public.profiles),'products',(select count(*) from public.products where is_digital=true),'pending',(select count(*) from public.orders where status in ('PENDING_PAYMENT','ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED')),'disputes',(select count(*) from public.order_disputes where status in ('REPORTED','UNDER_REVIEW')),'sellers',v_pending_sellers,'revenue',coalesce((select sum(price) from public.orders where status in ('ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED','COMPLETED')),0),'total_wallet_balance',coalesce((select sum(available_balance) from public.wallet_balances),0),'wallet_users',(select count(*) from public.wallet_balances),'unread_chats',coalesce((select sum(buyer_unread_count+seller_unread_count) from public.chat_threads),0),'unread_notifications',(select count(*) from public.notifications where is_read=false),'ledger_entries',(select count(*) from public.wallet_ledger),'recent_orders',v_recent,'recent_ledger',v_ledger,'sales_analytics',v_analytics);
end;
$$ language plpgsql security definer stable set search_path=public,pg_temp;
revoke all on function public.admin_get_dashboard_overview(text) from public, anon, authenticated;
grant execute on function public.admin_get_dashboard_overview(text) to service_role;
