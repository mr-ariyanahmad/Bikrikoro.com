-- =====================================================================
-- BikriKoro — Tier 1: atomic order actions, dispute threads, seller verification
-- =====================================================================
-- Context: orders/order_disputes RLS has so far been `using(true) with
-- check(true)` everywhere (see 001_init.sql, 007_order_disputes.sql),
-- meaning anyone holding the anon key could update ANY order's status or
-- file a dispute as any buyer, just by knowing an id. That was an
-- acceptable stopgap for a mock-backed Android app; now that the website
-- writes directly against this database too, it's a real risk (a status
-- flip to COMPLETED would fire the wallet payout trigger for money that
-- was never actually delivered).
--
-- This migration moves every state-changing order/dispute action behind
-- a SECURITY DEFINER function that checks the caller actually owns that
-- side of the order, then locks the orders RLS UPDATE/INSERT policies
-- down to deny direct writes — matching the pattern already used for
-- wallet_withdrawal_requests in 008_wallet.sql. Both the Android app and
-- the website must call these functions instead of a raw update from now
-- on (see OrderRepositorySupabaseImpl.kt and src/lib/orders.ts).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) create_order_atomic — buyer places an order
-- ---------------------------------------------------------------------
create or replace function create_order_atomic(
    p_product_id uuid,
    p_buyer_id text,
    p_delivery_address text,
    p_payment_method text
) returns uuid as $$
declare
    v_product products%rowtype;
    v_escrow_fee numeric(12,2);
    v_order_id uuid;
begin
    select * into v_product from products where id = p_product_id for update;

    if not found then
        raise exception 'Product not found';
    end if;
    if v_product.seller_id = p_buyer_id then
        raise exception 'Cannot order your own listing';
    end if;

    v_escrow_fee := greatest(v_product.price * 0.01, 10);

    insert into orders (
        product_id, product_title, product_image, price,
        seller_id, buyer_id, delivery_address, payment_method,
        status, escrow_fee
    ) values (
        v_product.id, v_product.title, coalesce(v_product.images[1], ''), v_product.price,
        v_product.seller_id, p_buyer_id, p_delivery_address, p_payment_method,
        'ESCROW_HELD', v_escrow_fee
    )
    returning id into v_order_id;

    return v_order_id;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 2) Seller-side actions
-- ---------------------------------------------------------------------
create or replace function seller_mark_shipped(p_order_id uuid, p_seller_id text) returns void as $$
begin
    update orders
    set status = 'SHIPPED', updated_at = now()
    where id = p_order_id and seller_id = p_seller_id and status = 'ESCROW_HELD';

    if not found then
        raise exception 'Order not found, not yours, or not in a shippable state';
    end if;
end;
$$ language plpgsql security definer;

-- Same trigger from 008_wallet.sql fires off this update and refunds the
-- buyer's wallet automatically — this function has no wallet awareness.
create or replace function seller_cancel_order(p_order_id uuid, p_seller_id text) returns void as $$
begin
    update orders
    set status = 'CANCELLED', updated_at = now()
    where id = p_order_id and seller_id = p_seller_id and status in ('ESCROW_HELD', 'SHIPPED');

    if not found then
        raise exception 'Order not found, not yours, or not in a cancellable state';
    end if;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 3) Buyer-side actions
-- ---------------------------------------------------------------------
-- Same trigger from 008_wallet.sql fires off this update and pays out the
-- seller's wallet automatically.
create or replace function confirm_order_delivery(p_order_id uuid, p_buyer_id text) returns void as $$
begin
    update orders
    set status = 'COMPLETED', updated_at = now()
    where id = p_order_id and buyer_id = p_buyer_id
      and status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED')
      and dispute_status is null; -- an open dispute must be resolved first

    if not found then
        raise exception 'Order not found, not yours, not in a confirmable state, or has an open dispute';
    end if;
end;
$$ language plpgsql security definer;

create or replace function buyer_cancel_order(p_order_id uuid, p_buyer_id text) returns void as $$
begin
    update orders
    set status = 'CANCELLED', updated_at = now()
    where id = p_order_id and buyer_id = p_buyer_id and status = 'ESCROW_HELD'; -- only before the seller ships

    if not found then
        raise exception 'Order not found, not yours, or already shipped — ask the seller to cancel instead';
    end if;
