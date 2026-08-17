-- BikriKoro — protect notification RPCs behind Firebase-verified server APIs
--
-- The web app authenticates with Firebase UID rather than Supabase Auth JWT.
-- These functions accept explicit user/admin IDs, so anonymous execution would
-- allow a caller to impersonate another UID. Browser callers now use
-- /api/notifications, where the Firebase ID token is verified server-side.

revoke all on function public.get_my_notifications(text, integer) from public;
revoke all on function public.get_my_notifications(text, integer) from anon;
grant execute on function public.get_my_notifications(text, integer) to service_role;

revoke all on function public.mark_notification_read(uuid, text) from public;
revoke all on function public.mark_notification_read(uuid, text) from anon;
grant execute on function public.mark_notification_read(uuid, text) to service_role;

revoke all on function public.get_my_unread_notification_count(text) from public;
revoke all on function public.get_my_unread_notification_count(text) from anon;
grant execute on function public.get_my_unread_notification_count(text) to service_role;

revoke all on function public.mark_all_notifications_read(text) from public;
revoke all on function public.mark_all_notifications_read(text) from anon;
grant execute on function public.mark_all_notifications_read(text) to service_role;

revoke all on function public.register_notification_push_token(text, text, text, text) from public;
revoke all on function public.register_notification_push_token(text, text, text, text) from anon;
grant execute on function public.register_notification_push_token(text, text, text, text) to service_role;

revoke all on function public.disable_notification_push_token(text, text) from public;
revoke all on function public.disable_notification_push_token(text, text) from anon;
grant execute on function public.disable_notification_push_token(text, text) to service_role;

revoke all on function public.admin_create_notification_campaign(text, text, text[], text, text, text, boolean) from public;
revoke all on function public.admin_create_notification_campaign(text, text, text[], text, text, text, boolean) from anon;
grant execute on function public.admin_create_notification_campaign(text, text, text[], text, text, text, boolean) to service_role;

revoke all on function public.admin_get_campaign_push_targets(text, uuid) from public;
revoke all on function public.admin_get_campaign_push_targets(text, uuid) from anon;
grant execute on function public.admin_get_campaign_push_targets(text, uuid) to service_role;

revoke all on function public.admin_record_push_delivery(text, uuid, text, text, text, text, text) from public;
revoke all on function public.admin_record_push_delivery(text, uuid, text, text, text, text, text) from anon;
grant execute on function public.admin_record_push_delivery(text, uuid, text, text, text, text, text) to service_role;

revoke all on function public.admin_finish_notification_campaign(text, uuid) from public;
revoke all on function public.admin_finish_notification_campaign(text, uuid) from anon;
grant execute on function public.admin_finish_notification_campaign(text, uuid) to service_role;

revoke all on function public.admin_list_notification_campaigns(text) from public;
revoke all on function public.admin_list_notification_campaigns(text) from anon;
grant execute on function public.admin_list_notification_campaigns(text) to service_role;
