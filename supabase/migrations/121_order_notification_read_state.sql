begin;
create or replace function public.mark_my_notifications_type_read(p_user_id text, p_type text)
returns integer as $$
declare v_count integer;
begin
  update public.notifications set is_read = true, read_at = coalesce(read_at, now()) where user_id = p_user_id and upper(type) = upper(trim(p_type)) and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke all on function public.mark_my_notifications_type_read(text,text) from public, anon, authenticated;
grant execute on function public.mark_my_notifications_type_read(text,text) to service_role;
commit;
