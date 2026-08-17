-- Role-based admin access. The legacy admin_emails allowlist remains SUPER_ADMIN for compatibility.
create table if not exists public.admin_roles (
  role_key text primary key,
  role_label text not null,
  permissions jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_members (
  user_id text primary key references public.profiles(id) on delete cascade,
  role_key text not null references public.admin_roles(role_key),
  active boolean not null default true,
  added_by text references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;
alter table public.admin_members enable row level security;

insert into public.admin_roles(role_key, role_label, permissions, is_system) values
('SUPER_ADMIN', 'পূর্ণ অ্যাডমিন', '["*"]', true),
('OPERATIONS_MANAGER', 'অপারেশন ম্যানেজার', '["dashboard.view","sales.orders","sales.deliveries","sales.customers","sales.disputes"]', true),
('CATALOG_MANAGER', 'ক্যাটালগ ম্যানেজার', '["dashboard.view","catalog.products","catalog.categories","catalog.industries","content.gallery"]', true),
('CONTENT_MANAGER', 'কনটেন্ট ম্যানেজার', '["dashboard.view","content.gallery","content.downloads","content.blog","content.pages","content.features"]', true),
('FINANCE_MANAGER', 'ফাইন্যান্স ম্যানেজার', '["dashboard.view","sales.orders","sales.finance","settings.invoice"]', true),
('SUPPORT_AGENT', 'সাপোর্ট এজেন্ট', '["dashboard.view","sales.customers","sales.disputes","content.support","content.notifications"]', true),
('VERIFICATION_REVIEWER', 'ভেরিফিকেশন রিভিউয়ার', '["dashboard.view","content.sellers","sales.reviews"]', true)
on conflict (role_key) do update set role_label = excluded.role_label, permissions = excluded.permissions, updated_at = now();

create or replace function public.admin_access(p_user_id text)
returns table(is_admin boolean, role_key text, role_label text, permissions jsonb) as $$
begin
  return query
  select true, r.role_key, r.role_label, r.permissions
  from public.profiles p join public.admin_emails ae on lower(ae.email) = lower(p.email) join public.admin_roles r on r.role_key = 'SUPER_ADMIN'
  where p.id = p_user_id
  union all
  select true, r.role_key, r.role_label, r.permissions
  from public.admin_members m join public.admin_roles r on r.role_key = m.role_key
  where m.user_id = p_user_id and m.active = true
  limit 1;
end;
$$ language plpgsql security definer stable;

create or replace function public.is_admin(p_user_id text) returns boolean as $$
begin
  return exists (select 1 from public.admin_access(p_user_id) a where a.is_admin);
end;
$$ language plpgsql security definer stable;

create or replace function public.admin_has_permission(p_user_id text, p_permission text) returns boolean as $$
begin
  return exists (select 1 from public.admin_access(p_user_id) a where a.is_admin and (a.permissions ? '*' or a.permissions ? p_permission));
end;
$$ language plpgsql security definer stable;

create or replace function public.admin_assert_permission(p_admin_id text, p_permission text) returns void as $$
begin
  if not admin_has_permission(p_admin_id, p_permission) then raise exception 'Not authorized for permission: %', p_permission; end if;
end;
$$ language plpgsql security definer;

create or replace function public.admin_list_roles(p_admin_id text)
returns setof public.admin_roles as $$
begin
  perform admin_assert_permission(p_admin_id, 'team.manage');
  return query select * from public.admin_roles order by is_system desc, role_label;
end;
$$ language plpgsql security definer;

create or replace function public.admin_list_members(p_admin_id text)
returns table(user_id text, email text, display_name text, role_key text, role_label text, permissions jsonb, active boolean, created_at timestamptz) as $$
begin
  perform admin_assert_permission(p_admin_id, 'team.manage');
  return query select m.user_id, p.email, p.name, m.role_key, r.role_label, r.permissions, m.active, m.created_at from public.admin_members m join public.profiles p on p.id = m.user_id join public.admin_roles r on r.role_key = m.role_key order by m.created_at desc;
end;
$$ language plpgsql security definer;

create or replace function public.admin_assign_member(p_admin_id text, p_member_user_id text, p_role_key text) returns void as $$
begin
  perform admin_assert_permission(p_admin_id, 'team.manage');
  if p_member_user_id = p_admin_id then raise exception 'নিজের super access পরিবর্তন করা যাবে না'; end if;
  if not exists (select 1 from public.admin_roles where role_key = p_role_key) then raise exception 'Role not found'; end if;
  insert into public.admin_members(user_id, role_key, added_by) values (p_member_user_id, p_role_key, p_admin_id)
  on conflict (user_id) do update set role_key = excluded.role_key, active = true, added_by = excluded.added_by, updated_at = now();
end;
$$ language plpgsql security definer;

create or replace function public.admin_set_member_active(p_admin_id text, p_member_user_id text, p_active boolean) returns void as $$
begin
  perform admin_assert_permission(p_admin_id, 'team.manage');
  if p_member_user_id = p_admin_id and not p_active then raise exception 'নিজের access বন্ধ করা যাবে না'; end if;
  update public.admin_members set active = p_active, updated_at = now() where user_id = p_member_user_id;
  if not found then raise exception 'Admin member not found'; end if;
end;
$$ language plpgsql security definer;

create or replace function public.admin_upsert_role(p_admin_id text, p_role_key text, p_role_label text, p_permissions jsonb) returns void as $$
begin
  perform admin_assert_permission(p_admin_id, 'team.manage');
  if upper(trim(p_role_key)) = 'SUPER_ADMIN' then raise exception 'System super role cannot be edited'; end if;
  insert into public.admin_roles(role_key, role_label, permissions, is_system) values (upper(trim(p_role_key)), trim(p_role_label), coalesce(p_permissions, '[]'::jsonb), false)
  on conflict (role_key) do update set role_label = excluded.role_label, permissions = excluded.permissions, updated_at = now();
end;
$$ language plpgsql security definer;
