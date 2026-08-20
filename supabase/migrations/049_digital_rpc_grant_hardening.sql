-- BikriKoro — migration 049: DIGITAL RPC grant hardening
-- Migration 048 blocked direct table reads/writes, but older migrations had
-- explicit anon/authenticated EXECUTE grants on security-definer RPCs.
-- The application now uses Firebase-verified server gateways, so these
-- secret-bearing and admin-scoped routines must be service_role-only.

revoke all on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.seller_create_product(text, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to service_role;

revoke all on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.seller_update_product(text, uuid, text, text, numeric, numeric, text, text, text, text[], boolean, boolean, boolean, boolean, boolean, text) to service_role;

revoke all on function public.seller_upsert_digital_content(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.seller_upsert_digital_content(text, uuid, text, text) to service_role;

revoke all on function public.seller_clear_digital_content(text, uuid) from public, anon, authenticated;
grant execute on function public.seller_clear_digital_content(text, uuid) to service_role;

revoke all on function public.ensure_digital_delivery(uuid) from public, anon, authenticated;
grant execute on function public.ensure_digital_delivery(uuid) to service_role;

revoke all on function public.seller_add_license_keys(text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.seller_add_license_keys(text, uuid, text[]) to service_role;

revoke all on function public.seller_deliver_digital(uuid, text) from public, anon, authenticated;
grant execute on function public.seller_deliver_digital(uuid, text) to service_role;

revoke all on function public.buyer_confirm_digital_delivery(text, uuid) from public, anon, authenticated;
grant execute on function public.buyer_confirm_digital_delivery(text, uuid) to service_role;

revoke all on function public.get_digital_library(text) from public, anon, authenticated;
grant execute on function public.get_digital_library(text) to service_role;

revoke all on function public.admin_update_order_status(text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_order_status(text, uuid, text) to service_role;

revoke all on function public.admin_moderate_product(text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_moderate_product(text, uuid, text) to service_role;

revoke all on function public.admin_update_product(text, uuid, text, text, numeric, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_update_product(text, uuid, text, text, numeric, text, text, text, text[]) to service_role;

revoke all on function public.admin_review_product(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_product(text, uuid, text, text) to service_role;

revoke all on function public.admin_get_dashboard_overview(text) from public, anon, authenticated;
grant execute on function public.admin_get_dashboard_overview(text) to service_role;
