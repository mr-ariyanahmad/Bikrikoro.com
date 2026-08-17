-- Strong seller verification for digital products. Existing registrations remain compatible.
alter table public.seller_registrations add column if not exists listing_mode text not null default 'PHYSICAL' check (listing_mode in ('DIGITAL', 'PHYSICAL'));
alter table public.seller_registrations add column if not exists business_type text not null default 'PERSONAL' check (business_type in ('PERSONAL', 'BUSINESS', 'COMPANY'));
alter table public.seller_registrations add column if not exists sector text not null default 'OTHER';

create table if not exists public.seller_document_requirements (
  id uuid primary key default gen_random_uuid(),
  listing_mode text not null check (listing_mode in ('DIGITAL', 'PHYSICAL')),
  business_type text not null check (business_type in ('PERSONAL', 'BUSINESS', 'COMPANY')),
  sector text not null default 'OTHER',
  document_type text not null,
  document_label text not null,
  help_text text not null default '',
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (listing_mode, business_type, sector, document_type)
);

create table if not exists public.seller_verification_documents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.seller_registrations(id) on delete cascade,
  document_type text not null,
  document_path text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (registration_id, document_type)
);

create table if not exists public.seller_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.seller_registrations(id) on delete cascade,
  admin_id text not null,
  action text not null check (action in ('SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'APPROVED', 'REJECTED', 'REQUESTED_CHANGES')),
  document_type text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.seller_verification_badges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  badge_label text not null,
  verified_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists idx_seller_docs_registration_status on public.seller_verification_documents(registration_id, status);
create index if not exists idx_seller_reviews_registration_created on public.seller_verification_reviews(registration_id, created_at desc);
create index if not exists idx_seller_badges_user on public.seller_verification_badges(user_id);

alter table public.seller_document_requirements enable row level security;
alter table public.seller_verification_documents enable row level security;
alter table public.seller_verification_reviews enable row level security;
alter table public.seller_verification_badges enable row level security;

drop policy if exists "Active document requirements are public" on public.seller_document_requirements;
create policy "Active document requirements are public" on public.seller_document_requirements for select using (active = true);
drop policy if exists "Users can read their verification documents" on public.seller_verification_documents;
create policy "Users can read their verification documents" on public.seller_verification_documents for select using (true);
drop policy if exists "Users can read their verification badges" on public.seller_verification_badges;
create policy "Users can read their verification badges" on public.seller_verification_badges for select using (true);

insert into public.seller_document_requirements (listing_mode, business_type, sector, document_type, document_label, help_text, required, sort_order) values
('DIGITAL', 'PERSONAL', 'OTHER', 'NID_FRONT', 'NID-এর সামনের অংশ', 'পরিষ্কার ও সম্পূর্ণ ছবি দিন।', true, 10),
('DIGITAL', 'PERSONAL', 'OTHER', 'NID_BACK', 'NID-এর পেছনের অংশ', 'লেখা ও QR/বারকোড যেন বোঝা যায়।', true, 20),
('DIGITAL', 'PERSONAL', 'OTHER', 'SELFIE', 'NID হাতে selfie', 'মুখ ও NID দুটোই পরিষ্কার দেখা যেতে হবে।', true, 30),
('DIGITAL', 'PERSONAL', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'Original work, license বা source ownership-এর প্রমাণ দিন।', true, 40),
('DIGITAL', 'BUSINESS', 'OTHER', 'NID_FRONT', 'মালিক/প্রতিনিধির NID সামনের অংশ', 'পরিষ্কার ও সম্পূর্ণ ছবি দিন।', true, 10),
('DIGITAL', 'BUSINESS', 'OTHER', 'NID_BACK', 'মালিক/প্রতিনিধির NID পেছনের অংশ', 'লেখা ও QR/বারকোড যেন বোঝা যায়।', true, 20),
('DIGITAL', 'BUSINESS', 'OTHER', 'TRADE_LICENSE', 'Trade License', 'বর্তমান ঠিকানা ও ব্যবসার নামসহ কপি দিন।', true, 30),
('DIGITAL', 'BUSINESS', 'OTHER', 'TIN_CERTIFICATE', 'e-TIN Certificate', 'ব্যবসার tax identity-এর কপি দিন।', true, 40),
('DIGITAL', 'BUSINESS', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'Original work, license বা source ownership-এর প্রমাণ দিন।', true, 50),
('DIGITAL', 'COMPANY', 'OTHER', 'NID_FRONT', 'Authorized representative NID সামনের অংশ', 'প্রতিনিধির পরিচয় যাচাইয়ের জন্য।', true, 10),
('DIGITAL', 'COMPANY', 'OTHER', 'NID_BACK', 'Authorized representative NID পেছনের অংশ', 'প্রতিনিধির পরিচয় যাচাইয়ের জন্য।', true, 20),
('DIGITAL', 'COMPANY', 'OTHER', 'TRADE_LICENSE', 'Trade License', 'বর্তমান registration তথ্যসহ কপি দিন।', true, 30),
('DIGITAL', 'COMPANY', 'OTHER', 'TIN_CERTIFICATE', 'e-TIN Certificate', 'কোম্পানির tax identity-এর কপি দিন।', true, 40),
('DIGITAL', 'COMPANY', 'OTHER', 'BIN_VAT', 'BIN/VAT Certificate', 'প্রযোজ্য হলে বর্তমান BIN/VAT কপি দিন।', true, 50),
('DIGITAL', 'COMPANY', 'OTHER', 'INCORPORATION_CERTIFICATE', 'Incorporation/Registration Certificate', 'কোম্পানি registration-এর প্রমাণ দিন।', true, 60),
('DIGITAL', 'COMPANY', 'OTHER', 'AUTHORIZATION_LETTER', 'Authorization Letter', 'প্রতিনিধি প্রতিষ্ঠানের পক্ষে কাজ করলে দিন।', true, 70),
('DIGITAL', 'COMPANY', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'Original work, license বা source ownership-এর প্রমাণ দিন।', true, 80)
on conflict (listing_mode, business_type, sector, document_type) do nothing;

create or replace function public.get_seller_document_requirements(p_listing_mode text, p_business_type text, p_sector text default 'OTHER')
returns setof public.seller_document_requirements as $$
begin
  return query
  select * from public.seller_document_requirements r
  where r.active = true and r.listing_mode = p_listing_mode and r.business_type = p_business_type
    and r.sector in (p_sector, 'OTHER')
  order by case when r.sector = p_sector then 0 else 1 end, r.sort_order;
end;
$$ language plpgsql security definer stable;

create or replace function public.submit_seller_registration_v2(
  p_user_id text,
  p_listing_mode text,
  p_business_type text,
  p_sector text,
  p_full_name text,
  p_phone text,
  p_nid_or_business_number text,
  p_business_name text,
  p_address text,
  p_documents jsonb
) returns uuid as $$
declare
  v_registration_id uuid;
  v_required text;
  v_has_document boolean;
begin
  if p_listing_mode not in ('DIGITAL', 'PHYSICAL') then raise exception 'Invalid listing mode'; end if;
  if p_business_type not in ('PERSONAL', 'BUSINESS', 'COMPANY') then raise exception 'Invalid business type'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 or length(trim(coalesce(p_address, ''))) < 5 then raise exception 'Basic identity fields are incomplete'; end if;
  if jsonb_typeof(p_documents) <> 'array' then raise exception 'Documents must be an array'; end if;
  if exists (select 1 from public.seller_registrations where user_id = p_user_id and status in ('PENDING', 'APPROVED')) then raise exception 'You already have a pending or approved registration'; end if;

  for v_required in select r.document_type from public.get_seller_document_requirements(p_listing_mode, p_business_type, p_sector) r where r.required loop
    select exists (select 1 from jsonb_array_elements(p_documents) d where d->>'document_type' = v_required and length(trim(coalesce(d->>'document_path', ''))) > 4) into v_has_document;
    if not v_has_document then raise exception 'Missing required document: %', v_required; end if;
  end loop;

  insert into public.seller_registrations (user_id, seller_type, full_name, phone, nid_or_business_number, business_name, address, document_path, listing_mode, business_type, sector)
  values (p_user_id, case when p_business_type = 'PERSONAL' then 'INDIVIDUAL' else 'BUSINESS' end, trim(p_full_name), trim(p_phone), trim(p_nid_or_business_number), nullif(trim(coalesce(p_business_name, '')), ''), trim(p_address), coalesce(p_documents->0->>'document_path', 'MULTI_DOCUMENT'), p_listing_mode, p_business_type, upper(trim(coalesce(p_sector, 'OTHER'))))
  returning id into v_registration_id;

  insert into public.seller_verification_documents (registration_id, document_type, document_path)
  select v_registration_id, d->>'document_type', d->>'document_path' from jsonb_array_elements(p_documents) d;
  insert into public.seller_verification_reviews (registration_id, admin_id, action, note) values (v_registration_id, p_user_id, 'SUBMITTED', 'Application submitted');
  return v_registration_id;
end;
$$ language plpgsql security definer;
