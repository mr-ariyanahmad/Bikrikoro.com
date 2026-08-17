-- BikriKoro public expansion: buyer trust, saved checkout data, and alerts.

create table if not exists saved_addresses (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    label text not null default 'বাড়ি',
    recipient_name text not null,
    phone text not null,
    address_line text not null,
    city text not null default 'খুলনা',
    area text not null default '',
    postal_code text,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table saved_addresses enable row level security;
drop policy if exists "Saved addresses readable" on saved_addresses;
create policy "Saved addresses readable" on saved_addresses for select using (true);
drop policy if exists "Saved addresses writable through functions" on saved_addresses;
create policy "Saved addresses writable through functions" on saved_addresses for all using (true) with check (true);

create or replace function list_saved_addresses(p_user_id text)
returns setof saved_addresses as $$
begin
    return query select * from saved_addresses where user_id = p_user_id order by is_default desc, updated_at desc;
end;
$$ language plpgsql security definer;

create or replace function upsert_saved_address(p_user_id text, p_id uuid, p_label text, p_recipient_name text, p_phone text, p_address_line text, p_city text, p_area text, p_postal_code text, p_is_default boolean)
returns uuid as $$
declare v_id uuid;
begin
    if p_is_default then update saved_addresses set is_default = false where user_id = p_user_id; end if;
    insert into saved_addresses (id, user_id, label, recipient_name, phone, address_line, city, area, postal_code, is_default)
    values (coalesce(p_id, gen_random_uuid()), p_user_id, coalesce(nullif(trim(p_label), ''), 'বাড়ি'), trim(p_recipient_name), trim(p_phone), trim(p_address_line), coalesce(nullif(trim(p_city), ''), 'খুলনা'), coalesce(trim(p_area), ''), nullif(trim(p_postal_code), ''), p_is_default)
    on conflict (id) do update set label = excluded.label, recipient_name = excluded.recipient_name, phone = excluded.phone, address_line = excluded.address_line, city = excluded.city, area = excluded.area, postal_code = excluded.postal_code, is_default = excluded.is_default, updated_at = now()
    returning id into v_id;
    return v_id;
end;
$$ language plpgsql security definer;

create or replace function delete_saved_address(p_user_id text, p_id uuid)
returns void as $$
begin
    delete from saved_addresses where id = p_id and user_id = p_user_id;
end;
$$ language plpgsql security definer;

create table if not exists product_alerts (
    user_id text not null references profiles(id) on delete cascade,
    product_id uuid not null references products(id) on delete cascade,
    alert_type text not null check (alert_type in ('PRICE_DROP', 'BACK_IN_STOCK')),
    created_at timestamptz not null default now(),
    primary key (user_id, product_id, alert_type)
);
alter table product_alerts enable row level security;
drop policy if exists "Users manage product alerts" on product_alerts;
create policy "Users manage product alerts" on product_alerts for all using (true) with check (true);

create or replace function toggle_product_alert(p_user_id text, p_product_id uuid, p_alert_type text)
returns boolean as $$
declare v_exists boolean;
begin
    select exists(select 1 from product_alerts where user_id = p_user_id and product_id = p_product_id and alert_type = p_alert_type) into v_exists;
    if v_exists then delete from product_alerts where user_id = p_user_id and product_id = p_product_id and alert_type = p_alert_type; return false;
    else insert into product_alerts(user_id, product_id, alert_type) values (p_user_id, p_product_id, p_alert_type); return true; end if;
end;
$$ language plpgsql security definer;

create table if not exists seller_follows (
    user_id text not null references profiles(id) on delete cascade,
    seller_id text not null references profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, seller_id)
);
alter table seller_follows enable row level security;
drop policy if exists "Users manage seller follows" on seller_follows;
create policy "Users manage seller follows" on seller_follows for all using (true) with check (true);

create or replace function toggle_seller_follow(p_user_id text, p_seller_id text)
returns boolean as $$
declare v_exists boolean;
begin
    select exists(select 1 from seller_follows where user_id = p_user_id and seller_id = p_seller_id) into v_exists;
    if v_exists then delete from seller_follows where user_id = p_user_id and seller_id = p_seller_id; return false;
    else insert into seller_follows(user_id, seller_id) values (p_user_id, p_seller_id); return true; end if;
end;
$$ language plpgsql security definer;

create table if not exists product_questions (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    asker_id text not null references profiles(id) on delete cascade,
    question text not null,
    answer text,
    answered_at timestamptz,
    created_at timestamptz not null default now()
);
alter table product_questions enable row level security;
drop policy if exists "Product questions are publicly readable" on product_questions;
create policy "Product questions are publicly readable" on product_questions for select using (true);
drop policy if exists "Users can ask product questions" on product_questions;
create policy "Users can ask product questions" on product_questions for insert with check (true);

create or replace function list_product_questions(p_product_id uuid)
returns setof product_questions as $$
begin
    return query select * from product_questions where product_id = p_product_id order by created_at desc;
end;
$$ language plpgsql security definer;

create or replace function ask_product_question(p_asker_id text, p_product_id uuid, p_question text)
returns uuid as $$
declare v_id uuid;
begin
    insert into product_questions(asker_id, product_id, question) values (p_asker_id, p_product_id, trim(p_question)) returning id into v_id;
    return v_id;
end;
$$ language plpgsql security definer;

create table if not exists product_reports (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    reporter_id text not null references profiles(id) on delete cascade,
    reason text not null,
    details text,
    status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWED', 'RESOLVED')),
    created_at timestamptz not null default now()
);
alter table product_reports enable row level security;
drop policy if exists "Product reports created through function" on product_reports;
create policy "Product reports created through function" on product_reports for insert with check (true);

create or replace function report_product(p_reporter_id text, p_product_id uuid, p_reason text, p_details text)
returns uuid as $$
declare v_id uuid;
begin
    insert into product_reports(reporter_id, product_id, reason, details) values (p_reporter_id, p_product_id, trim(p_reason), nullif(trim(p_details), '')) returning id into v_id;
    return v_id;
end;
$$ language plpgsql security definer;
