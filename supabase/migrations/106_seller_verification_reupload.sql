alter table public.seller_verification_documents drop constraint if exists seller_verification_documents_status_check;
alter table public.seller_verification_documents add constraint seller_verification_documents_status_check check (status in ('PENDING', 'APPROVED', 'REJECTED', 'REUPLOAD_REQUIRED'));

drop function if exists public.admin_review_verification_document(text, uuid, text, text);
create or replace function public.admin_review_verification_document(p_admin_id text, p_document_id uuid, p_status text, p_admin_note text default '') returns void as $$
declare v_registration_id uuid; v_user_id text; v_document_type text; v_title text; v_body text;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  if p_status not in ('APPROVED', 'REJECTED', 'REUPLOAD_REQUIRED') then raise exception 'Invalid document status'; end if;
  select d.registration_id, r.user_id, d.document_type into v_registration_id, v_user_id, v_document_type from public.seller_verification_documents d join public.seller_registrations r on r.id=d.registration_id where d.id=p_document_id;
  if not found then raise exception 'Verification document not found'; end if;
  update public.seller_verification_documents set status=p_status, admin_note=coalesce(p_admin_note,''), reviewed_by=p_admin_id, reviewed_at=now() where id=p_document_id;
  insert into public.seller_verification_reviews(registration_id, admin_id, action, document_type, note) values (v_registration_id, p_admin_id, case when p_status='APPROVED' then 'DOCUMENT_APPROVED' when p_status='REUPLOAD_REQUIRED' then 'REQUESTED_CHANGES' else 'DOCUMENT_REJECTED' end, v_document_type, coalesce(p_admin_note,''));
  v_title := case when p_status='APPROVED' then 'Verification document approved' when p_status='REUPLOAD_REQUIRED' then 'Document re-upload required' else 'Verification document rejected' end;
  v_body := format('%s document-এর status আপডেট হয়েছে। %s', v_document_type, coalesce(p_admin_note,''));
  insert into public.notifications(user_id, type, title, body, link) values (v_user_id, 'SYSTEM', v_title, v_body, '/become-seller/verify');
end;
$$ language plpgsql security definer set search_path=public,pg_temp;
revoke all on function public.admin_review_verification_document(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_verification_document(text, uuid, text, text) to service_role;
