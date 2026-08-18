-- BikriKoro — seller eligibility and approval hardening
-- Apply after 042. Physical listings remain available to ordinary users;
-- digital listings require an approved DIGITAL seller registration at the
-- database boundary. Any substantive listing edit returns the product to
-- hidden PENDING review before it can become public again.

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
  if not exists (select 1 from public.profiles where id = p_seller_id) then
    raise exception 'Seller profile not found';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
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
  if coalesce(p_is_digital, false) and not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;

  insert into public.products (
    title, description, price, original_price, category_id, condition,
    location, images, video_url, is_digital, supports_cod, free_delivery,
    fast_delivery, free_return, seller_id
  ) values (
    trim(p_title), coalesce(p_description, ''), p_price, p_original_price,
    p_category_id, p_condition, coalesce(p_location, ''), coalesce(p_images, '{}'),
    v_video_url, coalesce(p_is_digital, false), coalesce(p_supports_cod, false),
    coalesce(p_free_delivery, false), coalesce(p_fast_delivery, false),
    coalesce(p_free_return, false), p_seller_id
  ) returning id into v_product_id;
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
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid product condition';
  end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then
    raise exception 'At least one product image is required';
  end if;
  if p_video_url is not null and trim(p_video_url) <> '' and p_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;
  if coalesce(p_is_digital, false) and not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
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
  where id = p_product_id and seller_id = p_seller_id;

  if not found then
    raise exception 'Listing not found or not yours';
  end if;
  return p_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.reset_product_approval_on_edit()
returns trigger as $$
begin
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.price is distinct from old.price
     or new.original_price is distinct from old.original_price
     or new.category_id is distinct from old.category_id
     or new.condition is distinct from old.condition
     or new.location is distinct from old.location
     or new.images is distinct from old.images
     or new.video_url is distinct from old.video_url
     or new.is_digital is distinct from old.is_digital
     or new.supports_cod is distinct from old.supports_cod
     or new.free_delivery is distinct from old.free_delivery
     or new.fast_delivery is distinct from old.fast_delivery
     or new.free_return is distinct from old.free_return then
    new.approval_status := 'PENDING';
    new.approval_note := '';
    new.approval_reviewed_by := null;
    new.approval_reviewed_email := null;
    new.approval_reviewed_at := null;
    new.is_hidden := true;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Keep server-side seller metrics consistent with the dashboard label.
create or replace function public.seller_list_products(p_seller_id text)
returns setof public.products as $$
begin
  return query
  select p.*
  from public.products p
  where p.seller_id = p_seller_id
  order by p.created_at desc;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to anon, authenticated;
revoke all on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to anon, authenticated;
comment on function public.reset_product_approval_on_edit() is 'Any material seller listing edit requires a fresh admin approval.';

-- Sensitive verification rows and files must never be readable through the
-- public anon client. The Vercel endpoints above use the service role only
-- after Firebase owner/admin authorization and issue short-lived URLs.
drop policy if exists "Users can read their verification documents" on public.seller_verification_documents;
drop policy if exists "Verification documents are publicly readable" on public.seller_verification_documents;
create policy "Verification documents are server-only" on public.seller_verification_documents
for select using (false);

drop policy if exists "Verification documents are readable for signed-URL generation" on storage.objects;
drop policy if exists "Verification documents are server-only" on storage.objects;
create policy "Verification documents are server-only" on storage.objects
for select using (false);

-- Applicant identity, phone, address, and document paths are server-only.
drop policy if exists "Users can read their own registration, admins read all" on public.seller_registrations;
drop policy if exists "Users can read their own registration" on public.seller_registrations;
create policy "Seller registrations are server-only" on public.seller_registrations
for select using (false);

create or replace function public.admin_count_pending_seller_verifications(p_admin_id text)
returns bigint as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'dashboard.view');
  return (select count(*) from public.seller_registrations where status = 'PENDING');
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
