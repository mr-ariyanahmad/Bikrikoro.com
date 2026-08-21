-- BikriKoro — Issue 4 public product projection
--
-- Public browsers and SEO handlers read only the approved digital-product view.
-- Internal moderation/reviewer/archive/coordinate columns remain on the base
-- table and are available only to trusted server-side operations.

begin;

drop view if exists public.public_products;

create view public.public_products
with (security_barrier = true)
as
select
  id,
  title,
  description,
  price,
  original_price,
  images,
  video_url,
  category_id,
  condition,
  location,
  is_digital,
  seller_id,
  view_count,
  is_escrow_protected,
  supports_cod,
  free_delivery,
  fast_delivery,
  free_return,
  created_at
from public.products
where is_digital = true
  and is_hidden = false
  and approval_status = 'APPROVED';

revoke all on public.public_products from public;
revoke all on public.public_products from anon, authenticated;
grant select on public.public_products to anon, authenticated, service_role;

-- The browser must never query the base table. Seller/admin/server RPCs use
-- SECURITY DEFINER or the service-role gateway and remain compatible.
revoke all on table public.products from public, anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

commit;
