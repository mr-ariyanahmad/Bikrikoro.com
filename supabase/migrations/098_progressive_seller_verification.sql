-- Progressive seller verification: basic sellers may start selling after
-- email verification; existing identity fields and registrations remain intact.
alter table public.profiles
  add column if not exists seller_level text not null default 'NONE'
    check (seller_level in ('NONE', 'BASIC', 'VERIFIED', 'TRUSTED')),
  add column if not exists seller_basic_completed_at timestamptz,
  add column if not exists seller_email_verified_at timestamptz,
  add column if not exists seller_trusted_at timestamptz;

create index if not exists idx_profiles_seller_level on public.profiles(seller_level);

create or replace function public.start_basic_seller(
  p_user_id text,
  p_name text,
  p_shop_name text default null,
  p_shop_description text default null
) returns public.profiles as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Name is required'; end if;
  if v_profile.seller_email_verified_at is null then raise exception 'Email verification is required before selling'; end if;

  update public.profiles
  set name = trim(p_name),
      shop_name = nullif(trim(coalesce(p_shop_name, '')), ''),
      shop_description = nullif(trim(coalesce(p_shop_description, '')), ''),
      seller_level = case when seller_level in ('VERIFIED', 'TRUSTED') then seller_level else 'BASIC' end,
      seller_basic_completed_at = coalesce(seller_basic_completed_at, now()),
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;
  return v_profile;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_create_product(
  p_seller_id text,
  p_title text,
  p_description text,
  p_price numeric,
  p_original_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[],
  p_is_digital boolean,
  p_supports_cod boolean default false,
  p_free_delivery boolean default false,
  p_fast_delivery boolean default false,
  p_free_return boolean default false,
  p_video_url text default null
) returns uuid as $$
declare
  v_product_id uuid;
  v_video_url text := nullif(trim(coalesce(p_video_url, '')), '');
  v_seller_level text;
  v_email_verified_at timestamptz;
begin
  if not exists (select 1 from public.profiles where id = p_seller_id) then raise exception 'Seller profile not found'; end if;
  select seller_level, seller_email_verified_at into v_seller_level, v_email_verified_at from public.profiles where id = p_seller_id;
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then raise exception 'Invalid listing values'; end if;
  if p_condition not in ('NEW', 'USED') then raise exception 'Invalid product condition'; end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then raise exception 'At least one product image is required'; end if;
  if v_video_url is not null and v_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then raise exception 'Only YouTube video URLs are supported'; end if;
  if coalesce(p_is_digital, false) and (v_seller_level not in ('BASIC', 'VERIFIED', 'TRUSTED') or v_email_verified_at is null) then
    raise exception 'Email verification and basic seller setup are required before publishing';
  end if;
  insert into public.products (title, description, price, original_price, category_id, condition, location, images, video_url, is_digital, supports_cod, free_delivery, fast_delivery, free_return, seller_id)
  values (trim(p_title), coalesce(p_description, ''), p_price, p_original_price, p_category_id, p_condition, coalesce(p_location, ''), coalesce(p_images, '{}'), v_video_url, coalesce(p_is_digital, false), coalesce(p_supports_cod, false), coalesce(p_free_delivery, false), coalesce(p_fast_delivery, false), coalesce(p_free_return, false), p_seller_id)
  returning id into v_product_id;
  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_update_product(
  p_seller_id text,
  p_product_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_original_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[],
  p_is_digital boolean,
  p_supports_cod boolean default false,
  p_free_delivery boolean default false,
  p_fast_delivery boolean default false,
  p_free_return boolean default false,
  p_video_url text default null
) returns uuid as $$
begin
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then raise exception 'Invalid listing values'; end if;
  if p_condition not in ('NEW', 'USED') then raise exception 'Invalid product condition'; end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then raise exception 'At least one product image is required'; end if;
  if coalesce(p_is_digital, false) and not exists (select 1 from public.profiles where id = p_seller_id and seller_level in ('BASIC', 'VERIFIED', 'TRUSTED') and seller_email_verified_at is not null) then
    raise exception 'Email verification and basic seller setup are required before publishing';
  end if;
  update public.products set title = trim(p_title), description = coalesce(p_description, ''), price = p_price, original_price = p_original_price, category_id = p_category_id, condition = p_condition, location = coalesce(p_location, ''), images = coalesce(p_images, '{}'), video_url = nullif(trim(coalesce(p_video_url, '')), ''), is_digital = coalesce(p_is_digital, false), supports_cod = coalesce(p_supports_cod, false), free_delivery = coalesce(p_free_delivery, false), fast_delivery = coalesce(p_fast_delivery, false), free_return = coalesce(p_free_return, false)
  where id = p_product_id and seller_id = p_seller_id;
  if not found then raise exception 'Listing not found or not yours'; end if;
  return p_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.start_basic_seller(text, text, text, text) from public, anon, authenticated;
grant execute on function public.start_basic_seller(text, text, text, text) to service_role;

revoke all on function public.seller_create_product(text,text,text,numeric,numeric,text,text,text,text[],boolean,boolean,boolean,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.seller_create_product(text,text,text,numeric,numeric,text,text,text,text[],boolean,boolean,boolean,boolean,boolean,text) to service_role;
revoke all on function public.seller_update_product(text,uuid,text,text,numeric,numeric,text,text,text,text[],boolean,boolean,boolean,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.seller_update_product(text,uuid,text,text,numeric,numeric,text,text,text[],boolean,boolean,boolean,boolean,boolean,text) to service_role;
