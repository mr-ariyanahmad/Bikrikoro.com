-- BikriKoro — migration 048: DIGITAL-only marketplace contract
-- =====================================================================
-- This migration is deliberately additive/reversible. Physical products and
-- historical physical orders are retained for admin/audit/history purposes,
-- but all new public listings and checkouts are digital-only.
--
-- New digital order flow:
-- PENDING_PAYMENT -> ESCROW_HELD -> DIGITAL_DELIVERED -> COMPLETED
--                                      |                |
--                                      +-> DISPUTED --->+-> REFUNDED
--
-- SECURITY NOTE: Firebase UID arguments are accepted for compatibility with
-- this project's Firebase-identity data model. Production mutations should
-- call these RPCs through the Firebase-verified server gateway.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Archive existing physical catalogue records without deleting history.
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text not null default '';

update public.products
set is_hidden = true,
    archived_at = coalesce(archived_at, now()),
    archive_reason = case
      when coalesce(trim(archive_reason), '') = '' then 'DIGITAL_ONLY_MIGRATION'
      else archive_reason
    end
where coalesce(is_digital, false) = false
  and coalesce(is_hidden, false) = false;

create index if not exists idx_products_archive_state
  on public.products(is_digital, is_hidden, archived_at desc);

-- Physical historical orders remain readable by permission-scoped admin RPCs.
-- New digital checkout does not require a shipping address.
alter table public.orders alter column delivery_address drop not null;

-- ---------------------------------------------------------------------
-- 2) Extend the order state constraint while keeping old states for history.
-- ---------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'PENDING_PAYMENT', 'ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED',
    'COMPLETED', 'CANCELLED', 'DIGITAL_DELIVERED', 'DISPUTED', 'REFUNDED'
  ));

alter table public.orders
  add column if not exists digital_delivered_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists escrow_released_at timestamptz,
  add column if not exists refunded_at timestamptz;

create index if not exists idx_orders_digital_lifecycle
  on public.orders(status, updated_at desc)
  where status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED');

-- ---------------------------------------------------------------------
-- 3) Public catalogue is approved, visible DIGITAL products only.
-- ---------------------------------------------------------------------
drop policy if exists "Products are publicly readable" on public.products;
drop policy if exists "Public products exclude moderated listings" on public.products;
drop policy if exists "Public products require approval" on public.products;
create policy "Public products require approval"
  on public.products for select
  using (
    coalesce(is_hidden, false) = false
    and approval_status = 'APPROVED'
    and coalesce(is_digital, false) = true
  );

create index if not exists idx_products_digital_approved
  on public.products(is_digital, approval_status, created_at desc)
  where is_digital = true and is_hidden = false and approval_status = 'APPROVED';

create index if not exists idx_products_digital_category
  on public.products(category_id, created_at desc)
  where is_digital = true and is_hidden = false and approval_status = 'APPROVED';

-- Browser clients must not bypass seller eligibility and digital-only RPC validation.
drop policy if exists "Anyone can create a listing" on public.products;
drop policy if exists "Sellers can update their own listings" on public.products;
drop policy if exists "Sellers can delete their own listings" on public.products;
create policy "Product inserts are server-only"
  on public.products for insert with check (false);
create policy "Product updates are server-only"
  on public.products for update using (false) with check (false);
create policy "Product deletes are server-only"
  on public.products for delete using (false);

-- Remove the legacy no-video overload; otherwise a caller could still invoke it
-- with p_is_digital = false and bypass the new digital-only contract.
drop function if exists public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean);

-- ---------------------------------------------------------------------
-- 4) Digital-only seller listing RPCs.
-- ---------------------------------------------------------------------
create or replace function public.seller_create_product(
  p_seller_id text,
  p_title text,
  p_description text,
  p_price numeric,
  p_original_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[],
  p_is_digital boolean,
  p_supports_cod boolean default false,
  p_free_delivery boolean default false,
  p_fast_delivery boolean default false,
  p_free_return boolean default false,
  p_video_url text default null
) returns uuid as $$
declare
  v_product_id uuid;
  v_video_url text := nullif(trim(coalesce(p_video_url, '')), '');
