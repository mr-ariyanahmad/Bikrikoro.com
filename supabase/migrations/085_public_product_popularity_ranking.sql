-- BikriKoro — scalable public product popularity ranking
--
-- Only aggregate engagement and completed-order counts are exposed to public
-- catalog clients. Buyer identities, order records, payment data, and the
-- browser's private daily view token remain unavailable to public reads.

begin;

alter table public.products
  add column if not exists completed_order_count integer not null default 0,
  add column if not exists popularity_score integer not null default 0;

create table if not exists public.product_public_view_events (
  product_id uuid not null references public.products(id) on delete cascade,
  visitor_token_hash text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (product_id, visitor_token_hash, viewed_on)
);

alter table public.product_public_view_events enable row level security;
revoke all on table public.product_public_view_events from public, anon, authenticated;
grant select, insert, update, delete on table public.product_public_view_events to service_role;
create index if not exists idx_product_public_view_events_viewed_on
  on public.product_public_view_events (viewed_on);

create or replace function public.refresh_product_popularity(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_completed_order_count integer;
  v_view_count integer;
begin
  select count(*)::integer
  into v_completed_order_count
  from public.orders
  where product_id = p_product_id
    and status = 'COMPLETED';

  select greatest(coalesce(view_count, 0), 0)
  into v_view_count
  from public.products
  where id = p_product_id;

  if not found then
    return;
  end if;

  update public.products
  set
    completed_order_count = coalesce(v_completed_order_count, 0),
    popularity_score = coalesce(v_completed_order_count, 0) * 100 + least(v_view_count, 80)
  where id = p_product_id;
end;
$$;

create or replace function public.sync_product_popularity_from_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_popularity(old.product_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.refresh_product_popularity(old.product_id);
  end if;

  perform public.refresh_product_popularity(new.product_id);
  return new;
end;
$$;

drop trigger if exists trg_sync_product_popularity_from_order on public.orders;
create trigger trg_sync_product_popularity_from_order
after insert or update or delete on public.orders
for each row execute function public.sync_product_popularity_from_order();

create or replace function public.record_public_product_view(
  p_product_id uuid,
  p_visitor_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recorded boolean := false;
begin
  if p_product_id is null or p_visitor_token is null then
    return false;
  end if;

  if not exists (select 1 from public.public_products where id = p_product_id) then
    return false;
  end if;

  delete from public.product_public_view_events
  where viewed_on < current_date - 90;

  insert into public.product_public_view_events (product_id, visitor_token_hash, viewed_on)
  values (p_product_id, md5(p_visitor_token::text), current_date)
  on conflict do nothing
  returning true into v_recorded;

  if coalesce(v_recorded, false) then
    update public.products
    set view_count = greatest(coalesce(view_count, 0), 0) + 1
    where id = p_product_id;
    perform public.refresh_product_popularity(p_product_id);
  end if;

  return coalesce(v_recorded, false);
end;
$$;

grant execute on function public.record_public_product_view(uuid, uuid) to anon, authenticated, service_role;

do $$
declare
  item record;
begin
  for item in select id from public.products loop
    perform public.refresh_product_popularity(item.id);
  end loop;
end;
$$;

create index if not exists idx_products_public_popularity
  on public.products (popularity_score desc, view_count desc, created_at desc, id desc)
  where is_digital = true and is_hidden = false and approval_status = 'APPROVED';

create extension if not exists pg_trgm;
create index if not exists idx_products_public_title_trgm
  on public.products using gin (title gin_trgm_ops)
  where is_digital = true and is_hidden = false and approval_status = 'APPROVED';

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
  coalesce(specs.auto_delivery_enabled, false) as auto_delivery_enabled,
  p.completed_order_count,
  p.popularity_score
from public.products p
left join public.product_digital_specs specs on specs.product_id = p.id
where p.is_digital = true
  and p.is_hidden = false
  and p.approval_status = 'APPROVED';

grant select on public.public_products to anon, authenticated, service_role;

commit;
