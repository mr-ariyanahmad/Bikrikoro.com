-- Reward coins are separate from the BDT wallet. They cannot be withdrawn or used as money.
create table if not exists public.reward_balances (
  user_id text primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  checkin_streak integer not null default 0 check (checkin_streak >= 0),
  last_checkin_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  claim_date date not null,
  coins integer not null default 10 check (coins > 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_date)
);

alter table public.reward_balances enable row level security;
alter table public.reward_claims enable row level security;
drop policy if exists "Users can read reward balance" on public.reward_balances;
create policy "Users can read reward balance" on public.reward_balances for select using (true);
drop policy if exists "Users can read own reward claims" on public.reward_claims;
create policy "Users can read own reward claims" on public.reward_claims for select using (true);

create or replace function public.claim_daily_checkin(p_user_id text)
returns table(claimed boolean, awarded_coins integer, total_coins bigint, streak integer) as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_yesterday date := v_today - 1;
  v_claimed integer;
  v_total bigint;
  v_streak integer;
begin
  insert into public.reward_claims(user_id, claim_date, coins)
  values (p_user_id, v_today, 10)
  on conflict (user_id, claim_date) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 1 then
    insert into public.reward_balances(user_id, coins, checkin_streak, last_checkin_date)
    values (p_user_id, 10, 1, v_today)
    on conflict (user_id) do update set
      coins = public.reward_balances.coins + 10,
      checkin_streak = case when public.reward_balances.last_checkin_date = v_yesterday then public.reward_balances.checkin_streak + 1 else 1 end,
      last_checkin_date = v_today,
      updated_at = now();
  end if;

  select rb.coins, rb.checkin_streak into v_total, v_streak from public.reward_balances rb where rb.user_id = p_user_id;
  return query select v_claimed = 1, case when v_claimed = 1 then 10 else 0 end, coalesce(v_total, 0), coalesce(v_streak, 0);
end;
$$ language plpgsql security definer;
