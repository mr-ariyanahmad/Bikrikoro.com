-- Digital orders must not reach COMPLETED (and therefore seller payout)
-- through the generic physical-delivery confirmation RPC.
create or replace function public.confirm_order_delivery(
  p_order_id uuid,
  p_buyer_id text
) returns void as $$
declare
  v_order public.orders%rowtype;
  v_is_digital boolean;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found or v_order.buyer_id::text <> p_buyer_id::text then
    raise exception 'Order not found or not yours';
  end if;

  select coalesce(p.is_digital, false) into v_is_digital
  from public.products p where p.id = v_order.product_id;

  if v_is_digital then
    raise exception 'Digital orders require digital delivery confirmation';
  end if;

  if v_order.status not in ('SHIPPED', 'DELIVERED')
     or coalesce(v_order.dispute_status, '') in ('REPORTED', 'UNDER_REVIEW') then
    raise exception 'Order not delivered or has an open dispute';
  end if;

  update public.orders
  set status = 'COMPLETED',
      buyer_confirmed_at = coalesce(buyer_confirmed_at, now()),
      updated_at = now()
  where id = p_order_id and status in ('SHIPPED', 'DELIVERED');
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.confirm_order_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_order_delivery(uuid, text) to service_role;
