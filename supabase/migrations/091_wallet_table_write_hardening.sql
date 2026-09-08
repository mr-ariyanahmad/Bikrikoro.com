-- Wallet table write hardening
revoke all on table public.wallet_ledger from public;
revoke all on table public.wallet_ledger from anon;
revoke all on table public.wallet_ledger from authenticated;
grant select on table public.wallet_ledger to service_role;

revoke all on table public.wallet_balances from public;
revoke all on table public.wallet_balances from anon;
revoke all on table public.wallet_balances from authenticated;
grant select on table public.wallet_balances to service_role;

drop policy if exists "Ledger rows are inserted by backend triggers only" on public.wallet_ledger;
drop policy if exists "Users can read their own wallet ledger" on public.wallet_ledger;
drop policy if exists "Users can read their own wallet balance" on public.wallet_balances;
