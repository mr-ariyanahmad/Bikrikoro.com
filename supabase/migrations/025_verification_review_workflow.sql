create or replace function public.admin_review_verification_document(p_admin_id text, p_document_id uuid, p_status text, p_admin_note text default '') returns void as $$
declare
  v_registration_id uuid;
begin
  perform admin_assert_permission(p_admin_id, 'content.sellers');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid document status'; end if;
  update public.seller_verification_documents set status = p_status, admin_note = coalesce(p_admin_note, ''), reviewed_by = p_admin_id, reviewed_at = now() where id = p_document_id returning registration_id into v_registration_id;
  if not found then raise exception 'Verification document not found'; end if;
  insert into public.seller_verification_reviews(registration_id, admin_id, action, document_type, note)
  select v_registration_id, p_admin_id, case when p_status = 'APPROVED' then 'DOCUMENT_APPROVED' else 'DOCUMENT_REJECTED' end, document_type, coalesce(p_admin_note, '') from public.seller_verification_documents where id = p_document_id;
end;
$$ language plpgsql security definer;

create or replace function public.admin_finalize_seller_verification(p_admin_id text, p_registration_id uuid, p_status text, p_admin_note text default '') returns void as $$
declare
  v_user_id text;
  v_mode text;
  v_sector text;
  v_business_type text;
  v_missing boolean;
  v_badge_key text;
  v_badge_label text;
begin
  perform admin_assert_permission(p_admin_id, 'content.sellers');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid registration status'; end if;
  select user_id, listing_mode, sector, business_type into v_user_id, v_mode, v_sector, v_business_type from public.seller_registrations where id = p_registration_id and status = 'PENDING';
  if not found then raise exception 'Registration not found or already reviewed'; end if;
  if p_status = 'APPROVED' then
    select exists (
      select 1 from public.seller_document_requirements r
      left join public.seller_verification_documents d on d.registration_id = p_registration_id and d.document_type = r.document_type
      where r.active and r.required and r.listing_mode = v_mode and r.business_type = v_business_type and r.sector in (v_sector, 'OTHER')
        and (d.id is null or d.status <> 'APPROVED')
    ) into v_missing;
    if v_missing then raise exception 'All required documents must be approved first'; end if;
  end if;
  update public.seller_registrations set status = p_status, admin_note = coalesce(p_admin_note, ''), reviewed_at = now() where id = p_registration_id;
  insert into public.seller_verification_reviews(registration_id, admin_id, action, note) values (p_registration_id, p_admin_id, p_status, coalesce(p_admin_note, ''));
  if p_status = 'APPROVED' then
    v_badge_key := lower(format('verified_%s_%s', v_mode, v_sector));
    v_badge_label := case when v_mode = 'DIGITAL' then 'ডিজিটাল ' else 'ফিজিক্যাল ' end || case when v_sector = 'OTHER' then 'সেলার' else v_sector || ' সেলার' end || ' যাচাইকৃত';
    insert into public.seller_verification_badges(user_id, badge_key, badge_label) values (v_user_id, v_badge_key, v_badge_label) on conflict (user_id, badge_key) do update set verified_at = now();
  end if;
end;
$$ language plpgsql security definer;
