-- Restore RPCs required by server/api/order-read.ts.
-- These were marked applied in production but were absent from pg_proc.

create or replace function public.buyer_list_orders(p_user_id text)
returns setof public.orders as $$
begin
  return query
  select o.*
  from public.orders o
  where o.buyer_id::text = p_user_id::text
     or o.seller_id::text = p_user_id::text
  order by o.created_at desc;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.buyer_list_orders(text) from public;
grant execute on function public.buyer_list_orders(text) to anon, authenticated, service_role;

create or replace function public.buyer_list_digital_deliveries(
  p_buyer_id text,
  p_order_ids uuid[]
)
returns table(
  order_id uuid,
  delivery_type text,
  delivery_text text,
  status text,
  delivered_at timestamptz,
  updated_at timestamptz
) as $$
declare
  v_key text;
begin
  v_key := public.delivery_crypto_key();
  return query
  select
    d.order_id,
    d.delivery_type,
    coalesce(extensions.pgp_sym_decrypt(decode(d.delivery_ciphertext, 'base64'), v_key), d.delivery_text, ''),
    d.status,
    d.delivered_at,
    d.updated_at
  from public.digital_deliveries d
  join public.orders o on o.id = d.order_id
  where o.buyer_id::text = p_buyer_id::text
    and d.order_id = any(coalesce(p_order_ids, '{}'::uuid[]));
end;
$$ language plpgsql security definer stable set search_path = public, extensions, pg_temp;

revoke all on function public.buyer_list_digital_deliveries(text, uuid[]) from public;
grant execute on function public.buyer_list_digital_deliveries(text, uuid[]) to anon, authenticated, service_role;

commit;

