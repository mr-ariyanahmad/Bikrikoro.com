-- BikriKoro — product video support
-- Optional YouTube URL stored with the product. Existing rows remain unchanged.

alter table public.products
  add column if not exists video_url text;

alter table public.products drop constraint if exists products_video_url_youtube_check;
alter table public.products
  add constraint products_video_url_youtube_check
  check (
    video_url is null
    or video_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'
  );

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
begin
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if v_video_url is not null and v_video_url !~* '^https?://(www\.)?(youtube\.com|youtu\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;

  insert into public.products (
    title, description, price, original_price, category_id, condition,
    location, images, video_url, is_digital, supports_cod, free_delivery, fast_delivery,
    free_return, seller_id
  ) values (
    trim(p_title), coalesce(p_description, ''), p_price, p_original_price,
    p_category_id, p_condition, coalesce(p_location, ''), coalesce(p_images, '{}'),
    v_video_url, coalesce(p_is_digital, false), coalesce(p_supports_cod, false),
    coalesce(p_free_delivery, false), coalesce(p_fast_delivery, false),
    coalesce(p_free_return, false), p_seller_id
  ) returning id into v_product_id;
  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public;
