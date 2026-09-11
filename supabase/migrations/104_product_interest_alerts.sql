create table if not exists public.product_category_interests (
  user_id text not null references public.profiles(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  score numeric(10,2) not null default 0,
  last_viewed_at timestamptz not null default now(),
  email_alerts_enabled boolean not null default true,
  last_alert_at timestamptz,
  primary key (user_id, category_id)
);
create index if not exists idx_product_category_interests_alerts on public.product_category_interests(category_id, score desc, email_alerts_enabled, last_alert_at);
alter table public.product_category_interests enable row level security;
revoke all on public.product_category_interests from anon, authenticated;
create or replace function public.record_product_category_interest(p_user_id text, p_category_id text, p_weight numeric default 1)
returns void as $$
begin
  insert into public.product_category_interests(user_id, category_id, score, last_viewed_at)
  values (p_user_id, p_category_id, least(coalesce(p_weight, 1), 5), now())
  on conflict (user_id, category_id) do update set score = least(product_category_interests.score * 0.98 + excluded.score, 100), last_viewed_at = now();
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
revoke all on function public.record_product_category_interest(text, text, numeric) from public, anon, authenticated;
grant execute on function public.record_product_category_interest(text, text, numeric) to service_role;
