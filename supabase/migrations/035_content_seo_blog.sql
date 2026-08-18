-- BikriKoro — Supabase-backed blog and SEO content

alter table public.admin_content
  add column if not exists cover_image_url text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published_at timestamptz;

create index if not exists idx_admin_content_blog_published
  on public.admin_content(content_type, status, published_at desc);

-- Replace the original eight-argument function so the admin editor can save
-- cover and SEO fields. Trailing defaults preserve old callers.
drop function if exists public.admin_upsert_content(text, uuid, text, text, text, text, text, text);
create or replace function public.admin_upsert_content(
  p_admin_id text,
  p_id uuid,
  p_content_type text,
  p_title text,
  p_slug text,
  p_excerpt text,
  p_body text,
  p_status text,
  p_cover_image_url text default null,
  p_seo_title text default null,
  p_seo_description text default null
) returns void as $$
begin
  perform public.admin_assert(p_admin_id);
  if p_content_type not in ('BLOG', 'ANNOUNCEMENT', 'ABOUT', 'PRIVACY', 'CONTACT', 'HELP', 'FAQ', 'USER_EDU', 'SELLER_EDU', 'RETURN_POLICY', 'TERMS', 'SETTINGS') then
    raise exception 'Invalid content type';
  end if;
  if p_status not in ('DRAFT', 'PUBLISHED', 'ARCHIVED') then
    raise exception 'Invalid content status';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_slug), '') = '' then
    raise exception 'Title and slug are required';
  end if;

  if p_id is null then
    insert into public.admin_content(
      content_type, title, slug, excerpt, body, status, author_id,
      cover_image_url, seo_title, seo_description, published_at
    ) values (
      p_content_type, trim(p_title), lower(trim(p_slug)), coalesce(p_excerpt, ''),
      coalesce(p_body, ''), p_status, coalesce(current_setting('request.jwt.claim.sub', true), null),
      nullif(trim(coalesce(p_cover_image_url, '')), ''),
      nullif(trim(coalesce(p_seo_title, '')), ''),
      nullif(trim(coalesce(p_seo_description, '')), ''),
      case when p_status = 'PUBLISHED' then now() else null end
    );
  else
    update public.admin_content
    set content_type = p_content_type,
        title = trim(p_title),
        slug = lower(trim(p_slug)),
        excerpt = coalesce(p_excerpt, ''),
        body = coalesce(p_body, ''),
        status = p_status,
        cover_image_url = nullif(trim(coalesce(p_cover_image_url, '')), ''),
        seo_title = nullif(trim(coalesce(p_seo_title, '')), ''),
        seo_description = nullif(trim(coalesce(p_seo_description, '')), ''),
        published_at = case when p_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end,
        updated_at = now()
    where id = p_id;
    if not found then raise exception 'Content not found'; end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_set_content_status(p_admin_id text, p_id uuid, p_status text)
returns void as $$
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('DRAFT', 'PUBLISHED', 'ARCHIVED') then raise exception 'Invalid content status'; end if;
  update public.admin_content
  set status = p_status,
      published_at = case when p_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end,
      updated_at = now()
  where id = p_id;
  if not found then raise exception 'Content not found'; end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.get_published_content(p_content_type text, p_slug text default null)
returns setof public.admin_content as $$
begin
  return query
  select * from public.admin_content
  where status = 'PUBLISHED'
    and content_type = p_content_type
    and (p_slug is null or slug = p_slug)
  order by coalesce(published_at, updated_at) desc;
end;
$$ language plpgsql security definer stable set search_path = public;

