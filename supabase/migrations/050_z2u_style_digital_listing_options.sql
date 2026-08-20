-- BikriKoro — migration 050: Z2U-style digital listing options
-- Adds configurable digital category templates, buyer-safe specifications,
-- seller stock/auto-delivery controls, and permission-scoped admin management.
-- Physical historical products and existing order/payment/wallet contracts remain.

create table if not exists public.digital_category_templates (
  category_id text primary key references public.categories(id) on delete cascade,
  name_en text not null default '',
  description_bn text not null default '',
  icon_key text not null default 'Package',
  parent_category_id text references public.digital_category_templates(category_id) on delete set null,
  fields jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_category_templates_fields_array check (jsonb_typeof(fields) = 'array')
);

create index if not exists idx_digital_category_templates_active
  on public.digital_category_templates(is_active, sort_order, category_id);

alter table public.digital_category_templates enable row level security;
drop policy if exists "Active digital category templates are public" on public.digital_category_templates;
create policy "Active digital category templates are public"
  on public.digital_category_templates for select
  using (is_active = true);

create table if not exists public.product_digital_specs (
  product_id uuid primary key references public.products(id) on delete cascade,
  seller_id text not null references public.profiles(id),
  specifications jsonb not null default '{}'::jsonb,
  auto_delivery_enabled boolean not null default true,
  deactivate_when_out_of_stock boolean not null default false,
  stock_mode text not null default 'UNLIMITED'
    check (stock_mode in ('UNLIMITED', 'QUANTITY', 'KEY_POOL')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  fulfillment_window_minutes integer not null default 0 check (fulfillment_window_minutes >= 0),
  region_code text not null default 'GLOBAL',
  subscription_period text not null default '',
  warranty_period text not null default '',
  delivery_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_digital_specs_object check (jsonb_typeof(specifications) = 'object')
);

create index if not exists idx_product_digital_specs_seller
  on public.product_digital_specs(seller_id, updated_at desc);

alter table public.product_digital_specs enable row level security;
drop policy if exists "Approved digital specs are public" on public.product_digital_specs;
create policy "Approved digital specs are public"
  on public.product_digital_specs for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_digital_specs.product_id
        and p.is_digital = true
        and coalesce(p.is_hidden, false) = false
        and p.approval_status = 'APPROVED'
    )
  );
drop policy if exists "Digital specs are server-only for writes" on public.product_digital_specs;
create policy "Digital specs are server-only for writes"
  on public.product_digital_specs for all
  using (false) with check (false);

-- Seed category rows and editable templates. Admin can rename or replace fields
-- later; IDs are stable so products and historical links remain intact.
insert into public.categories(id, name, sort_order) values
  ('digital_game_accounts', 'গেম অ্যাকাউন্ট', 10),
  ('digital_game_currency', 'গেম কয়েন / গোল্ড', 20),
  ('digital_game_items', 'গেম আইটেম / স্কিন', 30),
  ('digital_game_topups', 'গেম টপ-আপ / ভাউচার', 40),
  ('digital_gift_cards', 'গিফট কার্ড', 50),
  ('digital_software_license', 'সফটওয়্যার / লাইসেন্স', 60),
  ('digital_subscription', 'স্ট্রিমিং / সাবস্ক্রিপশন', 70),
  ('digital_social_accounts', 'সোশ্যাল মিডিয়া অ্যাকাউন্ট', 80),
  ('digital_course', 'অনলাইন কোর্স', 90),
  ('digital_design_assets', 'ডিজাইন অ্যাসেট / টেমপ্লেট', 100),
  ('digital_ebook_files', 'ই-বুক / ডিজিটাল ফাইল', 110),
  ('digital_game_service', 'গেম সার্ভিস', 120)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.digital_category_templates(category_id, name_en, description_bn, icon_key, fields, sort_order)
