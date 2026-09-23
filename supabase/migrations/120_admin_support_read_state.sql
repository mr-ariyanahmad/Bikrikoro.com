begin;
create or replace function public.admin_mark_support_case_read(p_admin_id text, p_case_id uuid)
returns integer as $$
declare v_count integer;
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  update public.support_case_messages set read_at = now() where case_id = p_case_id and sender_role = 'CUSTOMER' and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke all on function public.admin_mark_support_case_read(text,uuid) from public, anon, authenticated;
grant execute on function public.admin_mark_support_case_read(text,uuid) to service_role;
commit;
