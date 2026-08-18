-- BikriKoro — deterministic Super Admin resolution
-- Legacy admin_emails are the root Super Admin allowlist. If an allowlisted
-- user also has an admin_members row, the allowlist must take precedence.
-- This prevents a restricted member role from randomly winning the old
-- UNION ALL ... LIMIT 1 query and blocking valid admin RPCs.

create or replace function public.admin_access(p_user_id text)
returns table(is_admin boolean, role_key text, role_label text, permissions jsonb) as $$
begin
  if exists (
    select 1
    from public.profiles p
    join public.admin_emails ae on lower(ae.email) = lower(p.email)
    where p.id = p_user_id
  ) then
    return query
    select true, 'SUPER_ADMIN'::text, 'পূর্ণ অ্যাডমিন'::text, '["*"]'::jsonb;
    return;
  end if;

  return query
  select true, r.role_key, r.role_label, r.permissions
  from public.admin_members m
  join public.admin_roles r on r.role_key = m.role_key
  where m.user_id = p_user_id
    and m.active = true
  order by case when r.role_key = 'SUPER_ADMIN' then 0 else 1 end, m.updated_at desc
  limit 1;
end;
$$ language plpgsql security definer stable set search_path = public;

create or replace function public.is_admin(p_user_id text)
returns boolean as $$
begin
  return exists (select 1 from public.admin_access(p_user_id) a where a.is_admin);
end;
$$ language plpgsql security definer stable set search_path = public;

create or replace function public.admin_has_permission(p_user_id text, p_permission text)
returns boolean as $$
begin
  return exists (
    select 1
    from public.admin_access(p_user_id) a
    where a.is_admin
      and (a.permissions ? '*' or a.permissions ? p_permission)
  );
end;
$$ language plpgsql security definer stable set search_path = public;

create or replace function public.admin_assert_permission(p_admin_id text, p_permission text)
returns void as $$
begin
  if not public.admin_has_permission(p_admin_id, p_permission) then
    raise exception 'Not authorized for permission: %', p_permission;
  end if;
end;
$$ language plpgsql security definer set search_path = public;
