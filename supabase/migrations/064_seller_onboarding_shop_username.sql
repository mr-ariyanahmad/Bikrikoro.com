-- Seller onboarding RPC with a unique public shop username.
-- Keeps the original v2 RPC intact for existing clients.

create or replace function public.submit_seller_registration_v3(
  p_user_id text,
  p_listing_mode text,
  p_business_type text,
  p_sector text,
  p_full_name text,
  p_phone text,
  p_nid_or_business_number text,
  p_business_name text,
  p_shop_name text,
  p_shop_username text,
  p_address text,
  p_documents jsonb
) returns uuid as $$
declare
  v_registration_id uuid;
  v_required text;
  v_has_document boolean;
  v_username_check record;
  v_shop_name text := trim(coalesce(p_shop_name, ''));
  v_shop_username text := lower(trim(coalesce(p_shop_username, '')));
begin
  if p_listing_mode <> 'DIGITAL' then raise exception 'Only digital seller onboarding is available'; end if;
  if p_business_type not in ('PERSONAL', 'BUSINESS', 'COMPANY') then raise exception 'Invalid business type'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 or length(trim(coalesce(p_address, ''))) < 5 then raise exception 'Basic identity fields are incomplete'; end if;
  if length(v_shop_name) < 2 or length(v_shop_name) > 80 then raise exception 'Shop name must be between 2 and 80 characters'; end if;
  if length(v_shop_username) < 3 or length(v_shop_username) > 40 then raise exception 'Shop username must be between 3 and 40 characters'; end if;
  if jsonb_typeof(p_documents) <> 'array' then raise exception 'Documents must be an array'; end if;
  if exists (select 1 from public.seller_registrations where user_id = p_user_id and status in ('PENDING', 'APPROVED')) then raise exception 'You already have a pending or approved registration'; end if;

  select * into v_username_check from public.check_shop_username(v_shop_username, p_user_id);
  if not coalesce(v_username_check.is_available, false) then raise exception 'Shop username is not available'; end if;

  for v_required in select r.document_type from public.get_seller_document_requirements(p_listing_mode, p_business_type, p_sector) r where r.required loop
    select exists (select 1 from jsonb_array_elements(p_documents) d where d->>'document_type' = v_required and length(trim(coalesce(d->>'document_path', ''))) > 4) into v_has_document;
    if not v_has_document then raise exception 'Missing required document: %', v_required; end if;
  end loop;

  insert into public.seller_registrations (user_id, seller_type, full_name, phone, nid_or_business_number, business_name, address, document_path, listing_mode, business_type, sector)
  values (p_user_id, case when p_business_type = 'PERSONAL' then 'INDIVIDUAL' else 'BUSINESS' end, trim(p_full_name), trim(p_phone), trim(p_nid_or_business_number), nullif(trim(coalesce(p_business_name, '')), ''), trim(p_address), coalesce(p_documents->0->>'document_path', 'MULTI_DOCUMENT'), p_listing_mode, p_business_type, upper(trim(coalesce(p_sector, 'OTHER'))))
  returning id into v_registration_id;

  insert into public.seller_verification_documents (registration_id, document_type, document_path)
  select v_registration_id, d->>'document_type', d->>'document_path' from jsonb_array_elements(p_documents) d;
  insert into public.seller_verification_reviews (registration_id, admin_id, action, note) values (v_registration_id, p_user_id, 'SUBMITTED', 'Application submitted');

  update public.profiles
  set shop_name = v_shop_name,
      shop_username = v_shop_username
  where id = p_user_id;

  return v_registration_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.submit_seller_registration_v3(text, text, text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
