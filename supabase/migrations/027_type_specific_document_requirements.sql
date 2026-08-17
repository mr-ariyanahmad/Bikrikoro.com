-- BikriKoro — type-specific seller verification requirements
-- This repairs databases where the initial 023 seed was not applied or was partially seeded.

-- Remove stale OTHER-sector baseline rows that caused every seller type to show the same documents.
delete from public.seller_document_requirements
where listing_mode = 'DIGITAL' and sector = 'OTHER' and business_type = 'PERSONAL'
  and document_type not in ('NID_FRONT', 'NID_BACK', 'SELFIE', 'OWNERSHIP_PROOF');
delete from public.seller_document_requirements
where listing_mode = 'DIGITAL' and sector = 'OTHER' and business_type = 'BUSINESS'
  and document_type not in ('NID_FRONT', 'NID_BACK', 'TRADE_LICENSE', 'TIN_CERTIFICATE', 'AUTHORIZATION_LETTER', 'OWNERSHIP_PROOF');
delete from public.seller_document_requirements
where listing_mode = 'DIGITAL' and sector = 'OTHER' and business_type = 'COMPANY'
  and document_type not in ('NID_FRONT', 'NID_BACK', 'TRADE_LICENSE', 'TIN_CERTIFICATE', 'BIN_VAT', 'INCORPORATION_CERTIFICATE', 'AUTHORIZATION_LETTER', 'OWNERSHIP_PROOF');

insert into public.seller_document_requirements (listing_mode, business_type, sector, document_type, document_label, help_text, required, sort_order, active)
values
  ('DIGITAL', 'PERSONAL', 'OTHER', 'NID_FRONT', 'NID-এর সামনের অংশ', 'কার্ডের চার কোণা, নাম ও ছবি পরিষ্কার দেখা যাবে।', true, 10, true),
  ('DIGITAL', 'PERSONAL', 'OTHER', 'NID_BACK', 'NID-এর পেছনের অংশ', 'লেখা, QR/barcode এবং চার কোণা পরিষ্কার দেখা যাবে।', true, 20, true),
  ('DIGITAL', 'PERSONAL', 'OTHER', 'SELFIE', 'NID হাতে selfie', 'মুখ খোলা এবং হাতে ধরা NID একই ছবিতে পরিষ্কার দেখা যাবে।', true, 30, true),
  ('DIGITAL', 'PERSONAL', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'নিজের তৈরি কাজ, license বা source ownership-এর প্রমাণ দিন।', true, 40, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'NID_FRONT', 'মালিক/প্রতিনিধির NID সামনের অংশ', 'ব্যবসার মালিক বা authorized representative-এর NID দিন।', true, 10, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'NID_BACK', 'মালিক/প্রতিনিধির NID পেছনের অংশ', 'NID-এর লেখা ও QR/barcode পরিষ্কার দেখা যাবে।', true, 20, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'TRADE_LICENSE', 'Trade License', 'ব্যবসার নাম, ঠিকানা ও validity-সহ বর্তমান কপি দিন।', true, 30, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'TIN_CERTIFICATE', 'e-TIN Certificate', 'ব্যবসার tax identity-এর বর্তমান কপি দিন।', true, 40, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'AUTHORIZATION_LETTER', 'ব্যবসার authorization letter', 'আপনি মালিক নন, প্রতিনিধি হলে signed authorization দিন।', false, 50, true),
  ('DIGITAL', 'BUSINESS', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'নিজের তৈরি কাজ, license বা source ownership-এর প্রমাণ দিন।', true, 60, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'NID_FRONT', 'Authorized representative NID সামনের অংশ', 'কোম্পানির পক্ষে আবেদনকারী প্রতিনিধির NID দিন।', true, 10, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'NID_BACK', 'Authorized representative NID পেছনের অংশ', 'NID-এর লেখা ও QR/barcode পরিষ্কার দেখা যাবে।', true, 20, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'TRADE_LICENSE', 'Company Trade License', 'কোম্পানির নাম, ঠিকানা ও validity-সহ বর্তমান কপি দিন।', true, 30, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'TIN_CERTIFICATE', 'Company e-TIN Certificate', 'কোম্পানির tax identity-এর বর্তমান কপি দিন।', true, 40, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'BIN_VAT', 'BIN/VAT Certificate', 'প্রযোজ্য হলে কোম্পানির বর্তমান BIN/VAT কপি দিন।', true, 50, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'INCORPORATION_CERTIFICATE', 'Company Registration Certificate', 'কোম্পানি registration/incorporation-এর প্রমাণ দিন।', true, 60, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'AUTHORIZATION_LETTER', 'Authorized representative letter', 'কোম্পানির পক্ষে আবেদন করলে signed authorization দিন।', true, 70, true),
  ('DIGITAL', 'COMPANY', 'OTHER', 'OWNERSHIP_PROOF', 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', 'কোম্পানি কীভাবে পণ্যের মালিক তা প্রমাণ দিন।', true, 80, true)
on conflict (listing_mode, business_type, sector, document_type) do update set
  document_label = excluded.document_label,
  help_text = excluded.help_text,
  required = excluded.required,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Always return the selected type's baseline requirements plus any sector-specific additions.
create or replace function public.get_seller_document_requirements(p_listing_mode text, p_business_type text, p_sector text default 'OTHER')
returns setof public.seller_document_requirements as $$
begin
  if p_listing_mode not in ('DIGITAL', 'PHYSICAL') then raise exception 'Invalid listing mode'; end if;
  if p_business_type not in ('PERSONAL', 'BUSINESS', 'COMPANY') then raise exception 'Invalid business type'; end if;
  return query
  select r.*
  from public.seller_document_requirements r
  where r.active = true
    and r.listing_mode = p_listing_mode
    and r.business_type = p_business_type
    and r.sector in (upper(coalesce(nullif(trim(p_sector), ''), 'OTHER')), 'OTHER')
  order by case when r.sector = upper(coalesce(nullif(trim(p_sector), ''), 'OTHER')) then 0 else 1 end, r.sort_order;
end;
$$ language plpgsql security definer stable;
