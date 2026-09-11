create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null,
  product_id uuid references public.products(id) on delete set null,
  visitor_key text,
  created_at timestamptz not null default now()
);

create index if not exists search_events_query_created_idx on public.search_events (normalized_query, created_at desc);
create index if not exists search_events_product_query_idx on public.search_events (product_id, normalized_query, created_at desc);

alter table public.search_events enable row level security;
revoke all on table public.search_events from anon, authenticated;

create or replace function public.record_search_event(
  p_query text,
  p_product_id uuid default null,
  p_visitor_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized text := lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')));
  safe_visitor text := left(nullif(trim(coalesce(p_visitor_key, '')), ''), 80);
begin
  if char_length(normalized) < 2 or char_length(normalized) > 120 then
    return;
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.products p where p.id = p_product_id and p.is_digital = true
  ) then
    p_product_id := null;
  end if;
  insert into public.search_events (normalized_query, product_id, visitor_key)
  values (normalized, p_product_id, safe_visitor);
end;
$$;

grant execute on function public.record_search_event(text, uuid, text) to anon, authenticated;

create or replace function public.get_popular_searches(p_limit integer default 8)
returns table (query text, search_count bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select normalized_query as query, count(*)::bigint as search_count
  from public.search_events
  where created_at >= now() - interval '30 days'
  group by normalized_query
  order by count(*) desc, max(created_at) desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.get_popular_searches(integer) to anon, authenticated;

create or replace function public.get_search_product_scores(p_query text)
returns table (product_id uuid, click_count bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select e.product_id, count(*)::bigint as click_count
  from public.search_events e
  join public.products p on p.id = e.product_id and p.is_digital = true
  where e.product_id is not null
    and e.normalized_query = lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')))
    and e.created_at >= now() - interval '30 days'
  group by e.product_id
  order by count(*) desc
  limit 200;
$$;

grant execute on function public.get_search_product_scores(text) to anon, authenticated;

create or replace function public.prune_search_events(p_keep_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from public.search_events where created_at < now() - make_interval(days => greatest(30, least(coalesce(p_keep_days, 180), 730)));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.prune_search_events(integer) to service_role;
