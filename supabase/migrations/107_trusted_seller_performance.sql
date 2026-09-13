-- Trusted Seller is performance-based and only available after identity verification.
create or replace function public.refresh_trusted_seller_level(p_user_id text)
returns table(seller_level text, successful_orders bigint, review_count bigint, average_rating numeric, dispute_rate numeric, account_age_days integer, policy_compliant boolean) as $$
declare
  v_created_at timestamptz;
  v_level text;
  v_successful bigint;
  v_reviews bigint;
  v_rating numeric;
  v_total_orders bigint;
  v_disputes bigint;
  v_age integer;
  v_compliant boolean;
  v_next text;
begin
  select p.created_at, p.seller_level, coalesce(p.is_blocked, false) = false
  into v_created_at, v_level, v_compliant
  from public.profiles p where p.id = p_user_id;
  if not found then raise exception 'Profile not found'; end if;

  select count(*) filter (where o.status = 'COMPLETED'), count(*), count(*) filter (where coalesce(o.dispute_status, '') <> '')
  into v_successful, v_total_orders, v_disputes
  from public.orders o where o.seller_id = p_user_id;
  select count(*), coalesce(avg(r.rating), 0)
  into v_reviews, v_rating
  from public.reviews r where r.seller_id = p_user_id and coalesce(r.is_hidden, false) = false;
  v_age := greatest(0, extract(day from now() - v_created_at)::integer);
  v_next := v_level;

  if v_level in ('VERIFIED', 'TRUSTED')
     and v_successful >= 10
     and v_reviews >= 5
     and v_rating >= 4.5
     and (case when v_total_orders = 0 then 0 else v_disputes::numeric / v_total_orders end) <= 0.05
     and v_age >= 30
     and v_compliant then
    v_next := 'TRUSTED';
  elsif v_level = 'TRUSTED' and not v_compliant then
    v_next := 'VERIFIED';
  end if;

  update public.profiles
  set seller_level = v_next,
      seller_trusted_at = case when v_next = 'TRUSTED' then coalesce(seller_trusted_at, now()) else null end
  where id = p_user_id;

  return query select v_next, v_successful, v_reviews, round(v_rating, 2), case when v_total_orders = 0 then 0::numeric else round(v_disputes::numeric / v_total_orders, 4) end, v_age, v_compliant;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.refresh_trusted_seller_level(text) from public, anon, authenticated;
grant execute on function public.refresh_trusted_seller_level(text) to service_role;
