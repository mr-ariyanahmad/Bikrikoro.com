-- BikriKoro — migration 081: flag-aware automatic digital delivery
-- =====================================================================
-- Automatic delivery is initiated only after a verified payment moves an
-- order to ESCROW_HELD. Legacy listings without product_digital_specs keep
-- the historical default of automatic delivery enabled.
--
-- Delivery text and license keys remain in the private digital_deliveries
-- table and are never copied into notifications or chat.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Idempotent delivery helper with an explicit forced/manual mode.
-- ---------------------------------------------------------------------
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

  -- Missing option rows are legacy listings and remain auto-enabled.
  select coalesce(s.auto_delivery_enabled, true)
    into v_auto_enabled
  from public.product_digital_specs s
  where s.product_id = v_order.product_id;
  if not found then
    v_auto_enabled := true;
  end if;
  v_should_deliver := coalesce(p_force, false) or v_auto_enabled;

  -- A READY/REVOKED record is terminal for this order. In particular, a
  -- retry must never claim another key or replace an already delivered value.
  select * into v_delivery
  from public.digital_deliveries
  where order_id = v_order.id
  for update;
  v_existing_delivery := found;

  if v_existing_delivery and v_delivery.status in ('READY', 'REVOKED') then
    return v_delivery;
  end if;

  -- Auto-disabled listings get a protected PENDING placeholder only. This
  -- makes the manual state visible to the authenticated order-read APIs while
  -- ensuring payment cannot claim a key or release seller content.
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

  -- Read the seller’s private content only after the automatic/forced path has
  -- been authorized. Secret license keys are claimed with row locking.
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

-- The one-argument contract remains safe for any historical internal caller:
-- it always means automatic mode, never forced manual delivery.
create or replace function public.ensure_digital_delivery(p_order_id uuid)
returns public.digital_deliveries as $$
begin
  return public.ensure_digital_delivery(p_order_id, false);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 2) Payment-status trigger: verified ESCROW_HELD starts automatic mode.
-- ---------------------------------------------------------------------
create or replace function public.sync_digital_delivery()
returns trigger as $$
begin
  if coalesce(new.status, '') = 'ESCROW_HELD'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    perform public.ensure_digital_delivery(new.id, false);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_sync_digital_delivery on public.orders;
create trigger trg_sync_digital_delivery
after insert or update of status on public.orders
for each row execute function public.sync_digital_delivery();

-- ---------------------------------------------------------------------
-- 3) Seller content/key changes can fulfill only auto-enabled orders.
-- ---------------------------------------------------------------------
create or replace function public.seller_upsert_digital_content(
  p_seller_id text,
  p_product_id uuid,
  p_delivery_type text,
  p_delivery_text text
) returns void as $$
declare
  v_auto_enabled boolean := true;
  v_option_found boolean := false;
  v_order public.orders%rowtype;
begin
  if p_delivery_type not in ('INSTRUCTIONS', 'LICENSE_KEY', 'DOWNLOAD_LINK') then
    raise exception 'Invalid digital delivery type';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and seller_id = p_seller_id and is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;

  insert into public.digital_product_contents(product_id, seller_id, delivery_type, delivery_text)
  values (p_product_id, p_seller_id, p_delivery_type, coalesce(trim(p_delivery_text), ''))
  on conflict (product_id) do update set
    seller_id = excluded.seller_id,
    delivery_type = excluded.delivery_type,
    delivery_text = excluded.delivery_text,
    updated_at = now();

  select coalesce(s.auto_delivery_enabled, true)
    into v_auto_enabled
  from public.product_digital_specs s
  where s.product_id = p_product_id;
  v_option_found := found;

  if not v_option_found or v_auto_enabled then
    for v_order in
      select o.*
      from public.orders o
      where o.product_id = p_product_id
        and o.seller_id::text = p_seller_id::text
        and o.status in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED')
      order by o.created_at, o.id
    loop
      perform public.ensure_digital_delivery(v_order.id, false);
    end loop;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_add_license_keys(
  p_seller_id text,
  p_product_id uuid,
  p_keys text[]
) returns integer as $$
declare
  v_count integer;
  v_auto_enabled boolean := true;
  v_option_found boolean := false;
  v_order public.orders%rowtype;