values
('digital_game_accounts', 'Game Account', 'অ্যাকাউন্টের গেম, সার্ভার ও গুরুত্বপূর্ণ বৈশিষ্ট্য দিন।', 'Gamepad2', '[{"key":"game_name","label_bn":"গেমের নাম","type":"text","required":true},{"key":"server_region","label_bn":"সার্ভার / অঞ্চল","type":"text","required":true},{"key":"account_level","label_bn":"অ্যাকাউন্ট লেভেল","type":"number","required":false},{"key":"rank","label_bn":"র‍্যাঙ্ক / ডিভিশন","type":"text","required":false},{"key":"login_type","label_bn":"লগইন পদ্ধতি","type":"select","required":true,"options":["Email","Google","Facebook","Game ID","Other"]}]'::jsonb, 10),
('digital_game_currency', 'Game Currency', 'কয়েন, গোল্ড, MT, points বা অন্য virtual currency-এর তথ্য দিন।', 'Coins', '[{"key":"game_name","label_bn":"গেমের নাম","type":"text","required":true},{"key":"server_region","label_bn":"সার্ভার / অঞ্চল","type":"text","required":false},{"key":"currency_name","label_bn":"কারেন্সির নাম","type":"text","required":true},{"key":"delivery_amount","label_bn":"প্রতি অর্ডারে পরিমাণ","type":"number","required":true},{"key":"delivery_method","label_bn":"ডেলিভারি পদ্ধতি","type":"select","required":true,"options":["অ্যাকাউন্টে যোগ","ট্রেড","কোড"]}]'::jsonb, 20),
('digital_game_items', 'Game Items', 'স্কিন, চরিত্র, অস্ত্র, bundle বা in-game item-এর বৈশিষ্ট্য দিন।', 'Sparkles', '[{"key":"game_name","label_bn":"গেমের নাম","type":"text","required":true},{"key":"item_name","label_bn":"আইটেমের নাম","type":"text","required":true},{"key":"rarity","label_bn":"রেয়ারিটি","type":"text","required":false},{"key":"platform","label_bn":"প্ল্যাটফর্ম","type":"select","required":false,"options":["PC","PlayStation","Xbox","Mobile","Multi-platform"]}]'::jsonb, 30),
('digital_game_topups', 'Game Top-up / Voucher', 'গেম top-up বা voucher-এর region, amount ও redemption information দিন।', 'CircleDollarSign', '[{"key":"game_name","label_bn":"গেম / সার্ভিসের নাম","type":"text","required":true},{"key":"region_code","label_bn":"Region code","type":"text","required":true},{"key":"topup_amount","label_bn":"Top-up amount","type":"text","required":true},{"key":"redeem_instructions","label_bn":"Redeem নির্দেশনা","type":"textarea","required":true}]'::jsonb, 40),
('digital_gift_cards', 'Gift Card', 'Gift card-এর brand, region, value এবং redemption rule দিন।', 'Gift', '[{"key":"brand","label_bn":"ব্র্যান্ড","type":"text","required":true},{"key":"region_code","label_bn":"Region code","type":"text","required":true},{"key":"card_value","label_bn":"কার্ড ভ্যালু","type":"text","required":true},{"key":"expiry","label_bn":"মেয়াদ","type":"text","required":false}]'::jsonb, 50),
('digital_software_license', 'Software / License', 'সফটওয়্যার license-এর edition, duration, device limit ও region দিন।', 'KeyRound', '[{"key":"software_name","label_bn":"সফটওয়্যারের নাম","type":"text","required":true},{"key":"edition","label_bn":"Edition / version","type":"text","required":true},{"key":"subscription_period","label_bn":"মেয়াদ","type":"text","required":true},{"key":"device_limit","label_bn":"ডিভাইস সীমা","type":"number","required":false},{"key":"activation_region","label_bn":"Activation region","type":"text","required":false}]'::jsonb, 60),
('digital_subscription', 'Streaming / Subscription', 'Subscription service-এর plan, duration, profile/device limits ও region দিন।', 'Crown', '[{"key":"service_name","label_bn":"সার্ভিসের নাম","type":"text","required":true},{"key":"plan_name","label_bn":"Plan","type":"text","required":true},{"key":"subscription_period","label_bn":"মেয়াদ","type":"text","required":true},{"key":"profile_type","label_bn":"Profile / access type","type":"text","required":false},{"key":"region_code","label_bn":"Region code","type":"text","required":false}]'::jsonb, 70),
('digital_social_accounts', 'Social Media Account', 'সোশ্যাল account-এর platform, niche, age ও access details-এর non-secret অংশ দিন।', 'AtSign', '[{"key":"platform","label_bn":"প্ল্যাটফর্ম","type":"select","required":true,"options":["Facebook","Instagram","TikTok","YouTube","X","Other"]},{"key":"account_niche","label_bn":"Niche / বিষয়","type":"text","required":false},{"key":"follower_range","label_bn":"Follower range","type":"text","required":false},{"key":"account_age","label_bn":"Account age","type":"text","required":false},{"key":"region_code","label_bn":"Region code","type":"text","required":false}]'::jsonb, 80),
('digital_course', 'Online Course', 'Course-এর platform, language, duration, access period ও level দিন।', 'GraduationCap', '[{"key":"platform","label_bn":"প্ল্যাটফর্ম","type":"text","required":true},{"key":"course_language","label_bn":"ভাষা","type":"text","required":true},{"key":"course_level","label_bn":"লেভেল","type":"select","required":false,"options":["Beginner","Intermediate","Advanced"]},{"key":"access_period","label_bn":"Access period","type":"text","required":true}]'::jsonb, 90),
('digital_design_assets', 'Design Assets / Templates', 'Design file-এর software compatibility, format, license ও included files দিন।', 'Palette', '[{"key":"asset_type","label_bn":"অ্যাসেটের ধরন","type":"text","required":true},{"key":"file_format","label_bn":"File format","type":"text","required":true},{"key":"compatible_software","label_bn":"Compatible software","type":"text","required":true},{"key":"license_type","label_bn":"License type","type":"text","required":true},{"key":"included_files","label_bn":"Included files","type":"textarea","required":false}]'::jsonb, 100),
('digital_ebook_files', 'E-book / Digital File', 'ডিজিটাল ফাইলের format, language, pages/size ও usage license দিন।', 'BookOpen', '[{"key":"file_type","label_bn":"ফাইলের ধরন","type":"text","required":true},{"key":"language","label_bn":"ভাষা","type":"text","required":true},{"key":"file_format","label_bn":"File format","type":"text","required":true},{"key":"page_count","label_bn":"পৃষ্ঠা / size","type":"text","required":false},{"key":"usage_license","label_bn":"ব্যবহারের লাইসেন্স","type":"text","required":true}]'::jsonb, 110),
('digital_game_service', 'Game Service', 'Game service বা boosting-এর scope, platform, completion window ও seller terms দিন।', 'Wrench', '[{"key":"game_name","label_bn":"গেমের নাম","type":"text","required":true},{"key":"service_type","label_bn":"সার্ভিসের ধরন","type":"text","required":true},{"key":"platform","label_bn":"প্ল্যাটফর্ম","type":"text","required":true},{"key":"completion_window","label_bn":"সম্ভাব্য সময়","type":"text","required":true},{"key":"buyer_requirements","label_bn":"Buyer-এর প্রয়োজনীয় তথ্য","type":"textarea","required":true}]'::jsonb, 120)
on conflict (category_id) do update set name_en = excluded.name_en, description_bn = excluded.description_bn, icon_key = excluded.icon_key, fields = excluded.fields, sort_order = excluded.sort_order, updated_at = now();