begin
  if not exists (select 1 from public.profiles where id = p_seller_id) then
    raise exception 'Seller profile not found';
  end if;
  if not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;
  if coalesce(p_is_digital, false) is not true then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: physical listings are disabled';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid product condition';
  end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then
    raise exception 'At least one product image is required';
  end if;
  if v_video_url is not null and v_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;

  insert into public.products (
    title, description, price, original_price, category_id, condition,
    location, images, video_url, is_digital, supports_cod, free_delivery,
    fast_delivery, free_return, seller_id
  ) values (
    trim(p_title), coalesce(p_description, ''), p_price, p_original_price,
    p_category_id, p_condition, '', coalesce(p_images, '{}'), v_video_url,
    true, false, false, false, false, p_seller_id
  ) returning id into v_product_id;

  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_update_product(
  p_seller_id text,
  p_product_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_original_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[],
  p_is_digital boolean,
  p_supports_cod boolean default false,
  p_free_delivery boolean default false,
  p_fast_delivery boolean default false,
  p_free_return boolean default false,
  p_video_url text default null
) returns uuid as $$
begin
  if not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;
  if coalesce(p_is_digital, false) is not true then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: physical listings are disabled';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  if p_condition not in ('NEW', 'USED') then
    raise exception 'Invalid product condition';
  end if;
  if coalesce(array_length(p_images, 1), 0) < 1 then
    raise exception 'At least one product image is required';
  end if;
  if p_video_url is not null and trim(p_video_url) <> ''
     and p_video_url !~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/' then
    raise exception 'Only YouTube video URLs are supported';
  end if;

  update public.products
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      price = p_price,
      original_price = p_original_price,
      category_id = p_category_id,
      condition = p_condition,
      location = '',
      images = coalesce(p_images, '{}'),
      video_url = nullif(trim(coalesce(p_video_url, '')), ''),
      is_digital = true,
      supports_cod = false,
      free_delivery = false,
      fast_delivery = false,
      free_return = false,
      archived_at = null,
      archive_reason = ''
  where id = p_product_id
    and seller_id = p_seller_id
    and coalesce(is_digital, false) = true
  returning id;

  if not found then
    raise exception 'Digital listing not found or not yours';
  end if;
  return p_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 5) Digital checkout: product must be approved/visible/DIGITAL and the
-- address is normalized to empty text for compatibility with old columns.
-- ---------------------------------------------------------------------
create or replace function public.create_order_pending_payment(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_escrow_fee numeric(12,2);
  v_order_id uuid;
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
    and is_digital = true
  for update;

  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  v_escrow_fee := greatest(v_product.price * 0.01, 10);

  insert into public.orders (
    product_id, product_title, product_image, price, seller_id, buyer_id,
    delivery_address, payment_method, status, escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''),
    v_product.price, v_product.seller_id, p_buyer_id, '', null,
    'PENDING_PAYMENT', v_escrow_fee
  ) returning id into v_order_id;

  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.create_order_pending_payment_with_coupon(
  p_product_id uuid,
  p_buyer_id text,
  p_delivery_address text,
  p_coupon_code text default null
) returns uuid as $$
declare
  v_product public.products%rowtype;
  v_escrow_fee numeric(12,2);
  v_subtotal numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_code text := null;
  v_order_id uuid;
  v_coupon record;
begin
  select * into v_product
  from public.products
  where id = p_product_id
    and approval_status = 'APPROVED'
    and is_hidden = false
    and is_digital = true
  for update;

  if not found then raise exception 'Digital product not found or not available'; end if;
  if v_product.seller_id::text = p_buyer_id::text then raise exception 'Cannot order your own listing'; end if;
  v_subtotal := v_product.price;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
    if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
    v_discount := v_coupon.discount_amount;
    v_code := v_coupon.normalized_code;
  end if;

  v_escrow_fee := greatest(greatest(v_subtotal - v_discount, 0) * 0.01, 10);
  insert into public.orders (
    product_id, product_title, product_image, price, subtotal,
    discount_amount, coupon_code, seller_id, buyer_id, delivery_address,
    payment_method, status, escrow_fee
  ) values (
    v_product.id, v_product.title, coalesce(v_product.images[1], ''),
    greatest(v_subtotal - v_discount, 0), v_subtotal, v_discount, v_code,
    v_product.seller_id, p_buyer_id, '', null, 'PENDING_PAYMENT', v_escrow_fee
  ) returning id into v_order_id;

  if v_code is not null then
    insert into public.coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
    values (v_code, v_order_id, p_buyer_id, v_discount);
    update public.coupons set redeemed_count = redeemed_count + 1 where code = v_code;
  end if;

  return v_order_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 6) License-key inventory. Secret rows are never public-read; each order
