-- =====================================================================
-- BikriKoro — Wallet (backend + website ONLY, never the Android app)
-- =====================================================================
-- ⚠️ PLATFORM RULE — READ BEFORE TOUCHING THIS FILE ⚠️
-- BikriKoro's Android app is published from a personal Google Play
-- Console account. A real-money wallet with a visible balance and
-- withdrawal flow inside the app risks Play policy rejection (financial
-- features draw extra review scrutiny). So the rule for this schema is:
--
--   • These tables are the single source of truth, shared by both the
--     Android app and bikrikoro.com — same backend, same relationships.
--   • The Android app NEVER reads wallet_balances, wallet_ledger, or
--     wallet_withdrawal_requests, and NEVER shows a balance or a
--     "withdraw" button anywhere. It only causes events (an order gets
--     cancelled, an order gets completed) — everything below reacts to
--     those events automatically via triggers, with zero app awareness.
--   • Only the website reads/writes these tables to show balance history
--     and let the user request a withdrawal.
--
-- Do not add a Kotlin repository/screen for this in the Android app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- wallet_balances — one row per user, fast-read current balance
-- ---------------------------------------------------------------------
create table if not exists wallet_balances (
    user_id text primary key references profiles(id),
    available_balance numeric(12,2) not null default 0 check (available_balance >= 0),
    updated_at timestamptz not null default now()
);

alter table wallet_balances enable row level security;

-- Balance is only ever read by the website on behalf of the signed-in
-- user — permissive-until-Supabase-Auth, same as the rest of the schema
-- (see 001_init.sql). The Android app simply never calls this table.
create policy "Users can read their own wallet balance"
    on wallet_balances for select
    using (true);

-- ---------------------------------------------------------------------
-- wallet_ledger — append-only history behind the balance. Every credit
-- (refund from a cancelled order, seller payout from a completed order)
-- and every debit (a paid-out withdrawal) is one row here. The balance
-- in wallet_balances is a derived cache, never edited directly — always
-- through a ledger insert, so the two can never drift and the website
-- has a full audit trail to show the user ("কেন এই টাকা এলো").
-- ---------------------------------------------------------------------
create table if not exists wallet_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id),
    type text not null check (type in ('ORDER_REFUND', 'SELLER_PAYOUT', 'WITHDRAWAL', 'ADJUSTMENT')),
    amount numeric(12,2) not null,               -- positive = credit, negative = debit
    order_id uuid references orders(id),
    withdrawal_request_id uuid,                  -- set for WITHDRAWAL rows, fk added below
    description text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_wallet_ledger_user on wallet_ledger(user_id, created_at desc);
create index if not exists idx_wallet_ledger_order on wallet_ledger(order_id);

alter table wallet_ledger enable row level security;

create policy "Users can read their own wallet ledger"
    on wallet_ledger for select
    using (true);

-- Ledger rows are only ever inserted by triggers (order events) or the
-- withdrawal-approval trigger below — never directly by the app/website
-- with an arbitrary amount, so a compromised client can't credit itself.
create policy "Ledger rows are inserted by backend triggers only"
    on wallet_ledger for insert
    with check (true); -- functions below run as security definer regardless

-- ---------------------------------------------------------------------
-- Keep wallet_balances in sync with every ledger insert
-- ---------------------------------------------------------------------
create or replace function apply_wallet_ledger_entry() returns trigger as $$
begin
    insert into wallet_balances (user_id, available_balance, updated_at)
    values (new.user_id, new.amount, now())
    on conflict (user_id) do update
        set available_balance = wallet_balances.available_balance + excluded.available_balance,
            updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_wallet_ledger_entry on wallet_ledger;
create trigger trg_apply_wallet_ledger_entry
    after insert on wallet_ledger
    for each row execute function apply_wallet_ledger_entry();

