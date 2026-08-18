-- BikriKoro — order lifecycle hardening
-- =====================================================================
-- Website lifecycle:
-- PENDING_PAYMENT -> ESCROW_HELD -> PREPARING -> SHIPPED -> DELIVERED -> COMPLETED
-- Buyer may report a dispute while SHIPPED/DELIVERED. A refund resolution
-- cancels the order; a denied dispute leaves the order eligible to continue.
--
-- The Firebase UID is still passed explicitly because this project uses
-- Firebase Authentication with Supabase as the data store. State-changing
-- operations are nevertheless restricted to SECURITY DEFINER RPCs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Add the preparation state without breaking existing orders.
-- ---------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'));

-- ---------------------------------------------------------------------
-- 2) Seller fulfillment actions.
-- ---------------------------------------------------------------------
create or replace function public.seller_mark_preparing(
  p_order_id uuid,
  p_seller_id text
) returns void as $$
begin
  update public.orders
  set status = 'PREPARING', updated_at = now()
  where id = p_order_id
    and seller_id::text = p_seller_id::text
    and status = 'ESCROW_HELD';

  if not found then
    raise exception 'Order not found, not yours, or not ready for preparation';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ESCROW_HELD remains accepted for compatibility with the existing Android
-- client. The current website shows the preparation action first.
create or replace function public.seller_mark_shipped(
  p_order_id uuid,
  p_seller_id text
) returns void as $$
begin
  update public.orders
  set status = 'SHIPPED', updated_at = now()
  where id = p_order_id
    and seller_id::text = p_seller_id::text
    and status in ('ESCROW_HELD', 'PREPARING')
    and (dispute_status is null or dispute_status = 'RESOLVED_DENIED');

  if not found then
    raise exception 'Order not found, not yours, or not in a shippable state';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- This application has no courier integration yet, so the seller marks the
-- hand-off/delivery as complete. The buyer still has to confirm receipt.
create or replace function public.seller_mark_delivered(
  p_order_id uuid,
  p_seller_id text
) returns void as $$
begin
  update public.orders
  set status = 'DELIVERED', updated_at = now()
  where id = p_order_id
    and seller_id::text = p_seller_id::text
    and status = 'SHIPPED'
    and (dispute_status is null or dispute_status = 'RESOLVED_DENIED');

  if not found then
    raise exception 'Order not found, not yours, or not ready to mark delivered';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.seller_cancel_order(
  p_order_id uuid,
  p_seller_id text
) returns void as $$
begin
  update public.orders
  set status = 'CANCELLED', updated_at = now()
  where id = p_order_id
    and seller_id::text = p_seller_id::text
    and status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED')
    and (dispute_status is null or dispute_status = 'RESOLVED_DENIED');

  if not found then
    raise exception 'Order not found, not yours, or not in a cancellable state';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 3) Buyer receipt confirmation and dispute rules.
-- ---------------------------------------------------------------------
create or replace function public.confirm_order_delivery(
  p_order_id uuid,
  p_buyer_id text
) returns void as $$
begin
  -- DELIVERED is the website path. ESCROW_HELD and SHIPPED remain accepted
  -- for compatibility with older Android clients that had no preparation or
  -- separate delivery state; the website only exposes this after shipment.
  update public.orders
  set status = 'COMPLETED', updated_at = now()
  where id = p_order_id
    and buyer_id::text = p_buyer_id::text
    and status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED')
    and (dispute_status is null or dispute_status = 'RESOLVED_DENIED');

  if not found then
    raise exception 'Order not found, not yours, not delivered, or has an open dispute';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.report_order_dispute(
  p_order_id uuid,
  p_buyer_id text,
  p_reason text,
  p_description text,
  p_evidence_urls text[]
) returns uuid as $$
declare
  v_order public.orders%rowtype;
  v_dispute_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.buyer_id::text <> p_buyer_id::text then
    raise exception 'Not authorized';
  end if;
  if v_order.status not in ('SHIPPED', 'DELIVERED') then
    raise exception 'Order is not in a disputable state';
  end if;
  if v_order.dispute_status in ('REPORTED', 'UNDER_REVIEW') then
    raise exception 'This order already has an open dispute';
  end if;
  if p_reason not in ('NOT_RECEIVED', 'DAMAGED', 'FAKE_OR_COUNTERFEIT', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'OTHER') then
    raise exception 'Invalid dispute reason';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Dispute description is too short';
  end if;

  insert into public.order_disputes (order_id, buyer_id, reason, description, evidence_urls)
  values (p_order_id, p_buyer_id, p_reason, trim(p_description), coalesce(p_evidence_urls, '{}'))
  returning id into v_dispute_id;

  return v_dispute_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 4) Refund and payout effects remain idempotent and include preparation.
