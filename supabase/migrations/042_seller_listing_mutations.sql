-- BikriKoro — owner-verified seller listing mutations
-- Seller edits go through a security-definer RPC and reset approval via the
-- existing approval trigger. Removal is a reversible archive (hidden flag),
-- preserving product/order history.

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
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid product condition';
  end if;
  if p_video_url is not null and trim(p_video_url) <> '' and p_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;

  update public.products
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      price = p_price,
      original_price = p_original_price,
      category_id = p_category_id,
      condition = p_condition,
      location = coalesce(p_location, ''),
      images = coalesce(p_images, '{}'),
      video_url = nullif(trim(coalesce(p_video_url, '')), ''),
      is_digital = coalesce(p_is_digital, false),
      supports_cod = coalesce(p_supports_cod, false),
      free_delivery = coalesce(p_free_delivery, false),
      fast_delivery = coalesce(p_fast_delivery, false),
      free_return = coalesce(p_free_return, false)
  where id = p_product_id and seller_id = p_seller_id
  returning id;

  if not found then
    raise exception 'Listing not found or not yours';
  end if;
  return p_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_archive_product(p_seller_id text, p_product_id uuid)
returns void as $$
begin
  update public.products
  set is_hidden = true
  where id = p_product_id and seller_id = p_seller_id;
  if not found then
    raise exception 'Listing not found or not yours';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_upsert_digital_content(
  p_seller_id text,
  p_product_id uuid,
  p_delivery_type text,
  p_delivery_text text
) returns void as $$
begin
  if p_delivery_type not in ('INSTRUCTIONS', 'LICENSE_KEY', 'DOWNLOAD_LINK') then
    raise exception 'Invalid digital delivery type';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and seller_id = p_seller_id and is_digital = true) then
    raise exception 'Digital listing not found or not yours';
  end if;
  insert into public.digital_product_contents (product_id, seller_id, delivery_type, delivery_text)
  values (p_product_id, p_seller_id, p_delivery_type, coalesce(trim(p_delivery_text), ''))
  on conflict (product_id) do update set
    seller_id = excluded.seller_id,
    delivery_type = excluded.delivery_type,
    delivery_text = excluded.delivery_text,
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_clear_digital_content(p_seller_id text, p_product_id uuid)
returns void as $$
begin
  delete from public.digital_product_contents
  where product_id = p_product_id and seller_id = p_seller_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
