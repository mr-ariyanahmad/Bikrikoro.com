-- Emergency hardening: Firebase users must use the verified Vercel gateway.
-- No anon/authenticated client may mutate or enumerate financial/admin tables.

revoke all on table public.admin_members from anon, authenticated;
revoke all on table public.wallet_ledger from anon, authenticated;
revoke all on table public.wallet_balances from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.coupon_redemptions from anon, authenticated;

-- Coupons remain publicly readable only through the existing active-coupon RLS policy;
-- direct creation, editing, deletion and metadata enumeration are not allowed.
revoke insert, update, delete, truncate, references, trigger on table public.coupons from anon, authenticated;
grant select on table public.coupons to anon, authenticated;

alter table public.admin_members force row level security;
alter table public.wallet_ledger force row level security;
alter table public.wallet_balances force row level security;
alter table public.orders force row level security;
alter table public.payments force row level security;
alter table public.coupon_redemptions force row level security;

-- Remove any accidental direct execute path for the high-impact wallet functions.
revoke all on function public.user_wallet_balance(text) from public, anon, authenticated;
revoke all on function public.user_wallet_ledger(text, integer) from public, anon, authenticated;
revoke all on function public.request_wallet_withdrawal(text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.user_wallet_balance(text) to service_role;
grant execute on function public.user_wallet_ledger(text, integer) to service_role;
grant execute on function public.request_wallet_withdrawal(text, numeric, text, text) to service_role;
grant execute on function public.admin_adjust_customer_wallet(text, text, numeric, text) to service_role;
