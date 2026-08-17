-- BikriKoro — pin notification SECURITY DEFINER functions to a safe search_path

alter function public.register_notification_push_token(text, text, text, text) set search_path = public, pg_temp;
alter function public.disable_notification_push_token(text, text) set search_path = public, pg_temp;
alter function public.notify_user_event(text, text, text, text, text, jsonb) set search_path = public, pg_temp;
alter function public.notify_seller_verification_event() set search_path = public, pg_temp;
alter function public.notify_wallet_event() set search_path = public, pg_temp;
alter function public.notify_chat_message_event() set search_path = public, pg_temp;
alter function public.admin_create_notification_campaign(text, text, text[], text, text, text, boolean) set search_path = public, pg_temp;
alter function public.admin_get_campaign_push_targets(text, uuid) set search_path = public, pg_temp;
alter function public.admin_record_push_delivery(text, uuid, text, text, text, text, text) set search_path = public, pg_temp;
alter function public.admin_finish_notification_campaign(text, uuid) set search_path = public, pg_temp;
alter function public.admin_list_notification_campaigns(text) set search_path = public, pg_temp;
alter function public.get_my_unread_notification_count(text) set search_path = public, pg_temp;
alter function public.mark_all_notifications_read(text) set search_path = public, pg_temp;
