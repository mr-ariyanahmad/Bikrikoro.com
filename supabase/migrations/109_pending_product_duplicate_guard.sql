-- BikriKoro — prevent repeated pending submissions of the same product.
-- A transaction advisory lock makes the check safe when the same seller submits
-- the same title and description from multiple tabs at the same time.

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
  v_title_key text := regexp_replace(lower(trim(coalesce(p_title, ''))), '\s+', ' ', 'g');
  v_description_key text := regexp_replace(lower(trim(coalesce(p_description, ''))), '\s+', ' ', 'g');
  v_video_url text := nullif(trim(coalesce(p_video_url, '')), '');
  v_duplicate_lock_key text;
begin
  if not exists (select 1 from public.profiles where id = p_seller_id) then
    raise exception 'Seller profile not found';
  end if;
  if not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;
  if coalesce(p_is_digital, false) is not true then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: physical listings are disabled';
  end if;
  if coalesce(v_title_key, '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid product condition';
  end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then
    raise exception 'At least one product image is required';
  end if;
  if v_video_url is not null and v_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;

  v_duplicate_lock_key := p_seller_id || E'\x1f' || v_title_key || E'\x1f' || v_description_key;
  perform pg_advisory_xact_lock(hashtextextended(v_duplicate_lock_key, 0));

  if exists (
    select 1
    from public.products
    where seller_id = p_seller_id
      and is_digital = true
      and approval_status = 'PENDING'
      and archived_at is null
      and regexp_replace(lower(trim(coalesce(title, ''))), '\s+', ' ', 'g') = v_title_key
      and regexp_replace(lower(trim(coalesce(description, ''))), '\s+', ' ', 'g') = v_description_key
  ) then
    raise exception 'DUPLICATE_PENDING_PRODUCT';
  end if;

  insert into public.products (
    title, description, price, original_price, category_id, condition,
    location, images, video_url, is_digital, supports_cod, free_delivery,
    fast_delivery, free_return, seller_id
  ) values (
    trim(p_title), coalesce(p_description, ''), p_price, p_original_price,
    p_category_id, p_condition, '', coalesce(p_images, '{}'), v_video_url,
    true, false, false, false, false, p_seller_id
  ) returning id into v_product_id;

  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to service_role;
