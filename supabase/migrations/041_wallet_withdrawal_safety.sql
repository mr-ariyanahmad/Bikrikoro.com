-- BikriKoro — safe payout settlement
-- Prevents a PAID withdrawal from attempting to make available_balance negative.
-- The wallet row is locked so concurrent payouts cannot spend the same balance.

create or replace function public.apply_paid_withdrawal()
returns trigger as $$
declare
  v_available numeric;
begin
  if new.status = 'PAID' and old.status is distinct from 'PAID' then
    select available_balance
      into v_available
    from public.wallet_balances
    where user_id = new.user_id
    for update;

    if v_available is null then
      raise exception 'Seller wallet balance not found';
    end if;

    if v_available < new.amount then
      raise exception 'Insufficient wallet balance: available %, requested %', v_available, new.amount;
    end if;

    if new.processed_at is null then
      new.processed_at := now();
    end if;

    insert into public.wallet_ledger (user_id, type, amount, withdrawal_request_id, description)
    values (new.user_id, 'WITHDRAWAL', -new.amount, new.id, 'উত্তোলন — ' || new.method);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_apply_paid_withdrawal on public.wallet_withdrawal_requests;
create trigger trg_apply_paid_withdrawal
before update on public.wallet_withdrawal_requests
for each row execute function public.apply_paid_withdrawal();
