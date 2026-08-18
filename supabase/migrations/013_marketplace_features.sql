-- =====================================================================
-- BikriKoro — marketplace feature support
-- =====================================================================
-- This migration extends the Firebase-UID/Supabase data model used by the
-- website. The existing project intentionally uses explicit UID arguments
-- in RPCs, so the helper functions below follow that same convention.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Digital product contents and buyer delivery records
-- ---------------------------------------------------------------------
create table if not exists digital_product_contents (
    product_id uuid primary key references products(id) on delete cascade,
    seller_id text not null references profiles(id),
    delivery_type text not null default 'INSTRUCTIONS'
        check (delivery_type in ('INSTRUCTIONS', 'LICENSE_KEY', 'DOWNLOAD_LINK')),
    delivery_text text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table digital_product_contents enable row level security;
drop policy if exists "Sellers can create digital content" on digital_product_contents;
create policy "Sellers can create digital content"
    on digital_product_contents for insert with check (true);
drop policy if exists "Sellers can update digital content" on digital_product_contents;
create policy "Sellers can update digital content"
    on digital_product_contents for update using (true) with check (true);
drop policy if exists "Sellers can read digital content" on digital_product_contents;
create policy "Sellers can read digital content"
    on digital_product_contents for select using (true);

create table if not exists digital_deliveries (
    order_id uuid primary key references orders(id) on delete cascade,
    product_id uuid not null references products(id),
    buyer_id text not null references profiles(id),
    seller_id text not null references profiles(id),
    delivery_type text not null,
    delivery_text text not null default '',
    status text not null default 'PENDING'
        check (status in ('PENDING', 'READY', 'REVOKED')),
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table digital_deliveries enable row level security;

create or replace function get_digital_library(p_buyer_id text)
returns table (
    order_id uuid,
    product_id uuid,
    product_title text,
    product_image text,
    price numeric,
    order_status text,
    delivery_type text,
    delivery_text text,
    delivery_status text,
    delivered_at timestamptz,
    purchased_at timestamptz
) as $$
begin
    return query
    select d.order_id, d.product_id, o.product_title, o.product_image,
           o.price, o.status, d.delivery_type, d.delivery_text,
           d.status, d.delivered_at, o.created_at
    from digital_deliveries d
    join orders o on o.id = d.order_id
    where d.buyer_id = p_buyer_id
    order by o.created_at desc;
end;
$$ language plpgsql security definer;

create or replace function sync_digital_delivery()
returns trigger as $$
declare
    v_product products%rowtype;
    v_content digital_product_contents%rowtype;
begin
    if new.status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
        select * into v_product from products where id = new.product_id;
        if coalesce(v_product.is_digital, false) then
            select * into v_content from digital_product_contents where product_id = new.product_id;
            insert into digital_deliveries (
                order_id, product_id, buyer_id, seller_id, delivery_type,
                delivery_text, status, delivered_at
            ) values (
                new.id, new.product_id, new.buyer_id, new.seller_id,
                coalesce(v_content.delivery_type, 'INSTRUCTIONS'),
                coalesce(v_content.delivery_text, ''),
                case when coalesce(v_content.delivery_text, '') = '' then 'PENDING' else 'READY' end,
                case when coalesce(v_content.delivery_text, '') = '' then null else now() end
            )
            on conflict (order_id) do update set
                delivery_text = excluded.delivery_text,
                delivery_type = excluded.delivery_type,
                status = excluded.status,
                delivered_at = excluded.delivered_at,
                updated_at = now();
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_digital_delivery on orders;
create trigger trg_sync_digital_delivery
after insert or update of status on orders
for each row execute function sync_digital_delivery();

-- ---------------------------------------------------------------------
-- Coupons and server-side validation for one-product checkout
-- ---------------------------------------------------------------------
create table if not exists coupons (
    code text primary key,
    description text not null default '',
    discount_type text not null check (discount_type in ('PERCENT', 'FIXED')),
    discount_value numeric(12,2) not null check (discount_value > 0),
    min_subtotal numeric(12,2) not null default 0,
    max_redemptions integer,
    redeemed_count integer not null default 0,
    active boolean not null default true,
    active_until timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_coupons_active on coupons(active, active_until);
alter table coupons enable row level security;
drop policy if exists "Active coupons are publicly readable" on coupons;
create policy "Active coupons are publicly readable"
    on coupons for select using (active = true and (active_until is null or active_until > now()));

create table if not exists coupon_redemptions (
    id uuid primary key default gen_random_uuid(),
    coupon_code text not null references coupons(code),
    order_id uuid not null references orders(id) on delete cascade,
    buyer_id text not null references profiles(id),
    discount_amount numeric(12,2) not null default 0,
    created_at timestamptz not null default now(),
    unique (coupon_code, buyer_id)
);

alter table coupon_redemptions enable row level security;

alter table orders add column if not exists subtotal numeric(12,2);
alter table orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table orders add column if not exists coupon_code text;

create or replace function validate_coupon(p_code text, p_product_id uuid, p_buyer_id text)
returns table (
    valid boolean,
    normalized_code text,
    discount_amount numeric,
    final_price numeric,
    message text
) as $$
declare
    v_coupon coupons%rowtype;
    v_price numeric;
    v_discount numeric := 0;
begin
    select price into v_price from products where id = p_product_id;
    if v_price is null then
        return query select false, upper(trim(p_code)), 0::numeric, 0::numeric, 'পণ্যটি পাওয়া যায়নি';
        return;
    end if;

    select * into v_coupon from coupons
    where code = upper(trim(p_code))
      and active = true
      and (active_until is null or active_until > now())
      and (max_redemptions is null or redeemed_count < max_redemptions);
    if not found then
        return query select false, upper(trim(p_code)), 0::numeric, v_price, 'কুপনটি সঠিক নয় বা আর সক্রিয় নেই';
        return;
    end if;

    if v_price < v_coupon.min_subtotal then
        return query select false, v_coupon.code, 0::numeric, v_price,
            format('এই কুপনের জন্য কমপক্ষে ৳%s মূল্যের পণ্য লাগবে', v_coupon.min_subtotal);
        return;
    end if;

    if exists (select 1 from coupon_redemptions where coupon_code = v_coupon.code and buyer_id = p_buyer_id) then
        return query select false, v_coupon.code, 0::numeric, v_price, 'আপনি এই কুপনটি আগে ব্যবহার করেছেন';
        return;
    end if;

    v_discount := case when v_coupon.discount_type = 'PERCENT'
        then least(v_price, round(v_price * v_coupon.discount_value / 100, 2))
        else least(v_price, v_coupon.discount_value)
    end;

    return query select true, v_coupon.code, v_discount, greatest(v_price - v_discount, 0), v_coupon.description;
end;
$$ language plpgsql security definer;

create or replace function release_pending_coupon_on_cancel()
returns trigger as $$
begin
    if old.status = 'PENDING_PAYMENT' and new.status = 'CANCELLED' and new.coupon_code is not null then
        delete from coupon_redemptions where order_id = new.id;
        update coupons set redeemed_count = greatest(redeemed_count - 1, 0) where code = new.coupon_code;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_release_pending_coupon on orders;
create trigger trg_release_pending_coupon
after update of status on orders
for each row execute function release_pending_coupon_on_cancel();

create or replace function create_order_pending_payment_with_coupon(
    p_product_id uuid,
    p_buyer_id text,
    p_delivery_address text,
    p_coupon_code text default null
) returns uuid as $$
declare
    v_product products%rowtype;
    v_escrow_fee numeric(12,2);
    v_subtotal numeric(12,2);
    v_discount numeric(12,2) := 0;
    v_code text := null;
    v_order_id uuid;
    v_coupon record;
begin
    select * into v_product from products where id = p_product_id for update;
    if not found then raise exception 'Product not found'; end if;
    if v_product.seller_id = p_buyer_id then raise exception 'Cannot order your own listing'; end if;
    v_subtotal := v_product.price;

    if p_coupon_code is not null and trim(p_coupon_code) <> '' then
        select * into v_coupon from validate_coupon(p_coupon_code, p_product_id, p_buyer_id);
        if not coalesce(v_coupon.valid, false) then raise exception '%', v_coupon.message; end if;
        v_discount := v_coupon.discount_amount;
        v_code := v_coupon.normalized_code;
    end if;

    v_escrow_fee := greatest(greatest(v_subtotal - v_discount, 0) * 0.01, 10);
    insert into orders (
        product_id, product_title, product_image, price, subtotal, discount_amount, coupon_code,
        seller_id, buyer_id, delivery_address, payment_method, status, escrow_fee
    ) values (
        v_product.id, v_product.title, coalesce(v_product.images[1], ''), greatest(v_subtotal - v_discount, 0),
        v_subtotal, v_discount, v_code, v_product.seller_id, p_buyer_id, p_delivery_address,
        null, 'PENDING_PAYMENT', v_escrow_fee
    ) returning id into v_order_id;

    if v_code is not null then
        insert into coupon_redemptions(coupon_code, order_id, buyer_id, discount_amount)
        values (v_code, v_order_id, p_buyer_id, v_discount);
        update coupons set redeemed_count = redeemed_count + 1 where code = v_code;
    end if;
    return v_order_id;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------
create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id),
    type text not null default 'SYSTEM',
    title text not null,
    body text not null default '',
    link text,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
alter table notifications enable row level security;

create or replace function get_my_notifications(p_user_id text, p_limit integer default 40)
returns table (id uuid, type text, title text, body text, link text, is_read boolean, created_at timestamptz) as $$
begin
    return query select n.id, n.type, n.title, n.body, n.link, n.is_read, n.created_at
    from notifications n where n.user_id = p_user_id order by n.created_at desc limit greatest(1, least(p_limit, 100));
end;
$$ language plpgsql security definer;

create or replace function mark_notification_read(p_notification_id uuid, p_user_id text)
returns void as $$
begin
    update notifications set is_read = true where id = p_notification_id and user_id = p_user_id;
end;
$$ language plpgsql security definer;

create or replace function notify_order_change()
returns trigger as $$
declare
    v_title text;
    v_body text;
    v_link text := '/orders/' || new.id::text;
begin
    if tg_op = 'INSERT' or old.status is distinct from new.status then
        v_title := case new.status
            when 'PENDING_PAYMENT' then 'পেমেন্ট সম্পন্ন করুন'
            when 'ESCROW_HELD' then 'নতুন অর্ডার পেয়েছেন'
            when 'SHIPPED' then 'আপনার অর্ডার পাঠানো হয়েছে'
            when 'DELIVERED' then 'অর্ডারটি পৌঁছেছে'
            when 'COMPLETED' then 'অর্ডার সম্পন্ন হয়েছে'
            when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
            else 'অর্ডারে নতুন আপডেট'
        end;
        v_body := 'অর্ডার: ' || new.product_title;
        insert into notifications(user_id, type, title, body, link)
        values (new.buyer_id, 'ORDER', v_title, v_body, v_link);
        if new.seller_id::text <> new.buyer_id::text then
            insert into notifications(user_id, type, title, body, link)
            values (new.seller_id, 'ORDER', v_title, v_body, v_link);
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_order_change on orders;
create trigger trg_notify_order_change
after insert or update of status on orders
for each row execute function notify_order_change();
