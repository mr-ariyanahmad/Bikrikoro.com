-- Coupon deletion is implemented as a soft delete so redemption history remains intact.
create or replace function public.admin_delete_coupon(p_admin_id text, p_code text)
returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.coupons');
  update public.coupons
  set active = false
  where code = upper(trim(p_code));
  if not found then raise exception 'Coupon not found'; end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_count_admins(p_admin_id text)
returns integer as $$
declare
  v_count integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'team.manage');
  select count(*)::integer into v_count
  from (
    select distinct p.id
    from public.profiles p
    join public.admin_emails ae on lower(ae.email) = lower(p.email)
    union
    select distinct m.user_id
    from public.admin_members m
    where m.active = true
  ) admins;
  return coalesce(v_count, 0);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.admin_delete_coupon(text, text) from public;
grant execute on function public.admin_delete_coupon(text, text) to service_role;
revoke all on function public.admin_count_admins(text) from public;
grant execute on function public.admin_count_admins(text) to service_role;
