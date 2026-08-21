-- 073_admin_health_status.sql
-- Return a tracked schema marker so the admin status page does not claim
-- that only old 013/014 migrations determine system readiness.

create or replace function public.admin_get_system_status(p_admin_id text)
returns jsonb as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'settings.system');
  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'products', (select count(*) from public.products),
    'orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'PENDING_PAYMENT'),
    'schema_marker', '073_admin_health_status',
    'updated_at', now()
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.admin_get_system_status(text) from public, anon, authenticated;
grant execute on function public.admin_get_system_status(text) to service_role;
