-- BikriKoro: replace the customer wallet surface with saved payment accounts.
-- Accounts are server-only because they contain payout/refund destinations.

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('BKASH', 'NAGAD', 'ROCKET', 'UPAY')),
  purpose text not null check (purpose in ('SELLER_RECEIVE', 'BUYER_REFUND')),
  transaction_type text not null default 'CASH_OUT' check (transaction_type in ('CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'PAYMENT')),
  account_type text not null default 'PERSONAL' check (account_type in ('PERSONAL', 'MERCHANT')),
  account_number text not null,
  account_holder_name text,
  merchant_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_accounts_user_purpose
  on public.payment_accounts(user_id, purpose, created_at desc);
create unique index if not exists uq_payment_accounts_one_default
  on public.payment_accounts(user_id, purpose)
  where is_default = true;

alter table public.orders add column if not exists seller_payment_account_id uuid references public.payment_accounts(id) on delete set null;
alter table public.orders add column if not exists buyer_refund_account_id uuid references public.payment_accounts(id) on delete set null;
alter table public.orders add column if not exists seller_payment_account_snapshot jsonb;
alter table public.orders add column if not exists buyer_refund_account_snapshot jsonb;

alter table public.payment_accounts enable row level security;
drop policy if exists "Payment accounts are server-only" on public.payment_accounts;
create policy "Payment accounts are server-only"
  on public.payment_accounts for all using (false) with check (false);
revoke all on table public.payment_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.payment_accounts to service_role;

create or replace function public.payment_account_snapshot(p_account_id uuid, p_user_id text, p_purpose text)
returns jsonb as $$
declare
  v_account public.payment_accounts%rowtype;
begin
  select * into v_account
  from public.payment_accounts
  where id = p_account_id and user_id = p_user_id and purpose = p_purpose
  for share;
  if not found then raise exception 'Payment account not found or not yours'; end if;
  return jsonb_build_object(
    'id', v_account.id,
    'provider', v_account.provider,
    'purpose', v_account.purpose,
    'transaction_type', v_account.transaction_type,
    'account_type', v_account.account_type,
    'account_number', v_account.account_number,
    'account_holder_name', v_account.account_holder_name,
    'merchant_name', v_account.merchant_name
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.enforce_payment_accounts_on_product()
returns trigger as $$
begin
  if not exists (
    select 1 from public.payment_accounts
    where user_id = new.seller_id and purpose = 'SELLER_RECEIVE' and is_default = true
  ) then
    raise exception 'SELLER_PAYMENT_ACCOUNT_REQUIRED';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_products_require_payment_account on public.products;
create trigger trg_products_require_payment_account
before insert on public.products
for each row execute function public.enforce_payment_accounts_on_product();

create or replace function public.enforce_payment_accounts_on_order()
returns trigger as $$
declare
  v_seller_account public.payment_accounts%rowtype;
  v_buyer_account public.payment_accounts%rowtype;
begin
  if new.status = 'PENDING_PAYMENT' then
    select * into v_seller_account from public.payment_accounts
    where user_id = new.seller_id and purpose = 'SELLER_RECEIVE' and is_default = true
    limit 1;
    if not found then raise exception 'SELLER_PAYMENT_ACCOUNT_REQUIRED'; end if;

    select * into v_buyer_account from public.payment_accounts
    where user_id = new.buyer_id and purpose = 'BUYER_REFUND' and is_default = true
    limit 1;
    if not found then raise exception 'BUYER_REFUND_ACCOUNT_REQUIRED'; end if;

    new.seller_payment_account_id := v_seller_account.id;
    new.buyer_refund_account_id := v_buyer_account.id;
    new.seller_payment_account_snapshot := jsonb_build_object(
      'id', v_seller_account.id,
      'provider', v_seller_account.provider,
      'purpose', v_seller_account.purpose,
      'transaction_type', v_seller_account.transaction_type,
      'account_type', v_seller_account.account_type,
      'account_number', v_seller_account.account_number,
      'account_holder_name', v_seller_account.account_holder_name,
      'merchant_name', v_seller_account.merchant_name
    );
    new.buyer_refund_account_snapshot := jsonb_build_object(
      'id', v_buyer_account.id,
      'provider', v_buyer_account.provider,
      'purpose', v_buyer_account.purpose,
      'transaction_type', v_buyer_account.transaction_type,
      'account_type', v_buyer_account.account_type,
      'account_number', v_buyer_account.account_number,
      'account_holder_name', v_buyer_account.account_holder_name,
      'merchant_name', v_buyer_account.merchant_name
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_orders_snapshot_payment_accounts on public.orders;
create trigger trg_orders_snapshot_payment_accounts
before insert on public.orders
for each row execute function public.enforce_payment_accounts_on_order();

revoke all on function public.payment_account_snapshot(uuid, text, text) from public, anon, authenticated;
grant execute on function public.payment_account_snapshot(uuid, text, text) to service_role;
revoke all on function public.enforce_payment_accounts_on_product() from public, anon, authenticated;
revoke all on function public.enforce_payment_accounts_on_order() from public, anon, authenticated;

comment on table public.payment_accounts is 'Server-only saved bKash, Nagad, Rocket, or Upay destinations for seller receipts and buyer refunds.';
comment on column public.orders.seller_payment_account_snapshot is 'Immutable seller payout destination captured when the order is created.';
comment on column public.orders.buyer_refund_account_snapshot is 'Immutable buyer refund destination captured when the order is created.';