create or replace function public.seller_upsert_digital_listing_options(
  p_seller_id text,
  p_product_id uuid,
  p_specifications jsonb default '{}'::jsonb,
  p_auto_delivery_enabled boolean default true,
  p_deactivate_when_out_of_stock boolean default false,
  p_stock_mode text default 'UNLIMITED',
  p_stock_quantity integer default 0,
  p_fulfillment_window_minutes integer default 0,
  p_region_code text default 'GLOBAL',
  p_subscription_period text default '',
  p_warranty_period text default '',
  p_delivery_note text default ''
) returns void as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.seller_id = p_seller_id and p.is_digital = true
  ) then
    raise exception 'Digital listing not found or not yours';
  end if;
  if not exists (
    select 1 from public.seller_registrations
    where user_id = p_seller_id and listing_mode = 'DIGITAL' and status = 'APPROVED'
  ) then
    raise exception 'Digital listing requires an approved digital seller verification';
  end if;
  if jsonb_typeof(coalesce(p_specifications, '{}'::jsonb)) <> 'object' then
    raise exception 'Digital specifications must be a JSON object';
  end if;
  if coalesce(p_stock_mode, 'UNLIMITED') not in ('UNLIMITED', 'QUANTITY', 'KEY_POOL') then
    raise exception 'Invalid digital stock mode';
  end if;
  if coalesce(p_stock_quantity, 0) < 0 or coalesce(p_fulfillment_window_minutes, 0) < 0 then
    raise exception 'Digital stock and fulfillment values cannot be negative';
  end if;

  insert into public.product_digital_specs(
    product_id, seller_id, specifications, auto_delivery_enabled,
    deactivate_when_out_of_stock, stock_mode, stock_quantity,
    fulfillment_window_minutes, region_code, subscription_period,
    warranty_period, delivery_note, updated_at
  ) values (
    p_product_id, p_seller_id, coalesce(p_specifications, '{}'::jsonb),
    coalesce(p_auto_delivery_enabled, true), coalesce(p_deactivate_when_out_of_stock, false),
    coalesce(p_stock_mode, 'UNLIMITED'), coalesce(p_stock_quantity, 0),
    coalesce(p_fulfillment_window_minutes, 0), coalesce(nullif(trim(p_region_code), ''), 'GLOBAL'),
    coalesce(trim(p_subscription_period), ''), coalesce(trim(p_warranty_period), ''),
    coalesce(trim(p_delivery_note), ''), now()
  )
  on conflict (product_id) do update set
    seller_id = excluded.seller_id,
    specifications = excluded.specifications,
    auto_delivery_enabled = excluded.auto_delivery_enabled,
    deactivate_when_out_of_stock = excluded.deactivate_when_out_of_stock,
    stock_mode = excluded.stock_mode,
    stock_quantity = excluded.stock_quantity,
    fulfillment_window_minutes = excluded.fulfillment_window_minutes,
    region_code = excluded.region_code,
    subscription_period = excluded.subscription_period,
    warranty_period = excluded.warranty_period,
    delivery_note = excluded.delivery_note,
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_list_digital_category_templates(p_admin_id text)
returns setof public.digital_category_templates as $$
begin
  perform public.admin_assert(p_admin_id);
  return query select * from public.digital_category_templates order by sort_order, category_id;
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

