-- =====================================================================
-- BikriKoro — Reviews & Ratings
-- =====================================================================
-- One review per completed order. A trigger keeps `profiles.rating` /
-- `profiles.review_count` in sync automatically on insert, so the app
-- never has to compute an average client-side or risk it drifting from
-- the actual review rows.
-- =====================================================================

create table if not exists reviews (
    id text primary key,
    order_id text not null unique,             -- one review per order
    product_id text not null,
    product_title text not null,
    seller_id text not null references profiles(id),
    buyer_id text not null,
    buyer_name text not null default '',
    rating integer not null check (rating between 1 and 5),
    comment text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_reviews_seller_id on reviews (seller_id);
create index if not exists idx_reviews_order_id on reviews (order_id);

alter table reviews enable row level security;

create policy "Reviews are publicly readable"
    on reviews for select
    using (true);

-- Same permissive-until-Supabase-Auth pattern as the rest of the schema
-- (see 001_init.sql) — the app enforces "only the buyer of a COMPLETED
-- order can review it" at the repository layer for now.
create policy "Buyers can insert their own review"
    on reviews for insert
    with check (true);

-- ---------------------------------------------------------------------
-- Keep profiles.rating / profiles.review_count in sync automatically
-- ---------------------------------------------------------------------
create or replace function refresh_seller_rating() returns trigger as $$
begin
    update profiles
    set
        rating = coalesce((select round(avg(rating)::numeric, 1) from reviews where seller_id = new.seller_id), 0),
        review_count = (select count(*) from reviews where seller_id = new.seller_id)
    where id = new.seller_id;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_refresh_seller_rating on reviews;
create trigger trg_refresh_seller_rating
    after insert on reviews
    for each row execute function refresh_seller_rating();