begin
  if not exists (
    select 1 from public.products
    where id = p_product_id and seller_id = p_seller_id and is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;

  insert into public.digital_license_inventory(product_id, seller_id, secret_text)
  select p_product_id, p_seller_id, trim(value)
  from unnest(coalesce(p_keys, '{}')) as value
  where trim(value) <> '';
  get diagnostics v_count = row_count;

  select coalesce(s.auto_delivery_enabled, true)
    into v_auto_enabled
  from public.product_digital_specs s
  where s.product_id = p_product_id;
  v_option_found := found;

  if v_count > 0 and (not v_option_found or v_auto_enabled) then
    for v_order in
      select o.*
      from public.orders o
      where o.product_id = p_product_id
        and o.seller_id::text = p_seller_id::text
        and o.status = 'ESCROW_HELD'
      order by o.created_at, o.id
    loop
      perform public.ensure_digital_delivery(v_order.id, false);
    end loop;
  end if;

  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 4) Enabling auto-delivery after payment also retries outstanding orders.
-- ---------------------------------------------------------------------
create or replace function public.seller_upsert_digital_listing_options(
  p_seller_id text,
  p_product_id uuid,
  p_specifications jsonb default '{}'::jsonb,
  p_auto_delivery_enabled boolean default true,
  p_deactivate_when_out_of_stock boolean default false,
  p_stock_mode text default 'UNLIMITED',
  p_stock_quantity integer default 0,
  p_fulfillment_window_minutes integer default 0,
  p_region_code text default 'GLOBAL',
  p_subscription_period text default '',
  p_warranty_period text default '',
  p_delivery_note text default ''
) returns void as $$
declare
  v_order public.orders%rowtype;
  v_auto_enabled boolean := coalesce(p_auto_delivery_enabled, true);
begin
  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.seller_id = p_seller_id and p.is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;
  if not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;
  if jsonb_typeof(coalesce(p_specifications, '{}'::jsonb)) <> 'object' then
    raise exception 'Digital specifications must be a JSON object';
  end if;
  if coalesce(p_stock_mode, 'UNLIMITED') not in ('UNLIMITED', 'QUANTITY', 'KEY_POOL') then
    raise exception 'Invalid digital stock mode';
  end if;
  if coalesce(p_stock_quantity, 0) < 0 or coalesce(p_fulfillment_window_minutes, 0) < 0 then
    raise exception 'Digital stock and fulfillment values cannot be negative';
  end if;

  insert into public.product_digital_specs(
    product_id, seller_id, specifications, auto_delivery_enabled,
    deactivate_when_out_of_stock, stock_mode, stock_quantity,
    fulfillment_window_minutes, region_code, subscription_period,
    warranty_period, delivery_note, updated_at
  ) values (
    p_product_id, p_seller_id, coalesce(p_specifications, '{}'::jsonb),
    v_auto_enabled, coalesce(p_deactivate_when_out_of_stock, false),
    coalesce(p_stock_mode, 'UNLIMITED'), coalesce(p_stock_quantity, 0),
    coalesce(p_fulfillment_window_minutes, 0), coalesce(nullif(trim(p_region_code), ''), 'GLOBAL'),
    coalesce(trim(p_subscription_period), ''), coalesce(trim(p_warranty_period), ''),
    coalesce(trim(p_delivery_note), ''), now()
  )
  on conflict (product_id) do update set
    seller_id = excluded.seller_id,
    specifications = excluded.specifications,
    auto_delivery_enabled = excluded.auto_delivery_enabled,
    deactivate_when_out_of_stock = excluded.deactivate_when_out_of_stock,
    stock_mode = excluded.stock_mode,
    stock_quantity = excluded.stock_quantity,
    fulfillment_window_minutes = excluded.fulfillment_window_minutes,
    region_code = excluded.region_code,
    subscription_period = excluded.subscription_period,
    warranty_period = excluded.warranty_period,
    delivery_note = excluded.delivery_note,
    updated_at = now();

  if v_auto_enabled then
    for v_order in
      select o.*
      from public.orders o
      where o.product_id = p_product_id
        and o.seller_id::text = p_seller_id::text
        and o.status in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED')
      order by o.created_at, o.id
    loop
      perform public.ensure_digital_delivery(v_order.id, false);
    end loop;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 5) Manual seller action remains available only as an explicit force path.