create or replace function public.admin_upsert_digital_category_template(
  p_admin_id text,
  p_category_id text,
  p_name_bn text,
  p_name_en text default '',
  p_description_bn text default '',
  p_icon_key text default 'Package',
  p_fields jsonb default '[]'::jsonb,
  p_sort_order integer default 0,
  p_is_active boolean default true
) returns void as $$
begin
  perform public.admin_assert(p_admin_id);
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Category not found';
  end if;
  if coalesce(trim(p_name_bn), '') = '' then raise exception 'Bengali category name is required'; end if;
  if jsonb_typeof(coalesce(p_fields, '[]'::jsonb)) <> 'array' then raise exception 'Template fields must be an array'; end if;
  insert into public.digital_category_templates(category_id, name_en, description_bn, icon_key, fields, sort_order, is_active, updated_at)
  values (p_category_id, coalesce(trim(p_name_en), ''), coalesce(trim(p_description_bn), ''), coalesce(nullif(trim(p_icon_key), ''), 'Package'), coalesce(p_fields, '[]'::jsonb), coalesce(p_sort_order, 0), coalesce(p_is_active, true), now())
  on conflict (category_id) do update set
    name_en = excluded.name_en,
    description_bn = excluded.description_bn,
    icon_key = excluded.icon_key,
    fields = excluded.fields,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();
  perform public.admin_log(p_admin_id, 'UPSERT_DIGITAL_CATEGORY_TEMPLATE', 'DIGITAL_CATEGORY_TEMPLATE', p_category_id, jsonb_build_object('active', p_is_active));
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.seller_upsert_digital_listing_options(text, uuid, jsonb, boolean, boolean, text, integer, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.seller_upsert_digital_listing_options(text, uuid, jsonb, boolean, boolean, text, integer, integer, text, text, text, text) to service_role;
revoke all on function public.admin_list_digital_category_templates(text) from public, anon, authenticated;
grant execute on function public.admin_list_digital_category_templates(text) to service_role;
revoke all on function public.admin_upsert_digital_category_template(text, text, text, text, text, text, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.admin_upsert_digital_category_template(text, text, text, text, text, text, jsonb, integer, boolean) to service_role;
