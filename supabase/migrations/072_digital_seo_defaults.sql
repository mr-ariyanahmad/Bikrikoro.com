-- 072_digital_seo_defaults.sql
-- Keep public SEO settings aligned with BikriKoro's digital-only marketplace.
-- The Google verification value intentionally remains empty until the owner
-- supplies the real Search Console token through Vercel or Admin Settings.

insert into public.admin_settings(setting_key, setting_value, updated_by)
values
  (
    'public_seo_title',
    jsonb_build_object('value', 'BikriKoro.Com — বাংলাদেশের নিরাপদ ডিজিটাল পণ্য মার্কেটপ্লেস'),
    'seo-hardening'
  ),
  (
    'public_seo_description',
    jsonb_build_object('value', 'BikriKoro (বিক্রিকরো) — বাংলাদেশের ডিজিটাল পণ্য কেনাবেচার নির্ভরযোগ্য মার্কেটপ্লেস। গেম অ্যাকাউন্ট, ডিজিটাল কী, ফাইল, গিফট কার্ড, সফটওয়্যার, কোর্স ও অনলাইন সার্ভিস নিরাপদে কিনুন ও বিক্রি করুন।'),
    'seo-hardening'
  ),
  (
    'public_seo_og_image',
    jsonb_build_object('value', 'https://www.bikrikoro.com/og-image.jpg'),
    'seo-hardening'
  ),
  (
    'public_seo_google_verification',
    jsonb_build_object('value', ''),
    'seo-hardening'
  )
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_by = excluded.updated_by,
    updated_at = now();
