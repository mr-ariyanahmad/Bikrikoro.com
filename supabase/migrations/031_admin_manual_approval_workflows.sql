-- BikriKoro — manual admin approval workflows
-- Product, order, and seller decisions are permission-scoped and retain admin UID/email history.

-- ---------------------------------------------------------------------
-- Product approval state and history
-- ---------------------------------------------------------------------
alter table public.products add column if not exists approval_status text;
update public.products set approval_status = 'APPROVED' where approval_status is null;
alter table public.products alter column approval_status set default 'PENDING';
alter table public.products alter column approval_status set not null;
alter table public.products add column if not exists approval_note text not null default '';
alter table public.products add column if not exists approval_reviewed_by text;
alter table public.products add column if not exists approval_reviewed_email text;
alter table public.products add column if not exists approval_reviewed_at timestamptz;

do $$
begin
  alter table public.products add constraint products_approval_status_check check (approval_status in ('PENDING', 'APPROVED', 'REJECTED'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_products_approval_status on public.products(approval_status, created_at desc);

create table if not exists public.product_approval_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  admin_uid text not null references public.profiles(id),
  admin_email text not null default '',
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_product_approval_history_product on public.product_approval_history(product_id, created_at desc);
alter table public.product_approval_history enable row level security;

create or replace function public.force_new_product_pending()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.approval_status := 'PENDING';
    new.approval_note := '';
    new.approval_reviewed_by := null;
    new.approval_reviewed_email := null;
    new.approval_reviewed_at := null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_force_new_product_pending on public.products;
create trigger trg_force_new_product_pending
before insert on public.products
for each row execute function public.force_new_product_pending();

create or replace function public.admin_review_product(
  p_admin_id text,
  p_product_id uuid,
  p_status text,
  p_admin_note text default ''
) returns void as $$
declare
  v_email text;
  v_product_title text;
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid product approval status'; end if;
  select title into v_product_title from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select coalesce(email, '') into v_email from public.profiles where id = p_admin_id;
  update public.products
  set approval_status = p_status,
      approval_note = coalesce(p_admin_note, ''),
      approval_reviewed_by = p_admin_id,
      approval_reviewed_email = coalesce(v_email, ''),
      approval_reviewed_at = now(),
      is_hidden = case when p_status = 'APPROVED' then false else true end
  where id = p_product_id;
  insert into public.product_approval_history(product_id, admin_uid, admin_email, decision, note)
  values (p_product_id, p_admin_id, coalesce(v_email, ''), p_status, coalesce(p_admin_note, ''));
  perform public.admin_log(p_admin_id, 'PRODUCT_' || p_status, 'PRODUCT', p_product_id::text, jsonb_build_object('title', v_product_title, 'admin_email', coalesce(v_email, ''), 'note', coalesce(p_admin_note, '')));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_list_product_approval_history(p_admin_id text, p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  admin_uid text,
  admin_email text,
  admin_name text,
  decision text,
  note text,
  created_at timestamptz
) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  return query
  select h.id, h.product_id, h.admin_uid, coalesce(nullif(h.admin_email, ''), p.email, ''), coalesce(p.name, ''), h.decision, h.note, h.created_at
  from public.product_approval_history h
  left join public.profiles p on p.id = h.admin_uid
  where h.product_id = p_product_id
  order by h.created_at desc;
end;
$$ language plpgsql security definer set search_path = public;

drop policy if exists "Public products exclude moderated listings" on public.products;
drop policy if exists "Public products require approval" on public.products;
create policy "Public products require approval"
  on public.products for select
  using (coalesce(is_hidden, false) = false and approval_status = 'APPROVED');

-- ---------------------------------------------------------------------
-- Order approval state, history, and lifecycle enforcement
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists admin_review_status text;
update public.orders set admin_review_status = 'APPROVED' where admin_review_status is null;
alter table public.orders alter column admin_review_status set default 'PENDING';
alter table public.orders alter column admin_review_status set not null;
alter table public.orders add column if not exists admin_reviewed_by text;
alter table public.orders add column if not exists admin_reviewed_email text;
alter table public.orders add column if not exists admin_reviewed_at timestamptz;
alter table public.orders add column if not exists admin_review_note text not null default '';

do $$
begin
  alter table public.orders add constraint orders_admin_review_status_check check (admin_review_status in ('PENDING', 'APPROVED', 'REJECTED'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_orders_admin_review_status on public.orders(admin_review_status, created_at desc);

create table if not exists public.order_admin_approval_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  admin_uid text not null references public.profiles(id),
  admin_email text not null default '',
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_order_admin_approval_history_order on public.order_admin_approval_history(order_id, created_at desc);
alter table public.order_admin_approval_history enable row level security;

create or replace function public.admin_review_order(
  p_admin_id text,
  p_order_id uuid,
  p_status text,
  p_admin_note text default ''
) returns void as $$
declare
  v_current_status text;
  v_review_status text;
  v_email text;
  v_product_title text;
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.orders');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid order approval status'; end if;
  select status, admin_review_status, product_title into v_current_status, v_review_status, v_product_title
  from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_review_status <> 'PENDING' then raise exception 'Order already reviewed'; end if;
  select coalesce(email, '') into v_email from public.profiles where id = p_admin_id;

  update public.orders
  set admin_review_status = p_status,
      admin_reviewed_by = p_admin_id,
      admin_reviewed_email = coalesce(v_email, ''),
      admin_reviewed_at = now(),
      admin_review_note = coalesce(p_admin_note, '')
  where id = p_order_id;

  if p_status = 'REJECTED' then
    update public.orders set status = 'CANCELLED', updated_at = now() where id = p_order_id and status <> 'CANCELLED';
  elsif v_current_status = 'PENDING_PAYMENT' and exists (select 1 from public.payments where order_id = p_order_id and status = 'COMPLETED') then
    update public.orders set status = 'ESCROW_HELD', updated_at = now() where id = p_order_id and status = 'PENDING_PAYMENT';
  end if;

  insert into public.order_admin_approval_history(order_id, admin_uid, admin_email, decision, note)
  values (p_order_id, p_admin_id, coalesce(v_email, ''), p_status, coalesce(p_admin_note, ''));
  perform public.admin_log(p_admin_id, 'ORDER_' || p_status, 'ORDER', p_order_id::text, jsonb_build_object('product_title', v_product_title, 'admin_email', coalesce(v_email, ''), 'note', coalesce(p_admin_note, '')));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_list_order_approval_history(p_admin_id text, p_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  admin_uid text,
  admin_email text,
  admin_name text,
  decision text,
  note text,
  created_at timestamptz
) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.orders');
  return query
  select h.id, h.order_id, h.admin_uid, coalesce(nullif(h.admin_email, ''), p.email, ''), coalesce(p.name, ''), h.decision, h.note, h.created_at
  from public.order_admin_approval_history h
  left join public.profiles p on p.id = h.admin_uid
  where h.order_id = p_order_id
  order by h.created_at desc;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.notify_order_admin_review()
returns trigger as $$
declare
  v_title text;
  v_body text;
  v_link text := '/orders/' || new.id::text;
begin
  if new.admin_review_status is distinct from old.admin_review_status then
    v_title := case when new.admin_review_status = 'APPROVED' then 'অর্ডার admin approve করেছে' when new.admin_review_status = 'REJECTED' then 'অর্ডার admin reject করেছে' else 'অর্ডার review status update' end;
    v_body := 'অর্ডার: ' || new.product_title || coalesce(case when new.admin_review_note <> '' then ' — ' || new.admin_review_note else '' end, '');
    insert into public.notifications(user_id, type, title, body, link) values (new.buyer_id, 'ORDER', v_title, v_body, v_link);
    if new.seller_id <> new.buyer_id then
      insert into public.notifications(user_id, type, title, body, link) values (new.seller_id, 'ORDER', v_title, v_body, v_link);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_order_admin_review on public.orders;
create trigger trg_notify_order_admin_review after update of admin_review_status on public.orders for each row execute function public.notify_order_admin_review();

-- Payment can enter escrow only after manual admin approval.
-- The Edge Function is updated in the same repository change to enforce this server-side.

create or replace function public.seller_mark_shipped(p_order_id uuid, p_seller_id text) returns void as $$
begin
  update public.orders set status = 'SHIPPED', updated_at = now()
  where id = p_order_id and seller_id = p_seller_id and status = 'ESCROW_HELD' and admin_review_status = 'APPROVED';
  if not found then raise exception 'Order not found, not approved, not yours, or not in a shippable state'; end if;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Seller reviewer identity snapshots and history read RPC
-- ---------------------------------------------------------------------
alter table public.seller_verification_reviews add column if not exists admin_email text not null default '';

create or replace function public.admin_review_verification_document(p_admin_id text, p_document_id uuid, p_status text, p_admin_note text default '') returns void as $$
declare
  v_registration_id uuid;
  v_email text;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid document status'; end if;
  select coalesce(email, '') into v_email from public.profiles where id = p_admin_id;
  update public.seller_verification_documents set status = p_status, admin_note = coalesce(p_admin_note, ''), reviewed_by = p_admin_id, reviewed_at = now() where id = p_document_id returning registration_id into v_registration_id;
  if not found then raise exception 'Verification document not found'; end if;
  insert into public.seller_verification_reviews(registration_id, admin_id, admin_email, action, document_type, note)
  select v_registration_id, p_admin_id, coalesce(v_email, ''), case when p_status = 'APPROVED' then 'DOCUMENT_APPROVED' else 'DOCUMENT_REJECTED' end, document_type, coalesce(p_admin_note, '') from public.seller_verification_documents where id = p_document_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_finalize_seller_verification(p_admin_id text, p_registration_id uuid, p_status text, p_admin_note text default '') returns void as $$
declare
  v_user_id text;
  v_mode text;
  v_sector text;
  v_business_type text;
  v_missing boolean;
  v_badge_key text;
  v_badge_label text;
  v_email text;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  if p_status not in ('APPROVED', 'REJECTED') then raise exception 'Invalid registration status'; end if;
  select user_id, listing_mode, sector, business_type into v_user_id, v_mode, v_sector, v_business_type from public.seller_registrations where id = p_registration_id and status = 'PENDING';
  if not found then raise exception 'Registration not found or already reviewed'; end if;
  if p_status = 'APPROVED' then
    select exists (select 1 from public.seller_document_requirements r left join public.seller_verification_documents d on d.registration_id = p_registration_id and d.document_type = r.document_type where r.active and r.required and r.listing_mode = v_mode and r.business_type = v_business_type and r.sector in (v_sector, 'OTHER') and (d.id is null or d.status <> 'APPROVED')) into v_missing;
    if v_missing then raise exception 'All required documents must be approved first'; end if;
  end if;
  select coalesce(email, '') into v_email from public.profiles where id = p_admin_id;
  update public.seller_registrations set status = p_status, admin_note = coalesce(p_admin_note, ''), reviewed_at = now() where id = p_registration_id;
  insert into public.seller_verification_reviews(registration_id, admin_id, admin_email, action, note) values (p_registration_id, p_admin_id, coalesce(v_email, ''), p_status, coalesce(p_admin_note, ''));
  if p_status = 'APPROVED' then
    v_badge_key := lower(format('verified_%s_%s', v_mode, v_sector));
    v_badge_label := case when v_mode = 'DIGITAL' then 'ডিজিটাল ' else 'ফিজিক্যাল ' end || case when v_sector = 'OTHER' then 'সেলার' else v_sector || ' সেলার' end || ' যাচাইকৃত';
    insert into public.seller_verification_badges(user_id, badge_key, badge_label) values (v_user_id, v_badge_key, v_badge_label) on conflict (user_id, badge_key) do update set verified_at = now();
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_list_recent_seller_verification_history(p_admin_id text, p_limit integer default 50)
returns table (
  registration_id uuid,
  applicant_name text,
  applicant_user_id text,
  admin_uid text,
  admin_email text,
  admin_name text,
  action text,
  document_type text,
  note text,
  created_at timestamptz
) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.sellers');
  return query
  select r.registration_id, sr.full_name, sr.user_id, r.admin_id, coalesce(nullif(r.admin_email, ''), p.email, ''), coalesce(p.name, ''), r.action, r.document_type, r.note, r.created_at
  from public.seller_verification_reviews r
  join public.seller_registrations sr on sr.id = r.registration_id
  left join public.profiles p on p.id = r.admin_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$ language plpgsql security definer set search_path = public;

-- Any substantive listing edit requires a fresh admin review.
create or replace function public.reset_product_approval_on_edit()
returns trigger as $$
begin
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.price is distinct from old.price
     or new.original_price is distinct from old.original_price
     or new.category_id is distinct from old.category_id
     or new.condition is distinct from old.condition
     or new.location is distinct from old.location
     or new.images is distinct from old.images
     or new.is_digital is distinct from old.is_digital then
    new.approval_status := 'PENDING';
    new.approval_note := '';
    new.approval_reviewed_by := null;
    new.approval_reviewed_email := null;
    new.approval_reviewed_at := null;
    new.is_hidden := true;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_reset_product_approval_on_edit on public.products;
create trigger trg_reset_product_approval_on_edit
before update on public.products
for each row execute function public.reset_product_approval_on_edit();

create or replace function public.notify_product_admin_review()
returns trigger as $$
declare
  v_title text;
  v_body text;
begin
  if new.approval_status is distinct from old.approval_status then
    v_title := case when new.approval_status = 'APPROVED' then 'আপনার প্রোডাক্ট approve হয়েছে' when new.approval_status = 'REJECTED' then 'আপনার প্রোডাক্ট reject হয়েছে' else 'আপনার প্রোডাক্ট review-এ আছে' end;
    v_body := new.title || coalesce(case when new.approval_note <> '' then ' — ' || new.approval_note else '' end, '');
    insert into public.notifications(user_id, type, title, body, link) values (new.seller_id, 'SYSTEM', v_title, v_body, '/my-listings');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_product_admin_review on public.products;
create trigger trg_notify_product_admin_review
after update of approval_status on public.products
for each row execute function public.notify_product_admin_review();

-- Buyer completion is also blocked unless the order has passed admin review.
create or replace function public.buyer_confirm_delivery(p_order_id uuid, p_buyer_id text) returns void as $$
begin
  update public.orders
  set status = 'COMPLETED', updated_at = now()
  where id = p_order_id and buyer_id = p_buyer_id
    and admin_review_status = 'APPROVED'
    and status in ('ESCROW_HELD', 'SHIPPED', 'DELIVERED')
    and dispute_status is null;
  if not found then raise exception 'Order not found, not approved, not yours, not in a confirmable state, or has an open dispute'; end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Seller-owned reads and creation must continue to work even though public
-- catalogue reads now exclude PENDING and REJECTED products. The app uses
-- Firebase UIDs rather than Supabase Auth UIDs, matching the existing RPC
-- authorization convention in this project.
create or replace function public.seller_list_products(p_seller_id text)
returns setof public.products as $$
begin
  return query
  select p.*
  from public.products p
  where p.seller_id = p_seller_id
  order by p.created_at desc;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.seller_get_product(p_seller_id text, p_product_id uuid)
returns public.products as $$
declare
  v_product public.products;
begin
  select p.* into v_product
  from public.products p
  where p.id = p_product_id and p.seller_id = p_seller_id;
  if not found then raise exception 'Listing not found or not yours'; end if;
  return v_product;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.seller_create_product(
  p_seller_id text,
  p_title text,
  p_description text,
  p_price numeric,
  p_original_price numeric,
  p_category_id text,
  p_condition text,
  p_location text,
  p_images text[],
  p_is_digital boolean,
  p_supports_cod boolean default false,
  p_free_delivery boolean default false,
  p_fast_delivery boolean default false,
  p_free_return boolean default false
) returns uuid as $$
declare
  v_product_id uuid;
begin
  if coalesce(trim(p_title), '') = '' or coalesce(p_price, 0) <= 0 then
    raise exception 'Invalid listing values';
  end if;
  insert into public.products (
    title, description, price, original_price, category_id, condition,
    location, images, is_digital, supports_cod, free_delivery, fast_delivery,
    free_return, seller_id
  ) values (
    trim(p_title), coalesce(p_description, ''), p_price, p_original_price,
    p_category_id, p_condition, coalesce(p_location, ''), coalesce(p_images, '{}'),
    coalesce(p_is_digital, false), coalesce(p_supports_cod, false),
    coalesce(p_free_delivery, false), coalesce(p_fast_delivery, false),
    coalesce(p_free_return, false), p_seller_id
  ) returning id into v_product_id;
  return v_product_id;
end;
$$ language plpgsql security definer set search_path = public;
