-- =====================================================================
-- BikriKoro — OneSignal push subscription linkage
-- =====================================================================
-- Adds a column on `profiles` to store each user's current OneSignal
-- push subscription id (their "player id"). The app writes this right
-- after Firebase sign-in (see PushNotificationManager.kt) so any backend
-- job / Supabase Edge Function can later call the OneSignal REST API to
-- send a targeted notification to a specific user by looking up this id.
-- =====================================================================

alter table profiles
    add column if not exists onesignal_player_id text;

create index if not exists idx_profiles_onesignal_player_id
    on profiles (onesignal_player_id);

-- Users may only update their own subscription id. Since this project
-- doesn't use Supabase Auth (see 001_init.sql note on auth.uid()), this
-- reuses the same permissive-until-Supabase-Auth policy pattern as the
-- rest of the `profiles` table — tighten alongside the other policies
-- once Supabase Auth replaces Firebase Auth as the identity provider.
comment on column profiles.onesignal_player_id is
    'OneSignal push subscription id (player id) for the device this user last signed in on. Nullable — absent until the app successfully registers for push.';
