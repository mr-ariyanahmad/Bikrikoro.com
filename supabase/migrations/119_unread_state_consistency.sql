begin;

create or replace function public.count_my_support_unread(p_customer_id text)
returns bigint as $$
begin
  return (select count(*) from public.support_case_messages m join public.support_cases c on c.id = m.case_id join public.support_chats s on s.id = c.support_chat_id where s.customer_id = p_customer_id and m.sender_role = 'SUPPORT' and m.read_at is null);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.mark_my_support_cases_read(p_customer_id text)
returns integer as $$
declare v_count integer;
begin
  update public.support_case_messages m set read_at = now() where m.sender_role = 'SUPPORT' and m.read_at is null and exists (select 1 from public.support_cases c join public.support_chats s on s.id = c.support_chat_id where c.id = m.case_id and s.customer_id = p_customer_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_count_support_unread(p_admin_id text)
returns bigint as $$
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  return (select count(*) from public.support_case_messages where sender_role = 'CUSTOMER' and read_at is null);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.count_my_support_unread(text) from public, anon, authenticated;
revoke all on function public.mark_my_support_cases_read(text) from public, anon, authenticated;
revoke all on function public.admin_count_support_unread(text) from public, anon, authenticated;
grant execute on function public.count_my_support_unread(text) to service_role;
grant execute on function public.mark_my_support_cases_read(text) to service_role;
grant execute on function public.admin_count_support_unread(text) to service_role;

commit;