-- atomically claims at most one AVAILABLE key.
-- ---------------------------------------------------------------------
create table if not exists public.digital_license_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id text not null references public.profiles(id),
  secret_text text not null,
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'CLAIMED', 'REVOKED')),
  order_id uuid references public.orders(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_digital_license_inventory_claim
  on public.digital_license_inventory(product_id, status, created_at);

alter table public.digital_license_inventory enable row level security;
drop policy if exists "Digital license inventory is private" on public.digital_license_inventory;
create policy "Digital license inventory is private"
  on public.digital_license_inventory for all
  using (false) with check (false);

-- Delivery records may be read only by the Firebase-verified server gateway
-- through the service-role client; direct browser table reads are denied.
alter table public.digital_product_contents enable row level security;
drop policy if exists "Sellers can create digital content" on public.digital_product_contents;
drop policy if exists "Sellers can update digital content" on public.digital_product_contents;
drop policy if exists "Sellers can read digital content" on public.digital_product_contents;
drop policy if exists "Digital content is server-only" on public.digital_product_contents;
create policy "Digital content is server-only"
  on public.digital_product_contents for all
  using (false) with check (false);

alter table public.digital_deliveries enable row level security;
drop policy if exists "Digital deliveries are server-only" on public.digital_deliveries;
create policy "Digital deliveries are server-only"
  on public.digital_deliveries for all
  using (false) with check (false);

create or replace function public.seller_add_license_keys(
  p_seller_id text,
  p_product_id uuid,
  p_keys text[]
) returns integer as $$
declare
  v_count integer;
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
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 7) Idempotent digital delivery creation and escrow transition.
-- ---------------------------------------------------------------------
create or replace function public.ensure_digital_delivery(p_order_id uuid)
returns public.digital_deliveries as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_content public.digital_product_contents%rowtype;
  v_key public.digital_license_inventory%rowtype;
  v_delivery public.digital_deliveries%rowtype;
  v_type text := 'INSTRUCTIONS';
  v_text text := '';
  v_ready boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED', 'COMPLETED') then
    raise exception 'Digital delivery is not available in current order state';
  end if;

  select * into v_product from public.products where id = v_order.product_id;
  if not found or coalesce(v_product.is_digital, false) is not true then
    raise exception 'Only digital products can be delivered automatically';
  end if;

  select * into v_content
  from public.digital_product_contents
  where product_id = v_order.product_id;

  if found then
    v_type := v_content.delivery_type;
    if v_type = 'LICENSE_KEY' then
      select * into v_key
      from public.digital_license_inventory
      where product_id = v_order.product_id
        and status = 'AVAILABLE'
      order by created_at, id
      for update skip locked
      limit 1;
      if found then
        update public.digital_license_inventory
        set status = 'CLAIMED', order_id = v_order.id, claimed_at = now()
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
    where id = v_order.id and status = 'ESCROW_HELD';
  end if;

  return v_delivery;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.sync_digital_delivery()
returns trigger as $$
begin
  if coalesce(new.status, '') = 'ESCROW_HELD'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    perform public.ensure_digital_delivery(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_sync_digital_delivery on public.orders;
create trigger trg_sync_digital_delivery
after insert or update of status on public.orders
for each row execute function public.sync_digital_delivery();

-- Seller content changes can fulfill a previously pending escrow delivery.
create or replace function public.seller_upsert_digital_content(
  p_seller_id text,
  p_product_id uuid,
  p_delivery_type text,
  p_delivery_text text
) returns void as $$
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

  perform public.ensure_digital_delivery(o.id)
  from public.orders o
  where o.product_id = p_product_id
    and o.seller_id = p_seller_id
    and o.status in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED');
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 8) Buyer confirmation and wallet settlement. The row lock plus existence
-- checks make retries safe even if the browser retries after a timeout.
-- ---------------------------------------------------------------------
create or replace function public.apply_order_wallet_effects()
returns trigger as $$
begin
  if new.status in ('CANCELLED', 'REFUNDED')
     and old.status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'DIGITAL_DELIVERED', 'DISPUTED')
     and not exists (
       select 1 from public.wallet_ledger
       where order_id = new.id and user_id = new.buyer_id and type = 'ORDER_REFUND'
     )
  then
    insert into public.wallet_ledger(user_id, type, amount, order_id, description)
    values (
      new.buyer_id, 'ORDER_REFUND',
      (new.price * new.quantity) + new.escrow_fee,
      new.id, 'অর্ডার রিফান্ড — ' || new.product_title
    );
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  if new.status = 'COMPLETED'
     and old.status is distinct from 'COMPLETED'
     and not exists (
       select 1 from public.wallet_ledger
       where order_id = new.id and user_id = new.seller_id and type = 'SELLER_PAYOUT'
     )
  then
    insert into public.wallet_ledger(user_id, type, amount, order_id, description)
    values (
      new.seller_id, 'SELLER_PAYOUT', new.price * new.quantity,
      new.id, 'বিক্রয় সম্পন্ন — পেআউট: ' || new.product_title
    );
    new.escrow_released_at := coalesce(new.escrow_released_at, now());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_apply_order_wallet_effects on public.orders;