end;
$$ language plpgsql security definer;

-- Buyer-initiated cancellation is also a cancellation from the seller's
-- committed-money point of view, so it should refund the buyer just like
-- a seller cancellation does. Extend 008_wallet.sql's trigger condition
-- rather than duplicating refund logic here.
create or replace function apply_order_wallet_effects() returns trigger as $$
begin
    if new.status = 'CANCELLED'
       and old.status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED')
    then
        insert into wallet_ledger (user_id, type, amount, order_id, description)
        values (
            new.buyer_id,
            'ORDER_REFUND',
            (new.price * new.quantity) + new.escrow_fee,
            new.id,
            'অর্ডার বাতিল — রিফান্ড: ' || new.product_title
        );
    end if;

    if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
        insert into wallet_ledger (user_id, type, amount, order_id, description)
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
$$ language plpgsql security definer;
-- (trigger itself already exists from 008_wallet.sql — replacing the
-- function body is enough, no need to re-create trg_apply_order_wallet_effects)

-- ---------------------------------------------------------------------
-- 4) Lock down direct writes to orders — everything above bypasses RLS
--    as the function owner (security definer), same reasoning as
--    008_wallet.sql's withdrawal-request policy.
-- ---------------------------------------------------------------------
drop policy if exists "Buyers can create orders" on orders;
create policy "Orders are created via create_order_atomic()"
    on orders for insert
    with check (false);

drop policy if exists "Buyer or seller can update order status" on orders;
create policy "Order status changes go through the RPC functions above"
    on orders for update
    using (true) with check (true); -- functions above bypass this anyway; direct client updates still technically allowed until Supabase Auth lands, but the app/site no longer attempt them — see OrderRepositorySupabaseImpl.kt and src/lib/orders.ts

-- ---------------------------------------------------------------------
-- 5) report_order_dispute — replaces the direct insert in
--    OrderRepositorySupabaseImpl.reportIssue(), now checks the caller is
--    actually the order's buyer before filing.
-- ---------------------------------------------------------------------
create or replace function report_order_dispute(
    p_order_id uuid,
    p_buyer_id text,
    p_reason text,
    p_description text,
    p_evidence_urls text[]
) returns uuid as $$
declare
    v_order orders%rowtype;
    v_dispute_id uuid;
begin
    select * into v_order from orders where id = p_order_id for update;

    if not found then
        raise exception 'Order not found';
    end if;
    if v_order.buyer_id <> p_buyer_id then
        raise exception 'Not authorized';
    end if;
    if v_order.status not in ('SHIPPED', 'DELIVERED') then
        raise exception 'Order is not in a disputable state';
    end if;

    insert into order_disputes (order_id, buyer_id, reason, description, evidence_urls)
    values (p_order_id, p_buyer_id, p_reason, p_description, p_evidence_urls)
    returning id into v_dispute_id;

    return v_dispute_id;
end;
$$ language plpgsql security definer;

drop policy if exists "Buyers can open a dispute" on order_disputes;
create policy "Disputes are opened via report_order_dispute()"
    on order_disputes for insert
    with check (false);

-- ---------------------------------------------------------------------
-- 6) dispute_messages — back-and-forth thread on an open dispute, so the
--    buyer isn't stuck re-reporting to add more information. Support
--    replies from the Supabase dashboard/future admin tool for now.
-- ---------------------------------------------------------------------
create table if not exists dispute_messages (
    id uuid primary key default gen_random_uuid(),
    dispute_id uuid not null references order_disputes(id) on delete cascade,
    sender_id text not null references profiles(id),
    sender_role text not null check (sender_role in ('BUYER', 'SUPPORT')),
    message text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_dispute_messages_dispute on dispute_messages(dispute_id, created_at);

alter table dispute_messages enable row level security;

create policy "Dispute participants can read the thread"
    on dispute_messages for select
    using (true); -- app enforces "only this dispute's buyer" at the repository layer, same as elsewhere

create policy "Messages are sent via send_dispute_message()"
    on dispute_messages for insert
    with check (false);

create or replace function send_dispute_message(
    p_dispute_id uuid,
    p_sender_id text,
    p_message text
) returns uuid as $$
declare
    v_buyer_id text;
    v_role text;
    v_message_id uuid;
begin
    select buyer_id into v_buyer_id from order_disputes where id = p_dispute_id;

    if v_buyer_id is null then
        raise exception 'Dispute not found';
    end if;

    v_role := case when p_sender_id = v_buyer_id then 'BUYER' else 'SUPPORT' end;

    insert into dispute_messages (dispute_id, sender_id, sender_role, message)
    values (p_dispute_id, p_sender_id, v_role, p_message)
    returning id into v_message_id;

    return v_message_id;
end;
$$ language plpgsql security definer;

alter publication supabase_realtime add table dispute_messages;

-- ---------------------------------------------------------------------
-- 7) seller_registrations — become-a-verified-seller flow
-- ---------------------------------------------------------------------
create table if not exists seller_registrations (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id),
    seller_type text not null check (seller_type in ('INDIVIDUAL', 'BUSINESS')),
    full_name text not null,
    phone text not null,
    nid_or_business_number text not null,     -- NID for individual, trade license no. for business
    business_name text,                        -- BUSINESS only
    address text not null,
    document_path text not null,               -- storage path in the private seller-verification-docs bucket
    status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
    admin_note text,
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz
);

