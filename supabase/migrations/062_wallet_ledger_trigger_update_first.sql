-- BikriKoro wallet ledger trigger repair.
--
-- The previous ON CONFLICT implementation could attempt to insert a negative
-- balance row in deployed environments where the conflict target or trigger
-- state was inconsistent. Update the existing balance first, and only create
-- a missing row for a positive credit. A debit without a balance row must fail
-- instead of creating an invalid negative balance.

create or replace function public.apply_wallet_ledger_entry()
returns trigger as $$
begin
  update public.wallet_balances
  set available_balance = available_balance + new.amount,
      updated_at = now()
  where user_id = new.user_id;

  if not found then
    if new.amount < 0 then
      raise exception 'Wallet balance row missing before debit';
    end if;

    insert into public.wallet_balances (user_id, available_balance, updated_at)
    values (new.user_id, new.amount, now());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_apply_wallet_ledger_entry on public.wallet_ledger;

create trigger trg_apply_wallet_ledger_entry
after insert on public.wallet_ledger
for each row execute function public.apply_wallet_ledger_entry();