create trigger trg_apply_order_wallet_effects
before update on public.orders
for each row execute function public.apply_order_wallet_effects();

create or replace function public.buyer_confirm_digital_delivery(
  p_buyer_id text,
  p_order_id uuid
) returns void as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id::text <> p_buyer_id::text then
    raise exception 'Order not found or not yours';
  end if;
  if coalesce(v_order.dispute_status, '') in ('REPORTED', 'UNDER_REVIEW')
     or v_order.status <> 'DIGITAL_DELIVERED' then
    raise exception 'Digital delivery is not ready for confirmation';
  end if;

  update public.orders
  set status = 'COMPLETED',
      buyer_confirmed_at = coalesce(buyer_confirmed_at, now()),
      updated_at = now()
  where id = p_order_id and status = 'DIGITAL_DELIVERED';
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Compatibility helper: old confirmation calls now accept the new state.
create or replace function public.confirm_order_delivery(
  p_order_id uuid,
  p_buyer_id text
) returns void as $$
begin
  update public.orders
  set status = 'COMPLETED',
      buyer_confirmed_at = coalesce(buyer_confirmed_at, now()),
      updated_at = now()
  where id = p_order_id
    and buyer_id::text = p_buyer_id::text
    and status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'DIGITAL_DELIVERED')
    and coalesce(dispute_status, '') not in ('REPORTED', 'UNDER_REVIEW');

  if not found then
    raise exception 'Order not found, not yours, not delivered, or has an open dispute';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 9) Digital disputes move the order into a protected DISPUTED state.
-- ---------------------------------------------------------------------
create or replace function public.report_order_dispute(
  p_order_id uuid,
  p_buyer_id text,
  p_reason text,
  p_description text,
  p_evidence_urls text[]
) returns uuid as $$
declare
  v_order public.orders%rowtype;
  v_is_digital boolean;
  v_dispute_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.buyer_id::text <> p_buyer_id::text then raise exception 'Not authorized'; end if;
  if p_reason not in ('NOT_RECEIVED', 'DAMAGED', 'FAKE_OR_COUNTERFEIT', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'OTHER') then
    raise exception 'Invalid dispute reason';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Dispute description is too short';
  end if;
  if v_order.dispute_status in ('REPORTED', 'UNDER_REVIEW') then
    raise exception 'This order already has an open dispute';
  end if;

  select coalesce(is_digital, false) into v_is_digital
  from public.products where id = v_order.product_id;

  if v_is_digital then
    if v_order.status not in ('ESCROW_HELD', 'DIGITAL_DELIVERED') then
      raise exception 'Digital order is not in a disputable state';
    end if;
  elsif v_order.status not in ('SHIPPED', 'DELIVERED') then
    raise exception 'Order is not in a disputable state';
  end if;

  insert into public.order_disputes(order_id, buyer_id, reason, description, evidence_urls)
  values (p_order_id, p_buyer_id, p_reason, trim(p_description), coalesce(p_evidence_urls, '{}'))
  returning id into v_dispute_id;

  if v_is_digital then
    update public.orders set status = 'DISPUTED', updated_at = now() where id = p_order_id;
  end if;
  return v_dispute_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_resolve_dispute(
  p_admin_id text,
  p_dispute_id uuid,
  p_status text,
  p_resolution_note text
) returns void as $$
declare
  v_order_id uuid;
  v_dispute_current_status text;
  v_current_status text;
  v_is_digital boolean;
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('UNDER_REVIEW', 'RESOLVED_REFUNDED', 'RESOLVED_DENIED') then
    raise exception 'Invalid dispute status';
  end if;

  select d.order_id, d.status, o.status, coalesce(p.is_digital, false)
    into v_order_id, v_dispute_current_status, v_current_status, v_is_digital
  from public.order_disputes d
  join public.orders o on o.id = d.order_id
  join public.products p on p.id = o.product_id
  where d.id = p_dispute_id
  for update;

  if not found then raise exception 'Dispute not found'; end if;
  if v_dispute_current_status in ('RESOLVED_REFUNDED', 'RESOLVED_DENIED') then
    raise exception 'Dispute is already resolved';
  end if;

  update public.order_disputes
  set status = p_status,
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), '')
  where id = p_dispute_id;

  if p_status = 'RESOLVED_REFUNDED' then
    update public.orders
    set status = case when v_is_digital then 'REFUNDED' else 'CANCELLED' end,
        updated_at = now()
    where id = v_order_id
      and v_current_status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'DIGITAL_DELIVERED', 'DISPUTED');
  elsif p_status = 'RESOLVED_DENIED' and v_is_digital and v_current_status = 'DISPUTED' then
    update public.orders
    set status = 'DIGITAL_DELIVERED', updated_at = now()
    where id = v_order_id;
  end if;

  if p_resolution_note is not null and length(trim(p_resolution_note)) > 0 then
    perform public.send_dispute_message(p_dispute_id, p_admin_id, trim(p_resolution_note));
  end if;

  perform public.admin_log(
    p_admin_id, 'DISPUTE_RESOLVED', 'ORDER_DISPUTE', p_dispute_id::text,
    jsonb_build_object('status', p_status, 'order_id', v_order_id)
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.seller_deliver_digital(
  p_order_id uuid,
  p_seller_id text
) returns public.digital_deliveries as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.digital_deliveries%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.seller_id::text <> p_seller_id::text then
    raise exception 'Order not found or not yours';
  end if;
  if v_order.status not in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED') then
    raise exception 'Digital order is not ready for delivery';
  end if;

  select * into v_delivery from public.ensure_digital_delivery(p_order_id);
  return v_delivery;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 10) Public function grants are limited for new secret-bearing RPCs.
