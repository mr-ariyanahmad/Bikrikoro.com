-- BikriKoro — migration 082: repair and backfill automatic delivery
-- =====================================================================
-- Migration 081 correctly made delivery flag-aware. This follow-up also
-- promotes any already-READY delivery that was created by the old helper while
-- its order is still ESCROW_HELD, then retries outstanding auto-enabled orders.
-- Secret delivery values remain in private digital_deliveries only.
-- =====================================================================

create or replace function public.ensure_digital_delivery(
  p_order_id uuid,
  p_force boolean
) returns public.digital_deliveries as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_content public.digital_product_contents%rowtype;
  v_key public.digital_license_inventory%rowtype;
  v_delivery public.digital_deliveries%rowtype;
  v_type text := 'INSTRUCTIONS';
  v_text text := '';
  v_ready boolean := false;
  v_auto_enabled boolean := true;
  v_should_deliver boolean := false;
  v_has_content boolean := false;
  v_existing_delivery boolean := false;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED', 'COMPLETED') then
    raise exception 'Digital delivery is not available in current order state';
  end if;

  select * into v_product
  from public.products
  where id = v_order.product_id;
  if not found or coalesce(v_product.is_digital, false) is not true then
    raise exception 'Only digital products can be delivered automatically';
  end if;

  select coalesce(s.auto_delivery_enabled, true)
    into v_auto_enabled
  from public.product_digital_specs s
  where s.product_id = v_order.product_id;
  if not found then
    v_auto_enabled := true;
  end if;
  v_should_deliver := coalesce(p_force, false) or v_auto_enabled;

  select * into v_delivery
  from public.digital_deliveries
  where order_id = v_order.id
  for update;
  v_existing_delivery := found;

  if v_existing_delivery and v_delivery.status in ('READY', 'REVOKED') then
    -- An earlier helper could have created READY before the order promotion
    -- completed. Reconcile that state exactly once without rereading secrets.
    if v_delivery.status = 'READY' and v_order.status = 'ESCROW_HELD' then
      update public.orders
      set status = 'DIGITAL_DELIVERED',
          digital_delivered_at = coalesce(digital_delivered_at, now()),
          updated_at = now()
      where id = v_order.id
        and status = 'ESCROW_HELD';
    end if;
    return v_delivery;
  end if;

  select * into v_content
  from public.digital_product_contents
  where product_id = v_order.product_id;
  v_has_content := found;
  if v_has_content then
    v_type := coalesce(nullif(v_content.delivery_type, ''), 'INSTRUCTIONS');
  end if;

  if not v_should_deliver then
    if not v_existing_delivery then
      insert into public.digital_deliveries(
        order_id, product_id, buyer_id, seller_id, delivery_type,
        delivery_text, status, delivered_at, updated_at
      ) values (
        v_order.id, v_order.product_id, v_order.buyer_id, v_order.seller_id,
        v_type, '', 'PENDING', null, now()
      ) returning * into v_delivery;
    else
      update public.digital_deliveries
      set delivery_type = case
            when public.digital_deliveries.status = 'PENDING' then v_type
            else public.digital_deliveries.delivery_type
          end,
          updated_at = now()
      where order_id = v_order.id
      returning * into v_delivery;
    end if;
    return v_delivery;
  end if;

  if v_has_content then
    if v_content.delivery_type = 'LICENSE_KEY' then
      select * into v_key
      from public.digital_license_inventory
      where product_id = v_order.product_id
        and seller_id::text = v_order.seller_id::text
        and status = 'AVAILABLE'
      order by created_at, id
      for update skip locked
      limit 1;

      if found then
        update public.digital_license_inventory
        set status = 'CLAIMED',
            order_id = v_order.id,
            claimed_at = now()
        where id = v_key.id;
        v_text := v_key.secret_text;
        v_ready := true;
      end if;
    else
      v_text := coalesce(v_content.delivery_text, '');
      v_ready := v_text <> '';
    end if;
  end if;

  insert into public.digital_deliveries(
    order_id, product_id, buyer_id, seller_id, delivery_type,
    delivery_text, status, delivered_at, updated_at
  ) values (
    v_order.id, v_order.product_id, v_order.buyer_id, v_order.seller_id,
    v_type, v_text, case when v_ready then 'READY' else 'PENDING' end,
    case when v_ready then now() else null end, now()
  )
  on conflict (order_id) do update set
    delivery_type = case
      when public.digital_deliveries.status = 'PENDING' then excluded.delivery_type
      else public.digital_deliveries.delivery_type
    end,
    delivery_text = case
      when public.digital_deliveries.status = 'PENDING' then excluded.delivery_text
      else public.digital_deliveries.delivery_text
    end,
    status = case
      when public.digital_deliveries.status = 'PENDING' and excluded.status = 'READY' then 'READY'
      else public.digital_deliveries.status
    end,
    delivered_at = coalesce(public.digital_deliveries.delivered_at, excluded.delivered_at),
    updated_at = now()
  returning * into v_delivery;

  if v_delivery.status = 'READY'
     and v_order.status = 'ESCROW_HELD'
  then
    update public.orders
    set status = 'DIGITAL_DELIVERED',
        digital_delivered_at = coalesce(digital_delivered_at, now()),
        updated_at = now()
    where id = v_order.id
      and status = 'ESCROW_HELD';
  end if;

  return v_delivery;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- One-argument historical callers continue to mean automatic mode.
create or replace function public.ensure_digital_delivery(p_order_id uuid)
returns public.digital_deliveries as $$
begin
  return public.ensure_digital_delivery(p_order_id, false);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.ensure_digital_delivery(uuid) from public, anon, authenticated;
revoke all on function public.ensure_digital_delivery(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ensure_digital_delivery(uuid) to service_role;
grant execute on function public.ensure_digital_delivery(uuid, boolean) to service_role;

-- Retry paid digital orders after the repaired helper is installed. The
-- product option defaults to automatic for legacy listings without a row.
do $$
declare
  v_order public.orders%rowtype;
begin
  for v_order in
    select o.*
    from public.orders o
    join public.products p on p.id = o.product_id and p.is_digital = true
    left join public.product_digital_specs s on s.product_id = o.product_id
    where o.status = 'ESCROW_HELD'
      and coalesce(s.auto_delivery_enabled, true) = true
    order by o.created_at, o.id
  loop
    perform public.ensure_digital_delivery(v_order.id, false);
  end loop;
end;
$$;

select '082 automatic delivery repair and backfill applied' as result;
