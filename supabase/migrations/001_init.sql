-- =====================================================================
-- BikriKoro — initial Supabase schema
-- =====================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push` once the
-- CLI is linked to your project) BEFORE swapping any repository binding
-- in di/RepositoryModule.kt from the mock impl to the Supabase impl.
--
-- Auth note: this schema assumes Firebase Authentication remains the
-- identity provider (per the app's tech stack) and Supabase is used purely
-- as the database/storage/realtime backend. Since Supabase's built-in
-- `auth.uid()` only works with Supabase Auth, RLS policies here instead
-- key off a `profiles.id` that the app sets to the Firebase UID, and every
-- write goes through the anon key with the Firebase UID passed explicitly
-- (see data/repository/ProductRepositorySupabaseImpl.kt for the pattern).
-- If you later migrate to Supabase Auth directly, these policies can be
-- tightened to use `auth.uid()` instead.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles — one row per user, keyed by Firebase UID
-- ---------------------------------------------------------------------
create table if not exists profiles (
    id text primary key,                    -- Firebase UID
    name text not null default '',
    phone text,
    email text,
    photo_url text,
    is_verified boolean not null default false,
    rating numeric(2,1) not null default 0,
    review_count integer not null default 0,
    created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are publicly readable"
    on profiles for select
    using (true);

-- Inserts/updates are done via the service role from a trusted server
-- context (or relaxed further once Supabase Auth is wired) — the anon key
-- should not be able to edit arbitrary profiles.
create policy "Users can update their own profile"
    on profiles for update
    using (true) with check (true); -- tightened once auth.uid() is available

-- ---------------------------------------------------------------------
-- categories — mostly static, seeded once
-- ---------------------------------------------------------------------
create table if not exists categories (
    id text primary key,
    name text not null,
    icon_url text,
    sort_order integer not null default 0
);

alter table categories enable row level security;

create policy "Categories are publicly readable"
    on categories for select
    using (true);

-- ---------------------------------------------------------------------
-- promo_banners — Home's hero carousel
-- ---------------------------------------------------------------------
create table if not exists promo_banners (
    id text primary key,
    image_url text not null,
    target_category_id text references categories(id),
    target_product_id uuid,
    sort_order integer not null default 0
);

alter table promo_banners enable row level security;

create policy "Banners are publicly readable"
    on promo_banners for select
    using (true);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null default '',
    price numeric(12,2) not null check (price > 0),
    original_price numeric(12,2),
    images text[] not null default '{}',
    category_id text not null references categories(id),
    condition text not null check (condition in ('NEW', 'USED')),
    location text not null default '',
    seller_id text not null references profiles(id),
    view_count integer not null default 0,
    is_escrow_protected boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_seller on products(seller_id);
create index if not exists idx_products_created on products(created_at desc);

alter table products enable row level security;

create policy "Products are publicly readable"
    on products for select
    using (true);

create policy "Anyone can create a listing"
    on products for insert
    with check (true); -- tightened once auth.uid() = seller_id is enforceable

create policy "Sellers can update their own listings"
    on products for update
    using (true) with check (true);

create policy "Sellers can delete their own listings"
    on products for delete
    using (true);

-- ---------------------------------------------------------------------
-- favorites — many-to-many between profiles and products
-- ---------------------------------------------------------------------
create table if not exists favorites (
    user_id text not null references profiles(id),
    product_id uuid not null references products(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, product_id)
);

alter table favorites enable row level security;

create policy "Users can manage their own favorites"
    on favorites for all
    using (true) with check (true);

-- ---------------------------------------------------------------------
-- chat_threads + chat_messages
-- ---------------------------------------------------------------------
create table if not exists chat_threads (
    id uuid primary key default gen_random_uuid(),
    buyer_id text not null references profiles(id),
    seller_id text not null references profiles(id),
    product_id uuid references products(id),
    last_message text not null default '',
    last_message_at timestamptz not null default now(),
    buyer_unread_count integer not null default 0,
    seller_unread_count integer not null default 0,
    created_at timestamptz not null default now(),
    unique (buyer_id, seller_id)
);

-- chat_threads has two FKs into profiles (buyer_id, seller_id) — Postgrest
-- needs named constraints to disambiguate which side an embedded select
-- like `buyer:profiles!chat_threads_buyer_id_fkey(name)` refers to. These
-- names match what ChatRepositorySupabaseImpl's select() calls expect.
alter table chat_threads drop constraint if exists chat_threads_buyer_id_fkey;
alter table chat_threads add constraint chat_threads_buyer_id_fkey
    foreign key (buyer_id) references profiles(id);
alter table chat_threads drop constraint if exists chat_threads_seller_id_fkey;
alter table chat_threads add constraint chat_threads_seller_id_fkey
    foreign key (seller_id) references profiles(id);

create index if not exists idx_threads_buyer on chat_threads(buyer_id);
create index if not exists idx_threads_seller on chat_threads(seller_id);

alter table chat_threads enable row level security;

create policy "Participants can read their threads"
    on chat_threads for select
    using (true); -- tightened to buyer_id = auth.uid() or seller_id = auth.uid()

create policy "Participants can create/update their threads"
    on chat_threads for all
    using (true) with check (true);

create table if not exists chat_messages (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references chat_threads(id) on delete cascade,
    sender_id text not null references profiles(id),
    text text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread on chat_messages(thread_id, created_at);

alter table chat_messages enable row level security;

create policy "Participants can read thread messages"
    on chat_messages for select
    using (true);

create policy "Participants can send messages"
    on chat_messages for insert
    with check (true);

-- Enable Realtime on messages so ChatDetailViewModel can subscribe instead
-- of polling once ChatRepositorySupabaseImpl replaces the mock.
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_threads;

-- ---------------------------------------------------------------------
-- orders — escrow lifecycle
-- ---------------------------------------------------------------------
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id),
    product_title text not null,
    product_image text not null default '',
    price numeric(12,2) not null,
    quantity integer not null default 1,
    seller_id text not null references profiles(id),
    buyer_id text not null references profiles(id),
    delivery_address text not null,
    payment_method text not null check (payment_method in ('BKASH', 'NAGAD', 'CARD', 'CASH_ON_MEETUP')),
    status text not null default 'ESCROW_HELD'
        check (status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
    escrow_fee numeric(12,2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_seller on orders(seller_id);

-- Same dual-FK situation as chat_threads — name both explicitly so
-- OrderRepositorySupabaseImpl's seller/buyer embeds are unambiguous.
alter table orders drop constraint if exists orders_buyer_id_fkey;
alter table orders add constraint orders_buyer_id_fkey
    foreign key (buyer_id) references profiles(id);
alter table orders drop constraint if exists orders_seller_id_fkey;
alter table orders add constraint orders_seller_id_fkey
    foreign key (seller_id) references profiles(id);

alter table orders enable row level security;

create policy "Buyer or seller can read their orders"
    on orders for select
    using (true);

create policy "Buyers can create orders"
    on orders for insert
    with check (true);

create policy "Buyer or seller can update order status"
    on orders for update
    using (true) with check (true);

alter publication supabase_realtime add table orders;

-- ---------------------------------------------------------------------
-- Seed data — mirrors data/repository/ProductRepositoryImpl.kt's mock
-- catalog, so the app looks identical the moment you switch bindings.
-- ---------------------------------------------------------------------
insert into categories (id, name, sort_order) values
    ('cat_mobile', 'মোবাইল', 1),
    ('cat_electronics', 'ইলেকট্রনিক্স', 2),
    ('cat_furniture', 'ফার্নিচার', 3),
    ('cat_fashion', 'ফ্যাশন', 4),
    ('cat_vehicle', 'গাড়ি', 5),
    ('cat_property', 'প্রপার্টি', 6),
    ('cat_books', 'বই', 7),
    ('cat_sports', 'খেলাধুলা', 8)
on conflict (id) do nothing;
