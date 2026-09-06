-- BikriKoro: admin-managed public community links.
create table if not exists public.community_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('WHATSAPP', 'FACEBOOK', 'TELEGRAM', 'OTHER')),
  title text not null,
  description text not null default '',
  url text not null,
  image_url text,
  placements text[] not null default array['HOME']::text[],
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  sort_order integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_links_http_url check (url ~* '^https?://')
);

create index if not exists idx_community_links_public on public.community_links(status, sort_order, updated_at desc);

create or replace function public.get_published_community_links(p_placement text default null)
returns setof public.community_links as $$
begin
  return query
  select c.* from public.community_links c
  where c.status = 'PUBLISHED'
    and (p_placement is null or p_placement = any(c.placements))
  order by c.sort_order asc, c.updated_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

grant execute on function public.get_published_community_links(text) to anon, authenticated;

create or replace function public.admin_list_community_links(p_admin_id text)
returns setof public.community_links as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.manage');
  return query select * from public.community_links order by sort_order asc, updated_at desc;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.admin_list_community_links(text) to authenticated;

create or replace function public.admin_upsert_community_link(
  p_admin_id text, p_id uuid, p_platform text, p_title text, p_description text,
  p_url text, p_image_url text, p_placements text[], p_status text, p_sort_order integer
) returns public.community_links as $$
declare v_row public.community_links;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.manage');
  if p_platform not in ('WHATSAPP','FACEBOOK','TELEGRAM','OTHER') then raise exception 'Invalid community platform'; end if;
  if p_status not in ('DRAFT','PUBLISHED','ARCHIVED') then raise exception 'Invalid community link status'; end if;
  if p_url !~* '^https?://' then raise exception 'Community link URL must use http or https'; end if;
  if p_id is null then
    insert into public.community_links(platform, title, description, url, image_url, placements, status, sort_order, created_by)
    values (p_platform, trim(p_title), coalesce(trim(p_description), ''), trim(p_url), nullif(trim(p_image_url), ''), coalesce(p_placements, array['HOME']::text[]), p_status, coalesce(p_sort_order, 0), p_admin_id)
    returning * into v_row;
  else
    update public.community_links set platform=p_platform, title=trim(p_title), description=coalesce(trim(p_description), ''), url=trim(p_url), image_url=nullif(trim(p_image_url), ''), placements=coalesce(p_placements, array['HOME']::text[]), status=p_status, sort_order=coalesce(p_sort_order, 0), updated_at=now() where id=p_id returning * into v_row;
  end if;
  if not found then raise exception 'Community link not found'; end if;
  return v_row;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.admin_upsert_community_link(text, uuid, text, text, text, text, text, text[], text, integer) to authenticated;

create or replace function public.admin_delete_community_link(p_admin_id text, p_id uuid)
returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.manage');
  delete from public.community_links where id = p_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.admin_delete_community_link(text, uuid) to authenticated;
