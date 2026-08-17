-- =====================================================================
-- BikriKoro — UddoktaPay payment gateway (website-only, Bangladesh-only)
-- =====================================================================
-- Scope decision: BikriKoro now targets Bangladesh only, so this and
-- everything downstream assumes BDT — no multi-currency/multi-country
-- logic (unlike the old Lovable-era site).
--
-- Same rule as the wallet system: real payment capture stays OUT of the
-- Android app entirely, for the same Google Play personal-account policy
-- reason. This is why there are now TWO order-creation paths:
--
--   - create_order_atomic() (009_tier1_...sql) — Android only. Places an
--     order straight into ESCROW_HELD, no gateway involved (unchanged).
--   - create_order_pending_payment() (this file) — website only. Places
--     an order as PENDING_PAYMENT; it only becomes ESCROW_HELD once the
--     uddoktapay-webhook Edge Function confirms a real, verified payment.
--
-- The UddoktaPay API key itself never appears anywhere in this
-- repository or in any client bundle — see supabase/functions/
-- uddoktapay-create-charge and uddoktapay-webhook, which hold it as a
-- Supabase Edge Function secret.
-- =====================================================================

-- ---------------------------------------------------------------------
-- orders.payment_method was `not null check (in ('BKASH','NAGAD','CARD',
-- 'CASH_ON_MEETUP'))` (001_init.sql) — those are Android's manual labels.
-- A website order now starts with no payment method at all (the buyer
-- hasn't reached UddoktaPay's hosted page yet) and gets one of UddoktaPay's
-- own method names once the webhook confirms payment — normalized to
-- uppercase in the webhook function so both sides stay consistent.
-- ---------------------------------------------------------------------
alter table orders alter column payment_method drop not null;
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
    check (payment_method is null or payment_method in
        ('BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'CARD', 'CASH_ON_MEETUP'));

create table if not exists payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id),
    invoice_id text not null unique,          -- UddoktaPay's invoice_id — unique guards against double-processing a webhook retry
    amount numeric(12,2) not null,
    fee numeric(12,2) not null default 0,
    payment_method text,                       -- bkash / nagad / rocket / upay, filled in from the webhook payload
    sender_number text,
    transaction_id text,
    status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'INVALID')),
    raw_payload jsonb,                         -- full webhook body, kept for support/audit
    created_at timestamptz not null default now()
);

create index if not exists idx_payments_order on payments(order_id);

alter table payments enable row level security;

create policy "Users can read payments for their own orders"
    on payments for select
    using (true); -- app scopes to "your own order" at the repository layer, same as elsewhere

-- Only the uddoktapay-webhook Edge Function writes here, using the
-- service_role key (which bypasses RLS outright) — never the browser.
create policy "Payments are written by the webhook function only"
    on payments for insert
    with check (false);
create policy "Payments are updated by the webhook function only"
    on payments for update
    using (false) with check (false);

alter publication supabase_realtime add table payments;

-- ---------------------------------------------------------------------
-- create_order_pending_payment — website checkout, step 1 of 2
-- ---------------------------------------------------------------------
create or replace function create_order_pending_payment(
    p_product_id uuid,
    p_buyer_id text,
    p_delivery_address text
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
        v_product.seller_id, p_buyer_id, p_delivery_address, null,
        'PENDING_PAYMENT', v_escrow_fee
    )
    returning id into v_order_id;

    return v_order_id;
end;
$$ language plpgsql security definer;

-- A PENDING_PAYMENT order the buyer abandons at UddoktaPay's checkout
-- (closed the tab, payment failed) should be cancellable so it doesn't
-- sit forever — no wallet refund applies since no payment ever landed
-- (apply_order_wallet_effects only fires for ESCROW_HELD/SHIPPED/DELIVERED -> CANCELLED).
create or replace function buyer_cancel_pending_order(p_order_id uuid, p_buyer_id text) returns void as $$
begin
    update orders
    set status = 'CANCELLED', updated_at = now()
    where id = p_order_id and buyer_id = p_buyer_id and status = 'PENDING_PAYMENT';

    if not found then
        raise exception 'Order not found, not yours, or payment already in progress';
    end if;
end;
$$ language plpgsql security definer;
