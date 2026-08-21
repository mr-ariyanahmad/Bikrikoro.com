-- Unique public shop usernames, seller cover photos, and live public shop statistics.
-- Existing sellers receive an editable deterministic handle; new sellers can choose a handle.

alter table public.profiles
  add column if not exists shop_username text,
  add column if not exists shop_cover_url text;

comment on column public.profiles.shop_username is 'Unique lowercase public shop handle used in /seller/:shop_username';
comment on column public.profiles.shop_cover_url is 'Seller-managed public cover image URL';

update public.profiles
set shop_username = 'shop-' || lower(substr(regexp_replace(id, '[^a-zA-Z0-9]', '', 'g'), 1, 30))
where nullif(trim(shop_username), '') is null;

alter table public.profiles
  drop constraint if exists profiles_shop_username_format_check;

alter table public.profiles
  add constraint profiles_shop_username_format_check
  check (shop_username is null or shop_username ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$');

create unique index if not exists profiles_shop_username_lower_unique
  on public.profiles (lower(shop_username))
  where shop_username is not null;

create index if not exists idx_profiles_shop_username on public.profiles(shop_username);

create or replace function public.check_shop_username(
  p_username text,
  p_user_id text default null
)
returns table(is_available boolean, normalized_username text, suggestions text[])
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_available boolean;
  v_base text;
  v_suggestions text[];
begin
  v_available := v_username ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'
    and not exists (
      select 1
      from public.profiles p
      where lower(p.shop_username) = v_username
        and (p_user_id is null or p.id <> p_user_id)
    );

  v_base := regexp_replace(v_username, '-+', '-', 'g');
  if v_base = '' then v_base := 'shop'; end if;
  v_base := left(trim(both '-' from v_base), 30);
  if v_base = '' then v_base := 'shop'; end if;

  v_suggestions := array[
    left(v_base, 35) || '-shop',
    left(v_base, 35) || '-bd',
    left(v_base, 30) || '-' || substr(md5(v_base), 1, 6)
  ];

  return query
  select v_available, v_username, array(
    select candidate
    from unnest(v_suggestions) as candidate
    where candidate ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'
      and not exists (select 1 from public.profiles p where lower(p.shop_username) = candidate)
    limit 3
  );
end;
$$;

grant execute on function public.check_shop_username(text, text) to anon, authenticated;

create or replace function public.get_public_seller_profile(p_lookup text)
returns table(
  id text,
  name text,
  photo_url text,
  shop_name text,
  shop_description text,
  shop_username text,
  shop_cover_url text,
  is_verified boolean,
  rating numeric,
  review_count integer,
  created_at timestamptz,
  follower_count integer,
  product_count integer,
  total_views bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.photo_url,
    p.shop_name,
    p.shop_description,
    p.shop_username,
    p.shop_cover_url,
    p.is_verified,
    p.rating,
    p.review_count,
    p.created_at,
    (select count(*)::integer from public.seller_follows sf where sf.seller_id = p.id) as follower_count,
    (select count(*)::integer from public.products pr where pr.seller_id = p.id and pr.is_digital = true and pr.is_hidden = false and pr.approval_status = 'APPROVED') as product_count,
    (select coalesce(sum(pr.view_count), 0)::bigint from public.products pr where pr.seller_id = p.id and pr.is_digital = true and pr.is_hidden = false and pr.approval_status = 'APPROVED') as total_views
  from public.profiles p
  where p.is_blocked = false
    and (p.id = trim(coalesce(p_lookup, '')) or lower(p.shop_username) = lower(trim(coalesce(p_lookup, ''))))
  limit 1;
$$;

grant execute on function public.get_public_seller_profile(text) to anon, authenticated;