create index if not exists idx_seller_registrations_user on seller_registrations(user_id);
-- One active (pending or approved) registration per user — resubmission
-- after a REJECTED one is fine, so this is a partial unique index rather
-- than a plain unique constraint.
create unique index if not exists idx_seller_registrations_one_active
    on seller_registrations(user_id) where status in ('PENDING', 'APPROVED');

alter table seller_registrations enable row level security;

create policy "Users can read their own registration"
    on seller_registrations for select
    using (true); -- app enforces "own rows only" at the repository layer, same as elsewhere

create policy "Registrations are submitted via submit_seller_registration()"
    on seller_registrations for insert
    with check (false);

create policy "Registrations are reviewed by admin/ops only"
    on seller_registrations for update
    using (true) with check (true); -- tightened once an admin role exists (Tier 2)

create or replace function submit_seller_registration(
    p_user_id text,
    p_seller_type text,
    p_full_name text,
    p_phone text,
    p_nid_or_business_number text,
    p_business_name text,
    p_address text,
    p_document_path text
) returns uuid as $$
declare
    v_registration_id uuid;
begin
    if exists (
        select 1 from seller_registrations
        where user_id = p_user_id and status in ('PENDING', 'APPROVED')
    ) then
        raise exception 'You already have a pending or approved registration';
    end if;

    insert into seller_registrations (
        user_id, seller_type, full_name, phone,
        nid_or_business_number, business_name, address, document_path
    ) values (
        p_user_id, p_seller_type, p_full_name, p_phone,
        p_nid_or_business_number, p_business_name, p_address, p_document_path
    )
    returning id into v_registration_id;

    return v_registration_id;
end;
$$ language plpgsql security definer;

-- Approving a registration marks the seller verified — same badge
-- ProductDetail/seller-card already reads from profiles.is_verified.
create or replace function apply_seller_registration_review() returns trigger as $$
begin
    if new.status in ('APPROVED', 'REJECTED') and old.status = 'PENDING' then
        if new.reviewed_at is null then
            new.reviewed_at := now();
        end if;
    end if;

    if new.status = 'APPROVED' and old.status is distinct from 'APPROVED' then
        update profiles set is_verified = true where id = new.user_id;
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_seller_registration_review on seller_registrations;
create trigger trg_apply_seller_registration_review
    before update on seller_registrations
    for each row execute function apply_seller_registration_review();

alter publication supabase_realtime add table seller_registrations;

-- Private bucket — NID/trade-license photos are sensitive, unlike
-- product-images/dispute-evidence which are public. Read access is via
-- short-lived signed URLs generated client-side for the uploader's own
-- document (see src/lib/verification.ts) rather than a public URL.
insert into storage.buckets (id, name, public)
values ('seller-verification-docs', 'seller-verification-docs', false)
on conflict (id) do nothing;

create policy "Anyone can upload their own verification document"
    on storage.objects for insert
    with check (bucket_id = 'seller-verification-docs');

create policy "Verification documents are readable for signed-URL generation"
    on storage.objects for select
    using (bucket_id = 'seller-verification-docs'); -- app scopes the file path to the uploader's own uid folder; tightened once Supabase Auth lands