-- ---------------------------------------------------------------------
create or replace function public.seller_deliver_digital(
  p_order_id uuid,
  p_seller_id text
) returns public.digital_deliveries as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.digital_deliveries%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.seller_id::text <> p_seller_id::text then
    raise exception 'Order not found or not yours';
  end if;
  if v_order.status not in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED') then
    raise exception 'Digital order is not ready for delivery';
  end if;

  select * into v_delivery
  from public.ensure_digital_delivery(p_order_id, true);
  return v_delivery;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 6) Clear digital-delivery notification labels; payload stays metadata-only.
-- ---------------------------------------------------------------------
create or replace function public.notify_order_change() returns trigger as $$
declare
  v_buyer_title text;
  v_seller_title text;
  v_body text := 'অর্ডার: ' || new.product_title;
  v_link text := '/orders/' || new.id::text;
  v_is_new_order boolean := tg_op = 'INSERT';
  v_event text := case when v_is_new_order then 'ORDER_CREATED' else 'ORDER_STATUS_CHANGED' end;
begin
  if v_is_new_order or old.status is distinct from new.status then
    v_buyer_title := case new.status
      when 'PENDING_PAYMENT' then 'পেমেন্ট সম্পন্ন করুন'
      when 'ESCROW_HELD' then 'পেমেন্ট সফল হয়েছে'
      when 'DIGITAL_DELIVERED' then 'ডিজিটাল ডেলিভারি প্রস্তুত'
      when 'PREPARING' then 'Seller অর্ডার প্রস্তুত করছেন'
      when 'SHIPPED' then 'আপনার অর্ডার পাঠানো হয়েছে'
      when 'DELIVERED' then 'অর্ডারটি পৌঁছেছে — গ্রহণ নিশ্চিত করুন'
      when 'COMPLETED' then 'অর্ডার সম্পন্ন হয়েছে'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    v_seller_title := case new.status
      when 'PENDING_PAYMENT' then 'নতুন checkout শুরু হয়েছে'
      when 'ESCROW_HELD' then 'নতুন অর্ডার পেয়েছেন'
      when 'DIGITAL_DELIVERED' then 'ডিজিটাল ডেলিভারি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে'
      when 'PREPARING' then 'অর্ডার প্রস্তুত করুন'
      when 'SHIPPED' then 'অর্ডার শিপড হয়েছে'
      when 'DELIVERED' then 'অর্ডার পৌঁছেছে — buyer confirmation অপেক্ষায়'
      when 'COMPLETED' then 'বিক্রয় সম্পন্ন হয়েছে'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    perform public.notify_user_event(
      new.buyer_id,
      'ORDER',
      v_buyer_title,
      v_body,
      v_link,
      jsonb_build_object('event', v_event, 'order_id', new.id, 'recipient_role', 'CUSTOMER')
    );

    if new.seller_id::text <> new.buyer_id::text then
      perform public.notify_user_event(
        new.seller_id,
        'ORDER',
        v_seller_title,
        v_body,
        v_link,
        jsonb_build_object('event', v_event, 'order_id', new.id, 'recipient_role', 'SELLER')
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_order_change on public.orders;
create trigger trg_notify_order_change
after insert or update of status on public.orders
for each row execute function public.notify_order_change();

-- ---------------------------------------------------------------------
-- 7) Keep secret-bearing RPCs available only to the verified server role.
-- ---------------------------------------------------------------------
revoke all on function public.ensure_digital_delivery(uuid) from public, anon, authenticated;
revoke all on function public.ensure_digital_delivery(uuid, boolean) from public, anon, authenticated;
revoke all on function public.seller_add_license_keys(text, uuid, text[]) from public, anon, authenticated;
revoke all on function public.seller_deliver_digital(uuid, text) from public, anon, authenticated;
revoke all on function public.seller_upsert_digital_content(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.seller_upsert_digital_listing_options(text, uuid, jsonb, boolean, boolean, text, integer, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_digital_delivery(uuid) to service_role;
grant execute on function public.ensure_digital_delivery(uuid, boolean) to service_role;
grant execute on function public.seller_add_license_keys(text, uuid, text[]) to service_role;
grant execute on function public.seller_deliver_digital(uuid, text) to service_role;
grant execute on function public.seller_upsert_digital_content(text, uuid, text, text) to service_role;
grant execute on function public.seller_upsert_digital_listing_options(text, uuid, jsonb, boolean, boolean, text, integer, integer, text, text, text, text) to service_role;

select '081 flag-aware automatic digital delivery installed' as result;
