-- BikriKoro — Issue 7: production security-baseline marker
--
-- This migration is intentionally additive and idempotent. It does not alter
-- buyer/seller data or payment behavior. It records the exact hardening
-- baseline expected by the repository and exposes a service-only verification
-- RPC for the protected admin health endpoint.

begin;

create table if not exists public.security_schema_baseline (
  baseline_key text primary key,
  migration_version text not null,
  required_hardening text[] not null default '{}',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.security_schema_baseline enable row level security;
revoke all on table public.security_schema_baseline from public, anon, authenticated;
grant select on table public.security_schema_baseline to service_role;

insert into public.security_schema_baseline (
  baseline_key,
  migration_version,
  required_hardening
)
values (
  'bikrikoro.security.baseline',
  '080_security_baseline',
  array[
    '074_wallet_order_rpc_hardening',
    '075_chat_rpc_hardening',
    '076_user_scoped_features_hardening',
    '077_public_product_projection',
    '078_product_question_report_hardening',
    '079_retire_legacy_saved_addresses'
  ]
)
on conflict (baseline_key) do update set
  migration_version = excluded.migration_version,
  required_hardening = excluded.required_hardening,
  updated_at = now();

create or replace function public.admin_get_security_baseline(p_admin_id text)
returns jsonb as $$
declare
  v_baseline public.security_schema_baseline%rowtype;
  v_public_product_view boolean;
  v_public_question_view boolean;
  v_products_browser_blocked boolean;
  v_user_scoped_tables_blocked boolean;
  v_legacy_address_functions_removed boolean;
  v_ready boolean;
begin
  perform public.admin_assert_permission(p_admin_id, 'settings.system');

  select * into v_baseline
  from public.security_schema_baseline
  where baseline_key = 'bikrikoro.security.baseline';

  v_public_product_view := to_regclass('public.public_products') is not null;
  v_public_question_view := to_regclass('public.public_product_questions') is not null;

  v_products_browser_blocked := not has_table_privilege('anon', 'public.products', 'select')
    and not has_table_privilege('authenticated', 'public.products', 'select')
    and has_table_privilege('anon', 'public.public_products', 'select')
    and has_table_privilege('authenticated', 'public.public_products', 'select');

  v_user_scoped_tables_blocked := not has_table_privilege('anon', 'public.chat_threads', 'select')
    and not has_table_privilege('authenticated', 'public.chat_threads', 'select')
    and not has_table_privilege('anon', 'public.chat_messages', 'select')
    and not has_table_privilege('authenticated', 'public.chat_messages', 'select')
    and not has_table_privilege('anon', 'public.product_alerts', 'select')
    and not has_table_privilege('authenticated', 'public.product_alerts', 'select')
    and not has_table_privilege('anon', 'public.seller_follows', 'select')
    and not has_table_privilege('authenticated', 'public.seller_follows', 'select')
    and not has_table_privilege('anon', 'public.product_questions', 'select')
    and not has_table_privilege('authenticated', 'public.product_questions', 'select')
    and not has_table_privilege('anon', 'public.product_reports', 'select')
    and not has_table_privilege('authenticated', 'public.product_reports', 'select')
    and not has_table_privilege('anon', 'public.saved_addresses', 'select')
    and not has_table_privilege('authenticated', 'public.saved_addresses', 'select');

  select not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('list_saved_addresses', 'upsert_saved_address', 'delete_saved_address')
  ) into v_legacy_address_functions_removed;

  v_ready := v_baseline.migration_version = '080_security_baseline'
    and v_public_product_view
    and v_public_question_view
    and v_products_browser_blocked
    and v_user_scoped_tables_blocked
    and v_legacy_address_functions_removed;

  return jsonb_build_object(
    'baseline_key', coalesce(v_baseline.baseline_key, ''),
    'migration_version', coalesce(v_baseline.migration_version, ''),
    'applied_at', v_baseline.applied_at,
    'updated_at', v_baseline.updated_at,
    'ready', v_ready,
    'checks', jsonb_build_object(
      'public_product_projection', v_public_product_view,
      'public_question_projection', v_public_question_view,
      'base_product_browser_read_blocked', v_products_browser_blocked,
      'user_scoped_table_browser_read_blocked', v_user_scoped_tables_blocked,
      'legacy_saved_address_functions_removed', v_legacy_address_functions_removed
    )
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.admin_get_security_baseline(text) from public, anon, authenticated;
grant execute on function public.admin_get_security_baseline(text) to service_role;

create or replace function public.admin_get_system_status(p_admin_id text)
returns jsonb as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'settings.system');
  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'products', (select count(*) from public.products),
    'orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'PENDING_PAYMENT'),
    'schema_marker', '080_security_baseline',
    'security_baseline', public.admin_get_security_baseline(p_admin_id),
    'updated_at', now()
  );
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.admin_get_system_status(text) from public, anon, authenticated;
grant execute on function public.admin_get_system_status(text) to service_role;

commit;
