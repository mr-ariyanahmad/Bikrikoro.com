-- BikriKoro — complete seller directory and targeted seller messaging.

create or replace function public.admin_list_sellers(p_admin_id text)
returns setof jsonb as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  return query
  with seller_ids as (
    select distinct p.seller_id as user_id
    from public.products p
    where p.seller_id is not null
    union
    select p.id
    from public.profiles p
    where coalesce(p.seller_level, 'NONE') <> 'NONE'
    union
    select sr.user_id
    from public.seller_registrations sr
  ),
  latest_registrations as (
    select distinct on (sr.user_id)
      sr.id, sr.user_id, sr.status, sr.full_name, sr.business_name,
      sr.business_type, sr.listing_mode, sr.sector, sr.submitted_at, sr.reviewed_at, sr.admin_note
    from public.seller_registrations sr
    order by sr.user_id, sr.submitted_at desc nulls last
  ),
  product_stats as (
    select p.seller_id as user_id, count(*)::integer as product_count, max(p.created_at) as latest_product_at
    from public.products p
    group by p.seller_id
  )
  select jsonb_build_object(
    'user_id', p.id,
    'name', coalesce(nullif(trim(p.name), ''), lr.full_name, 'নাম দেওয়া হয়নি'),
    'email', p.email,
    'phone', p.phone,
    'is_verified', coalesce(p.is_verified, false),
    'seller_level', coalesce(p.seller_level, 'NONE'),
    'seller_email_verified_at', p.seller_email_verified_at,
    'seller_basic_completed_at', p.seller_basic_completed_at,
    'seller_basic_complete', p.seller_basic_completed_at is not null,
    'shop_name', p.shop_name,
    'shop_description', p.shop_description,
    'product_count', coalesce(ps.product_count, 0),
    'latest_product_at', ps.latest_product_at,
    'registration_id', lr.id,
    'registration_status', lr.status,
    'registration_business_type', lr.business_type,
    'registration_listing_mode', lr.listing_mode,
    'registration_sector', lr.sector,
    'registration_submitted_at', lr.submitted_at,
    'registration_reviewed_at', lr.reviewed_at,
    'registration_admin_note', lr.admin_note,
    'required_document_count', coalesce(dp.required_document_count, 0),
    'uploaded_document_count', coalesce(dp.uploaded_document_count, 0),
    'approved_document_count', coalesce(dp.approved_document_count, 0),
    'pending_document_count', coalesce(dp.pending_document_count, 0),
    'missing_documents', coalesce(dp.missing_documents, '{}'::text[]),
    'missing_items', array_cat(
      array_remove(array[
        case when nullif(trim(p.name), '') is null then 'প্রোফাইলের নাম' end,
        case when p.email is null or p.seller_email_verified_at is null then 'ইমেইল ভেরিফিকেশন' end,
        case when p.seller_basic_completed_at is null then 'Basic seller setup' end,
        case when lr.id is null then 'Seller verification আবেদন' end
      ]::text[], null),
      coalesce(dp.missing_documents, '{}'::text[])
    ),
    'seller_status', case
      when lr.status = 'PENDING' then 'VERIFICATION_PENDING'
      when lr.status = 'REJECTED' then 'VERIFICATION_REJECTED'
      when coalesce(p.seller_level, 'NONE') in ('VERIFIED', 'TRUSTED') then 'VERIFIED'
      when coalesce(p.seller_level, 'NONE') = 'BASIC' then 'BASIC'
      else 'PRODUCT_SELLER'
    end
  )
  from seller_ids s
  join public.profiles p on p.id = s.user_id
  left join latest_registrations lr on lr.user_id = p.id
  left join product_stats ps on ps.user_id = p.id
  left join lateral (
    select
      count(r.document_type)::integer as required_document_count,
      count(d.id)::integer as uploaded_document_count,
      count(d.id) filter (where d.status = 'APPROVED')::integer as approved_document_count,
      count(d.id) filter (where d.status <> 'APPROVED')::integer as pending_document_count,
      coalesce(array_agg(r.document_label order by r.sort_order) filter (where d.id is null or d.status <> 'APPROVED'), '{}'::text[]) as missing_documents
    from (
      select distinct on (r.document_type) r.document_type, r.document_label, r.sort_order
      from public.seller_document_requirements r
      where lr.id is not null
        and r.active = true
        and r.listing_mode = lr.listing_mode
        and r.business_type = lr.business_type
        and r.sector in (lr.sector, 'OTHER')
      order by r.document_type, case when r.sector = lr.sector then 0 else 1 end, r.sort_order
    ) r
    left join public.seller_verification_documents d
      on d.registration_id = lr.id and d.document_type = r.document_type
  ) dp on true
  order by greatest(coalesce(ps.latest_product_at, '-infinity'::timestamptz), coalesce(lr.submitted_at, '-infinity'::timestamptz), p.created_at) desc;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_send_seller_notification(
  p_admin_id text,
  p_user_id text,
  p_title text,
  p_body text,
  p_link text default '/seller/verification'
) returns uuid as $$
declare
  v_id uuid;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  if not exists (
    select 1 from public.products where seller_id = p_user_id
    union all
    select 1 from public.seller_registrations where user_id = p_user_id
    union all
    select 1 from public.profiles where id = p_user_id and coalesce(seller_level, 'NONE') <> 'NONE'
  ) then
    raise exception 'Seller not found';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 or length(trim(coalesce(p_body, ''))) < 3 then
    raise exception 'Notification title and body are required';
  end if;
  insert into public.notifications(user_id, title, body, link)
  values (p_user_id, trim(p_title), trim(p_body), coalesce(nullif(trim(p_link), ''), '/seller/verification'))
  returning id into v_id;
  perform public.admin_log(p_admin_id, 'SEND_SELLER_NOTIFICATION', 'PROFILE', p_user_id, jsonb_build_object('notification_id', v_id, 'title', trim(p_title)));
  return v_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.admin_list_sellers(text) from public, anon, authenticated;
grant execute on function public.admin_list_sellers(text) to service_role;
revoke all on function public.admin_send_seller_notification(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_send_seller_notification(text, text, text, text, text) to service_role;
