-- Seller verification submissions must derive identity from the Firebase-verified gateway.
revoke all on function public.submit_seller_registration_v3(text, text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_seller_registration_v3(text, text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