-- The Firebase-verified gateway uses service_role and remains unaffected.
-- ---------------------------------------------------------------------
revoke all on function public.ensure_digital_delivery(uuid) from public;
revoke all on function public.seller_add_license_keys(text, uuid, text[]) from public;
revoke all on function public.buyer_confirm_digital_delivery(text, uuid) from public;
revoke all on function public.seller_deliver_digital(uuid, text) from public;
grant execute on function public.ensure_digital_delivery(uuid) to service_role;
grant execute on function public.seller_add_license_keys(text, uuid, text[]) to service_role;
grant execute on function public.buyer_confirm_digital_delivery(text, uuid) to service_role;
grant execute on function public.seller_deliver_digital(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 11) Public delivery lookup used by the protected server read path.
-- ---------------------------------------------------------------------
create index if not exists idx_digital_deliveries_buyer
  on public.digital_deliveries(buyer_id, updated_at desc);
create index if not exists idx_digital_deliveries_seller
  on public.digital_deliveries(seller_id, updated_at desc);
create index if not exists idx_digital_deliveries_pending
  on public.digital_deliveries(status, updated_at desc)
  where status = 'PENDING';

revoke all on function public.get_digital_library(text) from public;
grant execute on function public.get_digital_library(text) to service_role;

create or replace function public.admin_moderate_product(p_admin_id text, p_product_id uuid, p_action text)
returns void as $$
declare
  v_is_digital boolean;
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  select coalesce(is_digital, false) into v_is_digital from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p_action = 'RESTORE' and not v_is_digital then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: archived physical records cannot be restored';
  end if;
  if p_action = 'RESTORE' then
    update public.products set is_hidden = false, moderation_note = '' where id = p_product_id;
  elsif p_action in ('HIDE', 'DELETE') then
    update public.products set is_hidden = true, moderation_note = p_action where id = p_product_id;
  else
    raise exception 'Invalid product moderation action';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_update_product(
  p_admin_id text,
  p_product_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[]
) returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  if p_condition not in ('NEW', 'USED') or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid product values';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and is_digital = true) then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: only digital listings can be edited';
  end if;
  update public.products
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      price = p_price,
      category_id = p_category_id,
      condition = p_condition,
      location = '',
      images = coalesce(p_images, images)
  where id = p_product_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_review_product(
  p_admin_id text,
  p_product_id uuid,
  p_status text,
  p_admin_note text default ''
) returns void as $$
declare
  v_email text;
  v_product_title text;
  v_is_digital boolean;
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid product approval status'; end if;
  select title, coalesce(is_digital, false) into v_product_title, v_is_digital from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if not v_is_digital and p_status = 'APPROVED' then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: only digital listings can be approved';
  end if;
  select coalesce(email, '') into v_email from public.profiles where id = p_admin_id;
  update public.products
  set approval_status = p_status,
      approval_note = coalesce(p_admin_note, ''),
      approval_reviewed_by = p_admin_id,
      approval_reviewed_email = coalesce(v_email, ''),
      approval_reviewed_at = now(),
      is_hidden = case when p_status = 'APPROVED' and v_is_digital then false else true end
  where id = p_product_id;
  insert into public.product_approval_history(product_id, admin_uid, admin_email, decision, note)
  values (p_product_id, p_admin_id, coalesce(v_email, ''), p_status, coalesce(p_admin_note, ''));
  perform public.admin_log(p_admin_id, 'PRODUCT_' || p_status, 'PRODUCT', p_product_id::text, jsonb_build_object('title', v_product_title, 'admin_email', coalesce(v_email, ''), 'note', coalesce(p_admin_note, '')));
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_update_order_status(
  p_admin_id text,
  p_order_id uuid,
  p_status text
) returns void as $$
declare
  v_current text;
  v_is_digital boolean;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.orders');
  if p_status <> 'CANCELLED' then
    raise exception 'DIGITAL_ONLY_MARKETPLACE: use the dedicated payment, delivery, confirmation, or dispute action';
  end if;
  select o.status, coalesce(p.is_digital, false)
    into v_current, v_is_digital
  from public.orders o
  join public.products p on p.id = o.product_id
  where o.id = p_order_id
  for update of o;
  if not found then raise exception 'Order not found'; end if;
  if not v_is_digital or v_current not in ('PENDING_PAYMENT', 'ESCROW_HELD') then
    raise exception 'Only active digital pending or escrow orders can be cancelled by admin';
  end if;
  update public.orders set status = 'CANCELLED', updated_at = now() where id = p_order_id;
  perform public.admin_log(p_admin_id, 'ORDER_STATUS_CHANGED', 'ORDER', p_order_id::text, jsonb_build_object('from', v_current, 'to', 'CANCELLED', 'digital_only', true));
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_get_dashboard_overview(p_admin_id text)
returns jsonb as $$
declare
  v_recent jsonb;
  v_pending_sellers integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'dashboard.view');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) into v_recent
  from (select id, product_title, price, status, created_at from public.orders order by created_at desc limit 7) q;
  select count(*)::integer into v_pending_sellers from public.seller_registrations where status = 'PENDING';
  return jsonb_build_object(
    'orders', (select count(*) from public.orders),
    'customers', (select count(*) from public.profiles),
    'products', (select count(*) from public.products where is_digital = true),
    'pending', (select count(*) from public.orders where status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED')),
    'disputes', (select count(*) from public.order_disputes where status in ('REPORTED', 'UNDER_REVIEW')),
    'sellers', v_pending_sellers,
    'revenue', coalesce((select sum(price) from public.orders where status in ('ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED', 'COMPLETED')), 0),
    'recent_orders', v_recent
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to service_role;
revoke all on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to service_role;
revoke all on function public.seller_upsert_digital_content(text, uuid, text, text) from public;
grant execute on function public.seller_upsert_digital_content(text, uuid, text, text) to service_role;
revoke all on function public.seller_clear_digital_content(text, uuid) from public;
grant execute on function public.seller_clear_digital_content(text, uuid) to service_role;

revoke all on function public.admin_moderate_product(text, uuid, text) from public;
grant execute on function public.admin_moderate_product(text, uuid, text) to service_role;
revoke all on function public.admin_update_product(text, uuid, text, text, numeric, text, text, text, text[]) from public;
grant execute on function public.admin_update_product(text, uuid, text, text, numeric, text, text, text, text[]) to service_role;
revoke all on function public.admin_review_product(text, uuid, text, text) from public;
grant execute on function public.admin_review_product(text, uuid, text, text) to service_role;
revoke all on function public.admin_update_order_status(text, uuid, text) from public;
grant execute on function public.admin_update_order_status(text, uuid, text) to service_role;
revoke all on function public.admin_get_dashboard_overview(text) from public;
grant execute on function public.admin_get_dashboard_overview(text) to service_role;

-- Migration complete. Physical rows remain queryable only by scoped admin/service-role
-- history access; no public catalogue or new checkout path can expose them.
