create or replace function public.admin_upsert_coupon(
  p_admin_id text,
  p_code text,
  p_description text,
  p_discount_type text,
  p_discount_value numeric,
  p_min_subtotal numeric,
  p_max_redemptions integer,
  p_active_until timestamptz,
  p_funding_source text default 'PLATFORM',
  p_seller_id text default null
) returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'sales.coupons');
  if coalesce(p_funding_source, 'PLATFORM') not in ('PLATFORM', 'SELLER') then
    raise exception 'Invalid coupon funding source';
  end if;
  if p_funding_source = 'SELLER' and nullif(trim(p_seller_id), '') is null then
    raise exception 'Seller ID is required for seller-funded coupon';
  end if;
  insert into public.coupons(code, description, discount_type, discount_value, min_subtotal, max_redemptions, active_until, active, funding_source, seller_id)
  values (upper(trim(p_code)), coalesce(p_description, ''), p_discount_type, p_discount_value, greatest(coalesce(p_min_subtotal, 0), 0), p_max_redemptions, p_active_until, true, coalesce(p_funding_source, 'PLATFORM'), nullif(trim(p_seller_id), ''))
  on conflict (code) do update set description = excluded.description, discount_type = excluded.discount_type, discount_value = excluded.discount_value, min_subtotal = excluded.min_subtotal, max_redemptions = excluded.max_redemptions, active_until = excluded.active_until, funding_source = excluded.funding_source, seller_id = excluded.seller_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke all on function public.admin_upsert_coupon(text, text, text, text, numeric, numeric, integer, timestamptz, text, text) from public;
grant execute on function public.admin_upsert_coupon(text, text, text, text, numeric, numeric, integer, timestamptz, text, text) to service_role;