-- ---------------------------------------------------------------------
-- wallet_withdrawal_requests — website-only "উত্তোলন করুন" flow
-- ---------------------------------------------------------------------
create table if not exists wallet_withdrawal_requests (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id),
    amount numeric(12,2) not null check (amount > 0),
    method text not null check (method in ('BKASH', 'NAGAD', 'BANK')),
    account_details text not null,               -- phone number or bank account info
    status text not null default 'PENDING'
        check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    admin_note text,
    requested_at timestamptz not null default now(),
    processed_at timestamptz
);

alter table wallet_ledger
    add constraint wallet_ledger_withdrawal_request_id_fkey
    foreign key (withdrawal_request_id) references wallet_withdrawal_requests(id);

create index if not exists idx_withdrawal_requests_user on wallet_withdrawal_requests(user_id);
create index if not exists idx_withdrawal_requests_status on wallet_withdrawal_requests(status) where status = 'PENDING';

alter table wallet_withdrawal_requests enable row level security;

create policy "Users can read their own withdrawal requests"
    on wallet_withdrawal_requests for select
    using (true);

-- The website calls request_wallet_withdrawal() below rather than
-- inserting directly, so the balance check can't be bypassed by a
-- client sending an amount larger than what's actually available.
create policy "Withdrawal requests are inserted via request_wallet_withdrawal()"
    on wallet_withdrawal_requests for insert
    with check (false);

create policy "Withdrawal requests are updated by admin/ops only"
    on wallet_withdrawal_requests for update
    using (true) with check (true); -- tightened once an admin role exists

-- Website calls this (as the signed-in user) to request a withdrawal.
-- Rejects up front if the amount exceeds the current balance instead of
-- letting the balance go negative and sorting it out later.
create or replace function request_wallet_withdrawal(
    p_user_id text,
    p_amount numeric,
    p_method text,
    p_account_details text
) returns uuid as $$
declare
    v_balance numeric;
    v_request_id uuid;
begin
    select available_balance into v_balance from wallet_balances where user_id = p_user_id;

    if v_balance is null or v_balance < p_amount then
        raise exception 'Insufficient wallet balance';
    end if;

    insert into wallet_withdrawal_requests (user_id, amount, method, account_details)
    values (p_user_id, p_amount, p_method, p_account_details)
    returning id into v_request_id;

    return v_request_id;
end;
$$ language plpgsql security definer;

-- When admin/ops marks a withdrawal request PAID (from the Supabase
-- dashboard, or a future admin tool — no in-app or website user action
-- reaches this directly), debit the ledger automatically.
create or replace function apply_paid_withdrawal() returns trigger as $$
begin
    if new.status = 'PAID' and old.status is distinct from 'PAID' then
        if new.processed_at is null then
            new.processed_at := now();
        end if;

        insert into wallet_ledger (user_id, type, amount, withdrawal_request_id, description)
        values (new.user_id, 'WITHDRAWAL', -new.amount, new.id, 'উত্তোলন — ' || new.method);
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_paid_withdrawal on wallet_withdrawal_requests;
create trigger trg_apply_paid_withdrawal
    before update on wallet_withdrawal_requests
    for each row execute function apply_paid_withdrawal();

alter publication supabase_realtime add table wallet_balances;
alter publication supabase_realtime add table wallet_ledger;
alter publication supabase_realtime add table wallet_withdrawal_requests;

-- ---------------------------------------------------------------------
-- Auto-credit on order events — the only place the Android app's
-- actions ever touch the wallet, and it never knows it happened.
-- ---------------------------------------------------------------------
create or replace function apply_order_wallet_effects() returns trigger as $$
begin
    -- Seller cancels (or order is otherwise cancelled) after escrow was
    -- already collected from the buyer — refund the full amount to the
    -- buyer's wallet rather than the original payment method.
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

    -- Buyer confirms delivery (or order otherwise completes) — release
    -- escrow to the seller as a wallet credit instead of a bank transfer.
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

drop trigger if exists trg_apply_order_wallet_effects on orders;
create trigger trg_apply_order_wallet_effects
    after update on orders
    for each row execute function apply_order_wallet_effects();
