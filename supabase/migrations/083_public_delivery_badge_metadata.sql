-- BikriKoro — public, non-sensitive delivery badge metadata
--
-- The buyer-facing catalog may reveal only the seller's automatic/manual
-- fulfillment choice. Delivery credentials, stock keys, notes and content
-- remain private to authenticated order participants.

begin;

create or replace view public.public_products
with (security_barrier = true)
as
select
  p.id,
  p.title,
  p.description,
  p.price,
  p.original_price,
  p.images,
  p.video_url,
  p.category_id,
  p.condition,
  p.location,
  p.is_digital,
  p.seller_id,
  p.view_count,
  p.is_escrow_protected,
  p.supports_cod,
  p.free_delivery,
  p.fast_delivery,
  p.free_return,
  p.created_at,
  coalesce(specs.auto_delivery_enabled, false) as auto_delivery_enabled
from public.products p
left join public.product_digital_specs specs on specs.product_id = p.id
where p.is_digital = true
  and p.is_hidden = false
  and p.approval_status = 'APPROVED';

grant select on public.public_products to anon, authenticated, service_role;

commit;
