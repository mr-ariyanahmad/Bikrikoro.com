-- Seller inventory must be accessed through Firebase-verified server endpoints.
revoke all on function public.seller_list_products(text) from public, anon, authenticated;
revoke all on function public.seller_get_product(text, uuid) from public, anon, authenticated;
revoke all on function public.seller_archive_product(text, uuid) from public, anon, authenticated;
grant execute on function public.seller_list_products(text) to service_role;
grant execute on function public.seller_get_product(text, uuid) to service_role;
grant execute on function public.seller_archive_product(text, uuid) to service_role;
