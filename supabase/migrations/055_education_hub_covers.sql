-- Connect brand-owned visual covers to the live published education rows.
-- The URL paths are small repository-owned SVG assets and remain editable through Admin Content.

update public.admin_content
set cover_image_url = '/education/user-education-cover.svg',
    updated_at = now()
where slug = 'user-education'
  and content_type = 'USER_EDU';

update public.admin_content
set cover_image_url = '/education/seller-education-cover.svg',
    updated_at = now()
where slug = 'seller-education'
  and content_type = 'SELLER_EDU';
