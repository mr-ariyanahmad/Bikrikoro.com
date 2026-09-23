-- Encrypt seller delivery content and license inventory at rest.
-- This preserves offline automatic delivery: the trusted database function decrypts
-- only after an order is authorized, while ordinary reads expose ciphertext only.

alter table public.digital_product_contents add column if not exists delivery_ciphertext text;
alter table public.digital_license_inventory add column if not exists secret_ciphertext text;
alter table public.digital_deliveries add column if not exists delivery_ciphertext text;

create or replace function public.delivery_crypto_key()
returns text as $$
declare v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'bikrikoro_delivery_key'
  limit 1;
  if coalesce(v_key, '') = '' then raise exception 'Digital delivery encryption key is not configured'; end if;
  return v_key;
end;
$$ language plpgsql security definer set search_path = public, vault, pg_temp;
revoke all on function public.delivery_crypto_key() from public, anon, authenticated;

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
  v_crypto_key text;
begin
  v_crypto_key := public.delivery_crypto_key();
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
        delivery_text, delivery_ciphertext, status, delivered_at, updated_at
      ) values (
        v_order.id, v_order.product_id, v_order.buyer_id, v_order.seller_id,
        v_type, '', null, 'PENDING', null, now()
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
        v_text := coalesce(pgp_sym_decrypt(decode(v_key.secret_ciphertext, 'base64'), v_crypto_key), v_key.secret_text);
        v_ready := true;
      end if;
    else
      v_text := coalesce(pgp_sym_decrypt(decode(v_content.delivery_ciphertext, 'base64'), v_crypto_key), v_content.delivery_text, '');
      v_ready := v_text <> '';
    end if;
  end if;

  insert into public.digital_deliveries(
    order_id, product_id, buyer_id, seller_id, delivery_type,
    delivery_text, delivery_ciphertext, status, delivered_at, updated_at
  ) values (
    v_order.id, v_order.product_id, v_order.buyer_id, v_order.seller_id,
    v_type, '', case when v_text <> '' then encode(pgp_sym_encrypt(v_text, v_crypto_key, 'cipher-algo=aes256'), 'base64') else null end, case when v_ready then 'READY' else 'PENDING' end,
    case when v_ready then now() else null end, now()
  )
  on conflict (order_id) do update set
    delivery_type = case
      when public.digital_deliveries.status = 'PENDING' then excluded.delivery_type
      else public.digital_deliveries.delivery_type
    end,
    delivery_text = case when public.digital_deliveries.status = 'PENDING' then '' else public.digital_deliveries.delivery_text end,
    delivery_ciphertext = case when public.digital_deliveries.status = 'PENDING' then excluded.delivery_ciphertext else public.digital_deliveries.delivery_ciphertext end,
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

-- Seller content is encrypted before it is stored. Existing plaintext is migrated
-- once, then cleared from the legacy columns.
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
  v_crypto_key text;
begin
  v_crypto_key := public.delivery_crypto_key();
  if p_delivery_type not in ('INSTRUCTIONS', 'LICENSE_KEY', 'DOWNLOAD_LINK') then
    raise exception 'Invalid digital delivery type';
  end if;
  if not exists (
    select 1 from public.products
    where id = p_product_id and seller_id = p_seller_id and is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;

  insert into public.digital_product_contents(product_id, seller_id, delivery_type, delivery_text, delivery_ciphertext)
  values (p_product_id, p_seller_id, p_delivery_type, '', case when coalesce(trim(p_delivery_text), '') <> '' then encode(pgp_sym_encrypt(trim(p_delivery_text), v_crypto_key, 'cipher-algo=aes256'), 'base64') else null end)
  on conflict (product_id) do update set
    seller_id = excluded.seller_id,
    delivery_type = excluded.delivery_type,
    delivery_text = '',
    delivery_ciphertext = excluded.delivery_ciphertext,
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
  v_crypto_key text;
begin
  v_crypto_key := public.delivery_crypto_key();
  if not exists (
    select 1 from public.products
    where id = p_product_id and seller_id = p_seller_id and is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;

  insert into public.digital_license_inventory(product_id, seller_id, secret_text, secret_ciphertext)
  select p_product_id, p_seller_id, '', encode(pgp_sym_encrypt(trim(value), v_crypto_key, 'cipher-algo=aes256'), 'base64')
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

update public.digital_product_contents
set delivery_ciphertext = encode(pgp_sym_encrypt(delivery_text, public.delivery_crypto_key(), 'cipher-algo=aes256'), 'base64'),
    delivery_text = ''
where coalesce(delivery_text, '') <> '' and coalesce(delivery_ciphertext, '') = '';

update public.digital_license_inventory
set secret_ciphertext = encode(pgp_sym_encrypt(secret_text, public.delivery_crypto_key(), 'cipher-algo=aes256'), 'base64'),
    secret_text = ''
where coalesce(secret_text, '') <> '' and coalesce(secret_ciphertext, '') = '';

update public.digital_deliveries
set delivery_ciphertext = encode(pgp_sym_encrypt(delivery_text, public.delivery_crypto_key(), 'cipher-algo=aes256'), 'base64'),
    delivery_text = ''
where coalesce(delivery_text, '') <> '' and coalesce(delivery_ciphertext, '') = '';

create or replace function public.seller_get_digital_content(p_seller_id text, p_product_id uuid)
returns table(delivery_type text, delivery_text text, updated_at timestamptz) as $$
declare v_key text;
begin
  v_key := public.delivery_crypto_key();
  return query
  select c.delivery_type, coalesce(pgp_sym_decrypt(decode(c.delivery_ciphertext, 'base64'), v_key), c.delivery_text, ''), c.updated_at
  from public.digital_product_contents c
  where c.product_id = p_product_id and c.seller_id = p_seller_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.buyer_get_digital_delivery(p_buyer_id text, p_order_id uuid)
returns table(order_id uuid, delivery_type text, delivery_text text, status text, delivered_at timestamptz, updated_at timestamptz) as $$
declare v_key text;
begin
  v_key := public.delivery_crypto_key();
  return query
  select d.order_id, d.delivery_type, coalesce(pgp_sym_decrypt(decode(d.delivery_ciphertext, 'base64'), v_key), d.delivery_text, ''), d.status, d.delivered_at, d.updated_at
  from public.digital_deliveries d
  join public.orders o on o.id = d.order_id
  where d.order_id = p_order_id and o.buyer_id = p_buyer_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.buyer_list_digital_deliveries(p_buyer_id text, p_order_ids uuid[])
returns table(order_id uuid, delivery_type text, delivery_text text, status text, delivered_at timestamptz, updated_at timestamptz) as $$
declare v_key text;
begin
  v_key := public.delivery_crypto_key();
  return query
  select d.order_id, d.delivery_type, coalesce(pgp_sym_decrypt(decode(d.delivery_ciphertext, 'base64'), v_key), d.delivery_text, ''), d.status, d.delivered_at, d.updated_at
  from public.digital_deliveries d
  join public.orders o on o.id = d.order_id
  where o.buyer_id = p_buyer_id and d.order_id = any(coalesce(p_order_ids, '{}'));
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.seller_get_digital_content(text, uuid) from public, anon, authenticated;
revoke all on function public.buyer_get_digital_delivery(text, uuid) from public, anon, authenticated;
revoke all on function public.buyer_list_digital_deliveries(text, uuid[]) from public, anon, authenticated;