-- ---------------------------------------------------------------------
create or replace function public.apply_order_wallet_effects() returns trigger as $$
begin
  if new.status = 'CANCELLED'
     and old.status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED')
  then
    insert into public.wallet_ledger (user_id, type, amount, order_id, description)
    values (
      new.buyer_id,
      'ORDER_REFUND',
      (new.price * new.quantity) + new.escrow_fee,
      new.id,
      'অর্ডার বাতিল — রিফান্ড: ' || new.product_title
    );
  end if;

  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    insert into public.wallet_ledger (user_id, type, amount, order_id, description)
    values (
      new.seller_id,
      'SELLER_PAYOUT',
      new.price * new.quantity,
      new.id,
      'বিক্রয় সম্পন্ন — পেআউট: ' || new.product_title
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 5) Admin changes must follow the same lifecycle and be auditable.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  p_admin_id text,
  p_order_id uuid,
  p_status text
) returns void as $$
declare
  v_current text;
  v_valid boolean := false;
begin
  perform public.admin_assert(p_admin_id);

  select status into v_current from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_status = 'CANCELLED' and v_current in ('PENDING_PAYMENT', 'ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED') then
    v_valid := true;
  elsif (v_current = 'ESCROW_HELD' and p_status = 'PREPARING')
     or (v_current = 'PREPARING' and p_status = 'SHIPPED')
     or (v_current = 'SHIPPED' and p_status = 'DELIVERED')
     or (v_current = 'DELIVERED' and p_status = 'COMPLETED')
  then
    v_valid := true;
  end if;

  if not v_valid then
    raise exception 'Invalid order lifecycle transition: % -> %', v_current, p_status;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
  perform public.admin_log(p_admin_id, 'ORDER_STATUS_CHANGED', 'ORDER', p_order_id::text, jsonb_build_object('from', v_current, 'to', p_status));
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 6) Harden admin dispute resolution and record the decision.
-- ---------------------------------------------------------------------
create or replace function public.admin_resolve_dispute(
  p_admin_id text,
  p_dispute_id uuid,
  p_status text,
  p_resolution_note text
) returns void as $$
declare
  v_order_id uuid;
  v_current_status text;
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('UNDER_REVIEW', 'RESOLVED_REFUNDED', 'RESOLVED_DENIED') then
    raise exception 'Invalid dispute status';
  end if;

  select order_id, status into v_order_id, v_current_status
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then raise exception 'Dispute not found'; end if;
  if v_current_status in ('RESOLVED_REFUNDED', 'RESOLVED_DENIED') then
    raise exception 'Dispute is already resolved';
  end if;

  update public.order_disputes
  set status = p_status, resolution_note = nullif(trim(coalesce(p_resolution_note, '')), '')
  where id = p_dispute_id;

  update public.orders
  set dispute_status = p_status
  where id = v_order_id;

  if p_status = 'RESOLVED_REFUNDED' then
    update public.orders
    set status = 'CANCELLED', updated_at = now()
    where id = v_order_id and status in ('SHIPPED', 'DELIVERED');
  end if;

  if p_resolution_note is not null and length(trim(p_resolution_note)) > 0 then
    perform public.send_dispute_message(p_dispute_id, p_admin_id, trim(p_resolution_note));
  end if;

  perform public.admin_log(p_admin_id, 'DISPUTE_RESOLVED', 'ORDER_DISPUTE', p_dispute_id::text, jsonb_build_object('status', p_status, 'order_id', v_order_id));
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 7) Block direct client-side state changes. RPCs/service-role webhook only.
-- ---------------------------------------------------------------------
drop policy if exists "Buyer or seller can update order status" on public.orders;
drop policy if exists "Order status changes go through the RPC functions above" on public.orders;
create policy "Order status changes use lifecycle RPCs"
  on public.orders for update using (false) with check (false);