-- Initial Bengali editorial content is data, not frontend fallback copy.
insert into public.admin_content(
  content_type, title, slug, excerpt, body, status, cover_image_url,
  seo_title, seo_description, published_at
) values
(
  'BLOG',
  'নিরাপদে অনলাইনে কেনাকাটার ৭টি নিয়ম',
  'nirapode-online-kenakata-7-niyom',
  'BikriKoro-তে অর্ডার করার আগে কীভাবে seller, পণ্য ও payment যাচাই করবেন।',
  E'অনলাইনে কেনাকাটা সহজ, কিন্তু নিরাপদ সিদ্ধান্তের জন্য কয়েকটি বিষয় খেয়াল করা জরুরি। প্রথমে seller profile, verification badge, rating ও পুরোনো review দেখুন।\n\nপণ্যের description, ছবি, condition, delivery সময় এবং return/dispute নীতি ভালোভাবে পড়ুন। OTP, password বা payment তথ্য কখনো chat-এ পাঠাবেন না।\n\nBikriKoro-তে payment escrow flow অনুসরণ করুন এবং পণ্য হাতে পাওয়ার আগে অযাচাইকৃত নম্বরে আলাদা করে টাকা পাঠাবেন না। সমস্যা হলে Order Detail থেকে evidence-সহ report করুন।',
  'PUBLISHED',
  '/blog-safe-shopping.jpg',
  'নিরাপদ অনলাইন কেনাকাটার ৭টি নিয়ম | BikriKoro',
  'বাংলাদেশে নিরাপদ online shopping-এর জন্য seller, product, payment ও dispute যাচাইয়ের ব্যবহারিক নিয়ম।',
  now()
),
(
  'BLOG',
  'বিশ্বস্ত seller চেনার সহজ উপায়',
  'bishwasto-seller-chinar-upay',
  'Seller verification, badge, review এবং order behavior দেখে কীভাবে ভালো seller বেছে নেবেন।',
  E'একজন বিশ্বস্ত seller শুধু ভালো ছবি বা কম দাম দেন না; তিনি সঠিক description, বাস্তব condition এবং পরিষ্কার delivery information দেন।\n\nSeller profile-এ verification status, rating, review count, পুরোনো product এবং response behavior দেখুন। অতিরিক্ত তাড়াহুড়ো, অস্বাভাবিক কম দাম বা platform-এর বাইরে payment চাওয়া সতর্কতার সংকেত।\n\nকেনার আগে seller-কে product প্রশ্ন করুন এবং chat-এর কথোপকথন platform-এর ভিতরেই রাখুন।',
  'PUBLISHED',
  '/blog-trusted-sellers.jpg',
  'বিশ্বস্ত seller চেনার সহজ উপায় | BikriKoro',
  'BikriKoro marketplace-এ trusted seller বাছাইয়ের জন্য verification, review, price ও communication guide।',
  now()
),
(
  'BLOG',
  'ভালো product listing তৈরি করার গাইড',
  'bhalo-product-listing-toiri-guide',
  'সঠিক ছবি, title, description, price ও delivery তথ্য দিয়ে listing-এর বিশ্বাসযোগ্যতা বাড়ান।',
  E'ভালো listing-এর প্রথম শর্ত হলো পরিষ্কার title এবং বাস্তব ছবি। প্রথম ছবিতে product-এর মূল অবস্থা স্পষ্ট রাখুন, অতিরিক্ত filter বা misleading edit এড়িয়ে চলুন।\n\nDescription-এ brand, model, ব্যবহারকাল, defect, accessories, location এবং কেন বিক্রি করছেন তা লিখুন। Original price ও current price সঠিক রাখুন এবং যে delivery সুবিধা সত্যিই দিতে পারবেন শুধু সেটিই বেছে নিন।\n\nProduct video থাকলে একটি ছোট, পরিষ্কার YouTube demonstration যোগ করুন। এতে buyer product-এর বাস্তব অবস্থা দ্রুত বুঝতে পারবেন।',
  'PUBLISHED',
  '/blog-better-listings.jpg',
  'ভালো product listing তৈরি করার গাইড | BikriKoro',
  'BikriKoro seller-দের জন্য product photo, description, price, delivery ও video listing best practices।',
  now()
)
on conflict (slug) do nothing;
