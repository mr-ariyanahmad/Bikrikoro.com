-- Centralized public Settings/Help content controlled by the admin panel.
alter table public.admin_content drop constraint if exists admin_content_content_type_check;
alter table public.admin_content add constraint admin_content_content_type_check check (content_type in (
  'BLOG', 'ANNOUNCEMENT', 'ABOUT', 'PRIVACY', 'CONTACT', 'HELP', 'FAQ',
  'USER_EDU', 'SELLER_EDU', 'RETURN_POLICY', 'TERMS', 'SETTINGS'
));

create index if not exists idx_admin_content_public_pages on public.admin_content(content_type, status, slug);

create or replace function public.get_published_content(p_content_type text, p_slug text default null)
returns setof public.admin_content as $$
begin
  return query
  select * from public.admin_content
  where status = 'PUBLISHED'
    and content_type = p_content_type
    and (p_slug is null or slug = p_slug)
  order by updated_at desc;
end;
$$ language plpgsql security definer stable;

create or replace function public.get_public_settings(p_prefix text default 'public_')
returns table(setting_key text, setting_value jsonb) as $$
begin
  return query
  select s.setting_key, s.setting_value
  from public.admin_settings s
  where s.setting_key like coalesce(p_prefix, 'public_') || '%'
  order by s.setting_key;
end;
$$ language plpgsql security definer stable;
