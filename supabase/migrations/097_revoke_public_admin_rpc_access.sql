-- Admin mutations must only be reachable through the Firebase-verified Vercel gateway.
revoke all on function public.admin_upsert_coupon(text, text, text, text, numeric, numeric, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.admin_upsert_coupon(text, text, text, text, numeric, numeric, integer, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.admin_delete_coupon(text, text) from public, anon, authenticated;
revoke all on function public.admin_count_admins(text) from public, anon, authenticated;
revoke all on function public.admin_access(text) from public, anon, authenticated;
revoke all on function public.admin_upsert_community_link(text, uuid, text, text, text, text, text, text[], text, integer) from public, anon, authenticated;
revoke all on function public.admin_delete_community_link(text, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_community_links(text) from public, anon, authenticated;
revoke all on function public.admin_assert_permission(text, text) from public, anon, authenticated;
