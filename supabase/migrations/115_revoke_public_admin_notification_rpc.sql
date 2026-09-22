-- Admin notifications must only be sent through the Firebase-verified admin gateway.
revoke all on function public.admin_send_notification(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_send_notification(text, text, text, text, text) to service_role;
