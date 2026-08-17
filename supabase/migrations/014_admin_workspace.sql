-- =====================================================================
-- BikriKoro — full admin workspace backend
-- =====================================================================
-- All mutations below check the existing Firebase-UID based admin allowlist
-- through is_admin(). Apply this migration after 013_marketplace_features.
-- =====================================================================

alter table products add column if not exists is_hidden boolean not null default false;
alter table products add column if not exists moderation_note text not null default '';
alter table reviews add column if not exists is_hidden boolean not null default false;

create table if not exists admin_settings (
    setting_key text primary key,
    setting_value jsonb not null default '{}'::jsonb,
    updated_by text,
    updated_at timestamptz not null default now()
);
alter table admin_settings enable row level security;

create table if not exists admin_content (
    id uuid primary key default gen_random_uuid(),
    content_type text not null check (content_type in ('BLOG', 'ANNOUNCEMENT')),
    title text not null,
    slug text not null unique,
    excerpt text not null default '',
    body text not null default '',
    status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    author_id text references profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_admin_content_type_status on admin_content(content_type, status, created_at desc);
alter table admin_content enable row level security;
drop policy if exists "Published content is public" on admin_content;
create policy "Published content is public"
    on admin_content for select using (status = 'PUBLISHED');

create table if not exists admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_id text not null references profiles(id),
    action text not null,
    entity_type text not null,
    entity_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on admin_audit_log(created_at desc);
alter table admin_audit_log enable row level security;

create or replace function admin_assert(p_admin_id text) returns void as $$
begin
    if not is_admin(p_admin_id) then raise exception 'Not authorized'; end if;
end;
$$ language plpgsql security definer stable;

create or replace function admin_log(p_admin_id text, p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb) returns void as $$
begin
    insert into admin_audit_log(admin_id, action, entity_type, entity_id, details)
    values (p_admin_id, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$ language plpgsql security definer;

create or replace function admin_update_order_status(p_admin_id text, p_order_id uuid, p_status text) returns void as $$
begin
    perform admin_assert(p_admin_id);
    update orders set status = p_status, updated_at = now()
    where id = p_order_id and p_status in ('PENDING_PAYMENT', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');
    if not found then raise exception 'Order not found or invalid status'; end if;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_coupon(p_admin_id text, p_code text, p_description text, p_discount_type text, p_discount_value numeric, p_min_subtotal numeric, p_max_redemptions integer, p_active_until timestamptz) returns void as $$
begin
    perform admin_assert(p_admin_id);
    insert into coupons(code, description, discount_type, discount_value, min_subtotal, max_redemptions, active_until, active)
    values (upper(trim(p_code)), coalesce(p_description, ''), p_discount_type, p_discount_value, greatest(coalesce(p_min_subtotal, 0), 0), p_max_redemptions, p_active_until, true)
    on conflict (code) do update set description = excluded.description, discount_type = excluded.discount_type, discount_value = excluded.discount_value, min_subtotal = excluded.min_subtotal, max_redemptions = excluded.max_redemptions, active_until = excluded.active_until;
end;
$$ language plpgsql security definer;

create or replace function admin_set_coupon_active(p_admin_id text, p_code text, p_active boolean) returns void as $$
begin
    perform admin_assert(p_admin_id);
    update coupons set active = p_active where code = upper(trim(p_code));
    if not found then raise exception 'Coupon not found'; end if;
end;
$$ language plpgsql security definer;

create or replace function admin_moderate_product(p_admin_id text, p_product_id uuid, p_action text) returns void as $$
begin
    perform admin_assert(p_admin_id);
    if p_action = 'RESTORE' then
        update products set is_hidden = false, moderation_note = '' where id = p_product_id;
    elsif p_action in ('HIDE', 'DELETE') then
        update products set is_hidden = true, moderation_note = p_action where id = p_product_id;
    else raise exception 'Invalid product moderation action'; end if;
    if not found then raise exception 'Product not found'; end if;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_category(p_admin_id text, p_id text, p_name text, p_sort_order integer) returns void as $$
begin
    perform admin_assert(p_admin_id);
    insert into categories(id, name, sort_order) values (p_id, p_name, p_sort_order)
    on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_banner(p_admin_id text, p_id text, p_image_url text, p_target_product_id uuid, p_sort_order integer) returns void as $$
begin
    perform admin_assert(p_admin_id);
    insert into promo_banners(id, image_url, target_product_id, sort_order) values (p_id, p_image_url, p_target_product_id, p_sort_order)
    on conflict (id) do update set image_url = excluded.image_url, target_product_id = excluded.target_product_id, sort_order = excluded.sort_order;
end;
$$ language plpgsql security definer;

create or replace function admin_moderate_review(p_admin_id text, p_review_id text, p_action text) returns void as $$
begin
    perform admin_assert(p_admin_id);
    if p_action in ('HIDE', 'DELETE') then
        update reviews set is_hidden = true where id = p_review_id;
    elsif p_action = 'RESTORE' then
        update reviews set is_hidden = false where id = p_review_id;
    else raise exception 'Invalid review moderation action'; end if;
    if not found then raise exception 'Review not found'; end if;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_content(p_admin_id text, p_id uuid, p_content_type text, p_title text, p_slug text, p_excerpt text, p_body text, p_status text) returns void as $$
begin
    perform admin_assert(p_admin_id);
    if p_id is null then
        insert into admin_content(content_type, title, slug, excerpt, body, status, author_id)
        values (p_content_type, p_title, p_slug, p_excerpt, p_body, p_status, coalesce(current_setting('request.jwt.claim.sub', true), null));
    else
        update admin_content set content_type = p_content_type, title = p_title, slug = p_slug, excerpt = p_excerpt, body = p_body, status = p_status, updated_at = now() where id = p_id;
    end if;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_setting(p_admin_id text, p_key text, p_value jsonb) returns void as $$
begin
    perform admin_assert(p_admin_id);
    insert into admin_settings(setting_key, setting_value, updated_by) values (p_key, p_value, p_admin_id)
    on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now();
end;
$$ language plpgsql security definer;

create or replace function admin_list_coupons(p_admin_id text)
returns setof coupons as $$
begin
    perform admin_assert(p_admin_id);
    return query select * from coupons order by created_at desc;
end;
$$ language plpgsql security definer;

create or replace function admin_list_content(p_admin_id text, p_content_type text)
returns setof admin_content as $$
begin
    perform admin_assert(p_admin_id);
    return query select * from admin_content where content_type = p_content_type order by created_at desc;
end;
$$ language plpgsql security definer;

create or replace function admin_get_settings(p_admin_id text, p_prefix text default null)
returns table (setting_key text, setting_value jsonb, updated_by text, updated_at timestamptz) as $$
begin
    perform admin_assert(p_admin_id);
    return query
    select s.setting_key, s.setting_value, s.updated_by, s.updated_at
    from admin_settings s
    where p_prefix is null or s.setting_key like p_prefix || '%'
    order by s.setting_key;
end;
$$ language plpgsql security definer;

-- Public catalogue/reviews must respect moderation flags. Admin RPCs below
-- retain visibility for the admin workspace, including hidden records.
drop policy if exists "Products are publicly readable" on products;
create policy "Public products exclude moderated listings"
    on products for select using (coalesce(is_hidden, false) = false);

drop policy if exists "Reviews are publicly readable" on reviews;
create policy "Public reviews exclude moderated reviews"
    on reviews for select using (coalesce(is_hidden, false) = false);

create or replace function admin_list_products(p_admin_id text)
returns setof products as $$
begin
    perform admin_assert(p_admin_id);
    return query select * from products order by created_at desc;
end;
$$ language plpgsql security definer;

create or replace function admin_list_reviews(p_admin_id text)
returns setof reviews as $$
begin
    perform admin_assert(p_admin_id);
    return query select * from reviews order by created_at desc;
end;
$$ language plpgsql security definer;
