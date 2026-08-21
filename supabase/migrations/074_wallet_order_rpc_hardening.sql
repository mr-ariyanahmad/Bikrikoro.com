-- BikriKoro — wallet and order RPC execution hardening
--
-- Identity model:
--   BikriKoro authenticates users with Firebase, not Supabase Auth.
--   Therefore auth.uid() cannot be used inside these RPCs for the current app.
--   The Vercel gateway verifies the Firebase ID token, derives token.uid, and
--   calls these RPCs with the service_role connection. Browser roles must not
--   be able to call the same identity-bearing functions directly.
--
-- This migration is intentionally idempotent. It revokes EXECUTE from PUBLIC,
-- anon, and authenticated, then grants EXECUTE only to service_role. Existing
-- function bodies and signatures remain unchanged, so the current protected
-- gateway continues to work without a checkout or order schema change.

begin;

do $$
declare
  item record;
  protected_names text[] := array[
    -- Order creation and payment
    'create_order_atomic',
    'create_order_pending_payment',
    'create_order_pending_payment_with_coupon',
    'create_order_wallet_payment',
    'create_order_wallet_payment_with_coupon',

    -- Private order reads and library access
    'buyer_list_orders',
    'buyer_get_order',
    'buyer_get_payment_state',
    'buyer_has_order_review',
    'get_digital_library',

    -- Buyer and seller order transitions
    'buyer_cancel_pending_order',
    'buyer_cancel_order',
    'buyer_confirm_digital_delivery',
    'confirm_order_delivery',
    'seller_deliver_digital',
    'seller_mark_preparing',
    'seller_mark_shipped',
    'seller_mark_delivered',
    'seller_cancel_order',

    -- Disputes and order reviews
    'report_order_dispute',
    'send_dispute_message',
    'submit_order_review',

    -- Wallet balance, ledger and withdrawal operations
    'user_wallet_balance',
    'user_wallet_ledger',
    'user_wallet_withdrawal_summary',
    'user_wallet_withdrawal_history',
    'request_wallet_withdrawal'
  ];
begin
  for item in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(protected_names)
  loop
    -- Keep SECURITY DEFINER functions deterministic against search_path attacks.
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

    -- No browser/client role may call an identity-bearing financial or order RPC.
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

    -- The Firebase-verified Vercel gateway uses the service-role connection.
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      item.schema_name,
      item.function_name,
      item.identity_args
    );
  end loop;
end;
$$;

commit;
