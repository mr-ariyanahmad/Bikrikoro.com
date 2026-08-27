-- Defensively return a single canonical conversation per buyer/seller pair.
-- The table already has a unique buyer/seller constraint; DISTINCT ON also
-- prevents any legacy duplicate rows from rendering as separate chats.
create or replace function public.list_my_chat_threads(p_user_id text)
returns setof public.chat_threads as $$
begin
  return query
  select distinct on (t.buyer_id, t.seller_id) t.*
  from public.chat_threads t
  where t.buyer_id = p_user_id or t.seller_id = p_user_id
  order by t.buyer_id, t.seller_id, t.last_message_at desc, t.created_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.list_my_chat_threads(text) from public, anon, authenticated;
grant execute on function public.list_my_chat_threads(text) to service_role;
