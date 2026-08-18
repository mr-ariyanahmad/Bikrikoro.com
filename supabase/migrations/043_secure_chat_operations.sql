-- BikriKoro — Firebase-UID-scoped chat operations
-- The website uses Firebase UIDs rather than Supabase Auth UIDs, so chat
-- access is enforced inside security-definer RPCs instead of permissive RLS.

create or replace function public.find_or_create_chat_thread(
  p_buyer_id text,
  p_seller_id text,
  p_product_id uuid default null
) returns uuid as $$
declare
  v_thread_id uuid;
begin
  if nullif(trim(p_buyer_id), '') is null or nullif(trim(p_seller_id), '') is null or p_buyer_id = p_seller_id then
    raise exception 'Invalid chat participants';
  end if;

  select id into v_thread_id
  from public.chat_threads
  where buyer_id = p_buyer_id and seller_id = p_seller_id
  limit 1;

  if v_thread_id is not null then
    if p_product_id is not null then
      update public.chat_threads
      set product_id = coalesce(product_id, p_product_id)
      where id = v_thread_id;
    end if;
    return v_thread_id;
  end if;

  insert into public.chat_threads (buyer_id, seller_id, product_id)
  values (p_buyer_id, p_seller_id, p_product_id)
  on conflict (buyer_id, seller_id) do update
    set product_id = coalesce(public.chat_threads.product_id, excluded.product_id)
  returning id into v_thread_id;

  return v_thread_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.list_my_chat_threads(p_user_id text)
returns setof public.chat_threads as $$
begin
  return query
  select t.*
  from public.chat_threads t
  where t.buyer_id = p_user_id or t.seller_id = p_user_id
  order by t.last_message_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.get_my_chat_thread(p_user_id text, p_thread_id uuid)
returns public.chat_threads as $$
declare
  v_thread public.chat_threads;
begin
  select t.* into v_thread
  from public.chat_threads t
  where t.id = p_thread_id and (t.buyer_id = p_user_id or t.seller_id = p_user_id);
  if not found then raise exception 'Chat thread not found or not yours'; end if;
  return v_thread;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.list_my_chat_messages(p_user_id text, p_thread_id uuid)
returns setof public.chat_messages as $$
begin
  if not exists (select 1 from public.chat_threads where id = p_thread_id and (buyer_id = p_user_id or seller_id = p_user_id)) then
    raise exception 'Chat thread not found or not yours';
  end if;
  return query
  select m.* from public.chat_messages m
  where m.thread_id = p_thread_id
  order by m.created_at asc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

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
    update public.chat_threads set buyer_unread_count = 0 where id = p_thread_id;
  else
    update public.chat_threads set seller_unread_count = 0 where id = p_thread_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.send_chat_message(
  p_sender_id text,
  p_thread_id uuid,
  p_text text
) returns uuid as $$
declare
  v_message_id uuid;
  v_buyer_id text;
  v_seller_id text;
begin
  if length(trim(coalesce(p_text, ''))) < 1 or length(trim(p_text)) > 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;

  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.chat_threads
  where id = p_thread_id and (buyer_id = p_sender_id or seller_id = p_sender_id)
  for update;
  if not found then raise exception 'Chat thread not found or not yours'; end if;

  insert into public.chat_messages (thread_id, sender_id, text)
  values (p_thread_id, p_sender_id, trim(p_text))
  returning id into v_message_id;

  update public.chat_threads
  set last_message = trim(p_text),
      last_message_at = now(),
      buyer_unread_count = case when v_buyer_id = p_sender_id then buyer_unread_count else buyer_unread_count + 1 end,
      seller_unread_count = case when v_seller_id = p_sender_id then seller_unread_count else seller_unread_count + 1 end
  where id = p_thread_id;

  return v_message_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