drop policy if exists "Disputes can be updated when resolving" on public.order_disputes;
create policy "Dispute status changes use dispute RPCs"
  on public.order_disputes for update using (false) with check (false);

-- The website uses the validated RPC below. Keep a compatibility policy for
-- older Android clients, but require the review row to match a completed order.
drop policy if exists "Buyers can insert their own review" on public.reviews;
drop policy if exists "Reviews use completed-order RPC" on public.reviews;
create policy "Reviews require a completed matching order"
  on public.reviews for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id::text = order_id::text
        and o.status = 'COMPLETED'
        and o.buyer_id::text = buyer_id::text
        and o.product_id::text = product_id::text
        and o.seller_id::text = seller_id::text
    )
  );

-- ---------------------------------------------------------------------
-- 8) Enforce one review per completed order at the database boundary.
-- ---------------------------------------------------------------------
create or replace function public.submit_order_review(
  p_review_id text,
  p_order_id uuid,
  p_product_id text,
  p_seller_id text,
  p_buyer_id text,
  p_buyer_name text,
  p_rating integer,
  p_comment text
) returns void as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;

  if not found or v_order.buyer_id::text <> p_buyer_id::text then
    raise exception 'Not authorized to review this order';
  end if;
  if v_order.status <> 'COMPLETED' then
    raise exception 'Only completed orders can be reviewed';
  end if;
  if v_order.product_id::text <> p_product_id::text or v_order.seller_id::text <> p_seller_id::text then
    raise exception 'Review details do not match the order';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  insert into public.reviews (id, order_id, product_id, product_title, seller_id, buyer_id, buyer_name, rating, comment)
  values (
    p_review_id,
    p_order_id::text,
    p_product_id,
    v_order.product_title,
    p_seller_id,
    p_buyer_id,
    coalesce(p_buyer_name, ''),
    p_rating,
    trim(coalesce(p_comment, ''))
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 9) Role-aware notifications for every lifecycle state.
-- ---------------------------------------------------------------------
create or replace function public.notify_order_change() returns trigger as $$
declare
  v_buyer_title text;
  v_seller_title text;
  v_body text := 'অর্ডার: ' || new.product_title;
  v_link text := '/orders/' || new.id::text;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    v_buyer_title := case new.status
      when 'PENDING_PAYMENT' then 'পেমেন্ট সম্পন্ন করুন'
      when 'ESCROW_HELD' then 'পেমেন্ট সফল হয়েছে'
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
      when 'PREPARING' then 'অর্ডার প্রস্তুত করুন'
      when 'SHIPPED' then 'অর্ডার শিপড হয়েছে'
      when 'DELIVERED' then 'অর্ডার পৌঁছেছে — buyer confirmation অপেক্ষায়'
      when 'COMPLETED' then 'বিক্রয় সম্পন্ন হয়েছে'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    insert into public.notifications(user_id, type, title, body, link)
    values (new.buyer_id, 'ORDER', v_buyer_title, v_body, v_link);

    if new.seller_id::text <> new.buyer_id::text then
      insert into public.notifications(user_id, type, title, body, link)
      values (new.seller_id, 'ORDER', v_seller_title, v_body, v_link);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
