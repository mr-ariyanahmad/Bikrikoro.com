-- BikriKoro — permission-scoped admin reads for dashboards and operational queues
-- Apply after 045. All functions bind reads to admin permissions and are
-- called through /api/admin-rpc, which verifies the Firebase ID token.

create or replace function public.admin_get_dashboard_overview(p_admin_id text)
returns jsonb as $$
declare
  v_recent jsonb;
  v_pending_sellers integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'dashboard.view');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_recent
  from (select id, product_title, price, status, created_at from public.orders order by created_at desc limit 7) q;
  select count(*)::integer into v_pending_sellers from public.seller_registrations where status = 'PENDING';
  return jsonb_build_object(
    'orders', (select count(*) from public.orders),
    'customers', (select count(*) from public.profiles),
    'products', (select count(*) from public.products),
    'pending', (select count(*) from public.orders where status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED')),
    'disputes', (select count(*) from public.order_disputes where status in ('REPORTED', 'UNDER_REVIEW')),
    'sellers', v_pending_sellers,
    'revenue', coalesce((select sum(price) from public.orders where status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED')), 0),
    'recent_orders', v_recent
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_list_pending_disputes(p_admin_id text)
returns setof public.order_disputes as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.disputes');
  return query select d.* from public.order_disputes d where d.status in ('REPORTED', 'UNDER_REVIEW') order by d.created_at asc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_find_user_profile(p_admin_id text, p_identifier text)
returns table(id text, email text, name text) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'team.manage');
  return query select p.id, p.email, p.name from public.profiles p where p.id::text = trim(p_identifier) or lower(coalesce(p.email, '')) = lower(trim(p_identifier)) limit 1;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_get_system_status(p_admin_id text)
returns jsonb as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'settings.system');
  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'products', (select count(*) from public.products),
    'orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'PENDING_PAYMENT'),
    'updated_at', now()
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_list_categories(p_admin_id text)
returns setof public.categories as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.categories');
  return query select c.* from public.categories c order by c.sort_order, c.name;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_list_banners(p_admin_id text)
returns setof public.promo_banners as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.gallery');
  return query select b.* from public.promo_banners b order by b.sort_order, b.id;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_list_digital_deliveries(p_admin_id text)
returns setof public.digital_deliveries as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.downloads');
  return query select d.* from public.digital_deliveries d order by d.created_at desc limit 100;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.admin_get_dashboard_overview(text) from public;
grant execute on function public.admin_get_dashboard_overview(text) to service_role;
revoke all on function public.admin_list_pending_disputes(text) from public;
grant execute on function public.admin_list_pending_disputes(text) to service_role;
revoke all on function public.admin_find_user_profile(text, text) from public;
grant execute on function public.admin_find_user_profile(text, text) to service_role;
revoke all on function public.admin_get_system_status(text) from public;
grant execute on function public.admin_get_system_status(text) to service_role;
revoke all on function public.admin_list_categories(text) from public;
grant execute on function public.admin_list_categories(text) to service_role;
revoke all on function public.admin_list_banners(text) from public;
grant execute on function public.admin_list_banners(text) to service_role;
revoke all on function public.admin_list_digital_deliveries(text) from public;
grant execute on function public.admin_list_digital_deliveries(text) to service_role;
