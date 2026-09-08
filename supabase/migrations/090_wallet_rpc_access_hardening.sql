-- Wallet security hardening
--
-- The application uses Firebase for end-user authentication and calls these
-- functions through Vercel server functions with the Supabase service role.
-- They must never be callable by anon/authenticated clients because the
-- Firebase UID is an explicit function argument, not a Supabase JWT claim.

revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from public;
revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from anon;
revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from authenticated;
grant execute on function public.admin_adjust_customer_wallet(text, text, numeric, text) to service_role;

-- These read functions also accept an explicit Firebase UID. Keeping them
-- public allows any client to read another user's balance and ledger by UID.
revoke all on function public.user_wallet_balance(text) from public;
revoke all on function public.user_wallet_balance(text) from anon;
revoke all on function public.user_wallet_balance(text) from authenticated;
grant execute on function public.user_wallet_balance(text) to service_role;

revoke all on function public.user_wallet_ledger(text, integer) from public;
revoke all on function public.user_wallet_ledger(text, integer) from anon;
revoke all on function public.user_wallet_ledger(text, integer) from authenticated;
grant execute on function public.user_wallet_ledger(text, integer) to service_role;

comment on function public.admin_adjust_customer_wallet(text, text, numeric, text)
is 'Server-only wallet adjustment. Firebase-authenticated admin access is enforced by admin_assert_permission; callers must use the Vercel service-role gateway.';
