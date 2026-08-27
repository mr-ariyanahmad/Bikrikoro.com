-- Store only per-participant read timestamps. Message content and reader identity
-- remain protected by the authenticated chat gateway.
alter table public.chat_threads
  add column if not exists buyer_last_read_at timestamptz,
  add column if not exists seller_last_read_at timestamptz;

create or replace function public.mark_my_chat_thread_read(p_user_id text, p_thread_id uuid)
returns void as $$
declare
  v_buyer_id text;
  v_seller_id text;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.chat_threads
  where id = p_thread_id and (buyer_id = p_user_id or seller_id = p_user_id);
  if not found then raise exception 'Chat thread not found or not yours'; end if;

  if v_buyer_id = p_user_id then
    update public.chat_threads
    set buyer_unread_count = 0, buyer_last_read_at = now()
    where id = p_thread_id;
  else
    update public.chat_threads
    set seller_unread_count = 0, seller_last_read_at = now()
    where id = p_thread_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.mark_my_chat_thread_read(text, uuid) from public, anon, authenticated;
grant execute on function public.mark_my_chat_thread_read(text, uuid) to service_role;
