begin;

create table if not exists public.product_share_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_share_events_product on public.product_share_events(product_id, created_at desc);
alter table public.product_share_events enable row level security;
revoke all on table public.product_share_events from public, anon, authenticated;
grant select, insert on table public.product_share_events to service_role;

create or replace function public.record_product_share(p_product_id uuid, p_user_id text default null)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_product_id is null or not exists (select 1 from public.products where id = p_product_id) then return false; end if;
  insert into public.product_share_events(product_id, user_id) values (p_product_id, nullif(trim(coalesce(p_user_id, '')), ''));
  return true;
end;
$$;
revoke all on function public.record_product_share(uuid, text) from public, authenticated;
grant execute on function public.record_product_share(uuid, text) to anon, authenticated, service_role;

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null,
  original_price numeric null,
  changed_at timestamptz not null default now(),
  changed_by text null,
  reason text null
);

create index if not exists idx_product_price_history_product on public.product_price_history(product_id, changed_at desc);
alter table public.product_price_history enable row level security;
revoke all on table public.product_price_history from public, anon, authenticated;
grant select, insert on table public.product_price_history to service_role;

create or replace function public.capture_product_price_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price or new.original_price is distinct from old.original_price then
    insert into public.product_price_history(product_id, price, original_price, changed_at, reason)
    values (new.id, new.price, new.original_price, now(), case when tg_op = 'INSERT' then 'initial' else 'price_update' end);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_product_price_history on public.products;
create trigger trg_capture_product_price_history
after insert or update of price, original_price on public.products
for each row execute function public.capture_product_price_history();

insert into public.product_price_history(product_id, price, original_price, changed_at, reason)
select p.id, p.price, p.original_price, coalesce(p.created_at, now()), 'backfill'
from public.products p
where not exists (select 1 from public.product_price_history h where h.product_id = p.id);

create or replace function public.admin_get_product_analytics(p_admin_id text, p_limit integer default 100)
returns jsonb language plpgsql security definer stable set search_path = public, pg_temp as $$
declare v_rows jsonb;
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  select coalesce(jsonb_agg(to_jsonb(q) order by q.conversion_rate desc, q.views desc), '[]'::jsonb)
  into v_rows
  from (
    select p.id, p.title, p.price, p.original_price, p.images[1] as image_url, p.seller_id,
      coalesce(p.view_count, 0)::integer as views,
      (select count(*)::integer from public.favorites f where f.product_id = p.id) as favorites,
      (select count(*)::integer from public.product_share_events s where s.product_id = p.id) as shares,
      (select count(*)::integer from public.orders o where o.product_id = p.id and o.status = 'COMPLETED') as completed_orders,
      coalesce(p.price, 0) * (select count(*)::numeric from public.orders o where o.product_id = p.id and o.status = 'COMPLETED') as revenue,
      case when coalesce(p.view_count, 0) = 0 then 0::numeric else round(((select count(*)::numeric from public.orders o where o.product_id = p.id and o.status = 'COMPLETED') / p.view_count) * 100, 2) end as conversion_rate
    from public.products p
    where p.is_digital = true and not coalesce(p.is_hidden, false) and coalesce(p.moderation_note, '') <> 'DELETE'
    order by p.view_count desc nulls last, p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ) q;
  return jsonb_build_object('products', v_rows, 'generated_at', now());
end;
$$;
revoke all on function public.admin_get_product_analytics(text, integer) from public, anon, authenticated;
grant execute on function public.admin_get_product_analytics(text, integer) to service_role;

create or replace function public.admin_get_product_price_history(p_admin_id text, p_product_id uuid)
returns setof public.product_price_history language plpgsql security definer stable set search_path = public, pg_temp as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'catalog.products');
  return query select * from public.product_price_history where product_id = p_product_id order by changed_at desc limit 50;
end;
$$;
revoke all on function public.admin_get_product_price_history(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_get_product_price_history(text, uuid) to service_role;

commit;
