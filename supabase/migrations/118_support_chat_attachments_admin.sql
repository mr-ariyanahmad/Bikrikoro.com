begin;

alter table public.support_case_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.support_case_messages add column if not exists read_at timestamptz;

insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Support attachments can be uploaded" on storage.objects;
drop policy if exists "Support attachments can be read" on storage.objects;
create policy "Support attachments can be uploaded" on storage.objects for insert to public with check (bucket_id = 'support-attachments');
create policy "Support attachments can be read" on storage.objects for select to public using (bucket_id = 'support-attachments');

create or replace function public.create_my_support_case(p_customer_id text, p_category text, p_subject text, p_order_id uuid default null, p_initial_message text default null, p_attachments jsonb default '[]'::jsonb)
returns public.support_cases as $$
declare v_chat public.support_chats; v_case public.support_cases; v_text text;
begin
  if p_category not in ('ORDER_PRODUCT', 'PAYMENT', 'ACCOUNT_SECURITY', 'REPORT_COMPLAINT', 'OTHER') then raise exception 'Invalid support category'; end if;
  if length(trim(coalesce(p_subject, ''))) < 1 then raise exception 'Support subject is required'; end if;
  if p_order_id is not null and not exists (select 1 from public.orders o where o.id = p_order_id and o.buyer_id = p_customer_id) then raise exception 'Order is not yours'; end if;
  v_chat := public.get_or_create_support_chat(p_customer_id);
  insert into public.support_cases(support_chat_id, category, subject, order_id) values (v_chat.id, p_category, trim(p_subject), p_order_id) returning * into v_case;
  v_text := nullif(trim(coalesce(p_initial_message, '')), '');
  if v_text is not null or jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0 then
    insert into public.support_case_messages(case_id, sender_id, sender_role, text, attachments) values (v_case.id, p_customer_id, 'CUSTOMER', coalesce(v_text, ''), coalesce(p_attachments, '[]'::jsonb));
  end if;
  update public.support_chats set last_message = coalesce(v_text, 'নতুন সাপোর্ট কেস খোলা হয়েছে'), last_message_at = now() where id = v_chat.id;
  return v_case;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.send_my_support_case_message(p_customer_id text, p_case_id uuid, p_text text, p_attachments jsonb default '[]'::jsonb)
returns uuid as $$
declare v_message_id uuid; v_chat_id uuid;
begin
  if length(trim(coalesce(p_text, ''))) = 0 and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then raise exception 'Message or attachment is required'; end if;
  if length(coalesce(p_text, '')) > 5000 then raise exception 'Message must be 5000 characters or fewer'; end if;
  select c.support_chat_id into v_chat_id from public.support_cases c join public.support_chats s on s.id = c.support_chat_id where c.id = p_case_id and s.customer_id = p_customer_id and c.status in ('OPEN', 'IN_PROGRESS');
  if v_chat_id is null then raise exception 'Support case is not open'; end if;
  insert into public.support_case_messages(case_id, sender_id, sender_role, text, attachments) values (p_case_id, p_customer_id, 'CUSTOMER', coalesce(trim(p_text), ''), coalesce(p_attachments, '[]'::jsonb)) returning id into v_message_id;
  update public.support_cases set updated_at = now() where id = p_case_id;
  update public.support_chats set last_message = coalesce(nullif(trim(p_text), ''), 'ফাইল পাঠানো হয়েছে'), last_message_at = now() where id = v_chat_id;
  return v_message_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.mark_my_support_case_read(p_customer_id text, p_case_id uuid)
returns integer as $$
declare v_count integer;
begin
  update public.support_case_messages m set read_at = now() where m.case_id = p_case_id and m.sender_role = 'SUPPORT' and m.read_at is null and exists (select 1 from public.support_cases c join public.support_chats s on s.id = c.support_chat_id where c.id = p_case_id and s.customer_id = p_customer_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_list_support_cases(p_admin_id text)
returns table(id uuid, case_number bigint, customer_id text, category text, status text, order_id uuid, subject text, created_at timestamptz, updated_at timestamptz, last_message text, message_count bigint) as $$
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  return query select c.id, c.case_number, s.customer_id, c.category, c.status, c.order_id, c.subject, c.created_at, c.updated_at, coalesce((select m.text from public.support_case_messages m where m.case_id = c.id order by m.created_at desc limit 1), ''), (select count(*) from public.support_case_messages m where m.case_id = c.id) from public.support_cases c join public.support_chats s on s.id = c.support_chat_id order by c.updated_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_list_support_case_messages(p_admin_id text, p_case_id uuid)
returns setof public.support_case_messages as $$
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  return query select m.* from public.support_case_messages m where m.case_id = p_case_id order by m.created_at asc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_send_support_case_message(p_admin_id text, p_case_id uuid, p_text text, p_attachments jsonb default '[]'::jsonb)
returns uuid as $$
declare v_message_id uuid; v_customer_id text;
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then raise exception 'Message or attachment is required'; end if;
  select s.customer_id into v_customer_id from public.support_cases c join public.support_chats s on s.id = c.support_chat_id where c.id = p_case_id;
  if v_customer_id is null then raise exception 'Support case not found'; end if;
  insert into public.support_case_messages(case_id, sender_id, sender_role, text, attachments) values (p_case_id, p_admin_id, 'SUPPORT', coalesce(trim(p_text), ''), coalesce(p_attachments, '[]'::jsonb)) returning id into v_message_id;
  update public.support_cases set status = case when status = 'OPEN' then 'IN_PROGRESS' else status end, updated_at = now() where id = p_case_id;
  update public.support_case_messages set read_at = now() where case_id = p_case_id and sender_role = 'CUSTOMER' and read_at is null;
  return v_message_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_update_support_case_status(p_admin_id text, p_case_id uuid, p_status text)
returns boolean as $$
begin
  if not public.is_admin(p_admin_id) then raise exception 'Admin access required'; end if;
  if p_status not in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') then raise exception 'Invalid support status'; end if;
  update public.support_cases set status = p_status, resolved_at = case when p_status in ('RESOLVED', 'CLOSED') then now() else null end, updated_at = now() where id = p_case_id;
  return found;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.create_my_support_case(text,text,text,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.send_my_support_case_message(text,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.mark_my_support_case_read(text,uuid) from public, anon, authenticated;
revoke all on function public.admin_list_support_cases(text) from public, anon, authenticated;
revoke all on function public.admin_list_support_case_messages(text,uuid) from public, anon, authenticated;
revoke all on function public.admin_send_support_case_message(text,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.admin_update_support_case_status(text,uuid,text) from public, anon, authenticated;
grant execute on function public.create_my_support_case(text,text,text,uuid,text,jsonb) to service_role;
grant execute on function public.send_my_support_case_message(text,uuid,text,jsonb) to service_role;
grant execute on function public.mark_my_support_case_read(text,uuid) to service_role;
grant execute on function public.admin_list_support_cases(text) to service_role;
grant execute on function public.admin_list_support_case_messages(text,uuid) to service_role;
grant execute on function public.admin_send_support_case_message(text,uuid,text,jsonb) to service_role;
grant execute on function public.admin_update_support_case_status(text,uuid,text) to service_role;

commit;
