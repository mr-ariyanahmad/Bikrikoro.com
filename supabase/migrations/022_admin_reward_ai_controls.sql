-- Admin controls for rewards and AI Help. The Agent Router secret remains server-only in Vercel env vars.
create or replace function public.claim_daily_checkin(p_user_id text)
returns table(claimed boolean, awarded_coins integer, total_coins bigint, streak integer) as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_yesterday date := v_today - 1;
  v_claimed integer;
  v_reward integer := greatest(1, least(coalesce((select nullif(setting_value->>'value', '')::integer from public.admin_settings where setting_key = 'reward_daily_checkin_coins'), 10), 100));
  v_total bigint;
  v_streak integer;
begin
  insert into public.reward_claims(user_id, claim_date, coins)
  values (p_user_id, v_today, v_reward)
  on conflict (user_id, claim_date) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 1 then
    insert into public.reward_balances(user_id, coins, checkin_streak, last_checkin_date)
    values (p_user_id, v_reward, 1, v_today)
    on conflict (user_id) do update set
      coins = public.reward_balances.coins + v_reward,
      checkin_streak = case when public.reward_balances.last_checkin_date = v_yesterday then public.reward_balances.checkin_streak + 1 else 1 end,
      last_checkin_date = v_today,
      updated_at = now();
  end if;

  select rb.coins, rb.checkin_streak into v_total, v_streak from public.reward_balances rb where rb.user_id = p_user_id;
  return query select v_claimed = 1, case when v_claimed = 1 then v_reward else 0 end, coalesce(v_total, 0), coalesce(v_streak, 0);
end;
$$ language plpgsql security definer;
