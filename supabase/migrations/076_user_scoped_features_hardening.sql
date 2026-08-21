-- BikriKoro — Issue 3 user-scoped feature hardening
--
-- Firebase is the application identity provider. Browser clients now call the
-- /api/user-features gateway, which verifies the Firebase ID token and invokes
-- these RPCs using the service_role connection.
--
-- This migration removes the legacy permissive browser policies and direct
-- PostgREST execution. It preserves the existing RPC signatures so database
-- triggers and the authenticated server gateway remain compatible.

begin;

-- Saved addresses are obsolete for the digital-only checkout. Remove their
-- browser-facing table access and keep the legacy functions server-only for
-- data-retention or controlled administrative cleanup.
drop policy if exists "Saved addresses readable" on public.saved_addresses;
drop policy if exists "Saved addresses writable through functions" on public.saved_addresses;
revoke all on table public.saved_addresses from public, anon, authenticated;
grant select, insert, update, delete on table public.saved_addresses to service_role;

-- Active product-alert and seller-follow state is accessed only through the
-- Firebase-verified user-features gateway.
drop policy if exists "Users manage product alerts" on public.product_alerts;
drop policy if exists "Users manage seller follows" on public.seller_follows;
revoke all on table public.product_alerts from public, anon, authenticated;
revoke all on table public.seller_follows from public, anon, authenticated;
grant select, insert, update, delete on table public.product_alerts to service_role;
grant select, insert, update, delete on table public.seller_follows to service_role;

do $$
declare
  item record;
  protected_names text[] := array[
    'list_saved_addresses',
    'upsert_saved_address',
    'delete_saved_address',
    'toggle_product_alert',
    'toggle_seller_follow'
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
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

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
