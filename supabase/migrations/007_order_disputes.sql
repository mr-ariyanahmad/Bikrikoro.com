-- =====================================================================
-- BikriKoro — Order disputes (buyer "report a problem" flow)
-- =====================================================================
-- Backs OrderRepositorySupabaseImpl.reportIssue() and the ReportIssueScreen
-- UI. A dispute is deliberately modeled as its own table rather than
-- extra columns on `orders`, because one order can in principle be
-- reported more than once (buyer adds more evidence, reports a second
-- issue after the first was denied, etc) and support needs the full
-- history — `orders.dispute_status` is just a fast-read snapshot of the
-- MOST RECENT dispute row, kept in sync by the trigger below the same way
-- 005_reviews.sql keeps profiles.rating in sync from the reviews table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- orders.dispute_status — snapshot column read by OrderDto/Order.kt
-- ---------------------------------------------------------------------
alter table orders
    add column if not exists dispute_status text
        check (dispute_status is null or dispute_status in
            ('REPORTED', 'UNDER_REVIEW', 'RESOLVED_REFUNDED', 'RESOLVED_DENIED'));

-- ---------------------------------------------------------------------
-- order_disputes
-- ---------------------------------------------------------------------
create table if not exists order_disputes (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    buyer_id text not null references profiles(id),
    reason text not null check (reason in
        ('NOT_RECEIVED', 'DAMAGED', 'FAKE_OR_COUNTERFEIT', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'OTHER')),
    description text not null default '',
    evidence_urls text[] not null default '{}',
    status text not null default 'REPORTED'
        check (status in ('REPORTED', 'UNDER_REVIEW', 'RESOLVED_REFUNDED', 'RESOLVED_DENIED')),
    resolution_note text,                       -- support's note when resolving, shown to buyer later
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create index if not exists idx_disputes_order on order_disputes(order_id);
create index if not exists idx_disputes_buyer on order_disputes(buyer_id);
create index if not exists idx_disputes_status on order_disputes(status) where status in ('REPORTED', 'UNDER_REVIEW');

alter table order_disputes enable row level security;

-- Same permissive-until-Supabase-Auth pattern as the rest of the schema
-- (see 001_init.sql) — the app enforces "only the buyer of this order can
-- report it" at the repository layer for now.
create policy "Buyer or seller can read a dispute on their order"
    on order_disputes for select
    using (true);

create policy "Buyers can open a dispute"
    on order_disputes for insert
    with check (true);

-- Support/ops update status + resolution_note from the Supabase dashboard
-- (or a future admin tool) — no in-app UI writes here yet.
create policy "Disputes can be updated when resolving"
    on order_disputes for update
    using (true) with check (true);

-- ---------------------------------------------------------------------
-- Keep orders.dispute_status in sync with the latest dispute row,
-- and stamp resolved_at automatically when status leaves REPORTED/
-- UNDER_REVIEW — mirrors 005_reviews.sql's refresh_seller_rating trigger.
-- ---------------------------------------------------------------------
create or replace function refresh_order_dispute_status() returns trigger as $$
begin
    if new.status in ('RESOLVED_REFUNDED', 'RESOLVED_DENIED') and new.resolved_at is null then
        new.resolved_at := now();
    end if;

    update orders
    set dispute_status = new.status
    where id = new.order_id;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_refresh_order_dispute_status on order_disputes;
create trigger trg_refresh_order_dispute_status
    before insert or update on order_disputes
    for each row execute function refresh_order_dispute_status();

-- Enable Realtime so a buyer sitting on Order Detail sees the status
-- banner update live the moment support resolves the dispute, the same
-- way orders' own status changes push live via observeOrder().
alter publication supabase_realtime add table order_disputes;

-- ---------------------------------------------------------------------
-- Storage bucket for evidence photos (SupabaseStorageHelper.uploadDisputeEvidence)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', true)
on conflict (id) do nothing;

create policy "Dispute evidence is publicly readable"
    on storage.objects for select
    using (bucket_id = 'dispute-evidence');

create policy "Anyone can upload dispute evidence"
    on storage.objects for insert
    with check (bucket_id = 'dispute-evidence');
