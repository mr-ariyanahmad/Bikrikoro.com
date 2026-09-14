create or replace function public.admin_bulk_product_action(p_admin_id text, p_product_ids uuid[], p_action text, p_admin_note text default '') returns integer as $$
declare v_count integer;
begin
  perform public.admin_assert(p_admin_id);
  if coalesce(array_length(p_product_ids, 1), 0) = 0 then raise exception 'No products selected'; end if;
  if p_action = 'APPROVE' then
    update public.products set approval_status = 'APPROVED', approval_note = coalesce(p_admin_note, ''), approval_reviewed_by = p_admin_id, approval_reviewed_at = now(), is_hidden = false where id = any(p_product_ids) and is_digital = true;
  elsif p_action = 'REJECT' then
    update public.products set approval_status = 'REJECTED', approval_note = coalesce(p_admin_note, ''), approval_reviewed_by = p_admin_id, approval_reviewed_at = now(), is_hidden = true where id = any(p_product_ids) and is_digital = true;
  elsif p_action = 'HIDE' then
    update public.products set is_hidden = true, moderation_note = 'HIDE' where id = any(p_product_ids);
  elsif p_action = 'RESTORE' then
    update public.products set is_hidden = false, moderation_note = '' where id = any(p_product_ids);
  elsif p_action = 'DELETE' then
    update public.products set is_hidden = true, moderation_note = 'DELETE', archived_at = coalesce(archived_at, now()) where id = any(p_product_ids);
  else
    raise exception 'Invalid bulk product action';
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke all on function public.admin_bulk_product_action(text, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.admin_bulk_product_action(text, uuid[], text, text) to service_role;
