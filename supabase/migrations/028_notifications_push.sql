-- BikriKoro — complete in-app + Firebase push notification backend

alter table public.notifications add column if not exists campaign_id uuid;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists idx_notifications_user_read_created on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_notifications_campaign on public.notifications(campaign_id);

create table if not exists public.notification_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'WEB',
  browser text not null default '',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_tokens_user_enabled on public.notification_push_tokens(user_id, enabled, last_seen_at desc);
alter table public.notification_push_tokens enable row level security;

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.profiles(id),
  target_type text not null check (target_type in ('ALL', 'CUSTOMERS', 'SELLERS', 'USER_LIST')),
  target_user_ids text[] not null default '{}',
  title text not null,
  body text not null,
  link text,
  send_push boolean not null default false,
  status text not null default 'IN_APP_SENT' check (status in ('IN_APP_SENT', 'PUSH_QUEUED', 'SENT', 'PARTIAL', 'FAILED')),
  recipient_count integer not null default 0,
  push_sent_count integer not null default 0,
  push_failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notification_campaigns_created on public.notification_campaigns(created_at desc);
alter table public.notification_campaigns enable row level security;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.notification_campaigns(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('IN_APP', 'PUSH')),
  token text,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'DELIVERED', 'FAILED', 'DISABLED')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists idx_notification_deliveries_campaign on public.notification_deliveries(campaign_id, channel, status);
create index if not exists idx_notification_deliveries_user on public.notification_deliveries(user_id, created_at desc);
alter table public.notification_deliveries enable row level security;

create or replace function public.register_notification_push_token(p_user_id text, p_token text, p_platform text default 'WEB', p_browser text default '') returns void as $$
begin
  if length(trim(coalesce(p_user_id, ''))) < 3 or length(trim(coalesce(p_token, ''))) < 20 then raise exception 'Invalid push token'; end if;
  insert into public.notification_push_tokens(user_id, token, platform, browser, enabled, last_seen_at)
  values (p_user_id, trim(p_token), upper(coalesce(p_platform, 'WEB')), coalesce(p_browser, ''), true, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, browser = excluded.browser, enabled = true, last_seen_at = now();
end;
$$ language plpgsql security definer;

create or replace function public.disable_notification_push_token(p_user_id text, p_token text) returns void as $$
begin
  update public.notification_push_tokens set enabled = false, last_seen_at = now() where user_id = p_user_id and token = p_token;
end;
$$ language plpgsql security definer;

create or replace function public.notify_user_event(p_user_id text, p_type text, p_title text, p_body text, p_link text default null, p_metadata jsonb default '{}'::jsonb) returns uuid as $$
declare v_id uuid;
begin
  if p_user_id is null or length(trim(coalesce(p_title, ''))) = 0 then return null; end if;
  insert into public.notifications(user_id, type, title, body, link, metadata)
  values (p_user_id, upper(coalesce(p_type, 'SYSTEM')), trim(p_title), coalesce(p_body, ''), p_link, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

create or replace function public.notify_seller_verification_event() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_user_event(new.user_id, 'VERIFICATION', 'সেলার verification আবেদন জমা হয়েছে', 'আপনার seller verification আবেদন admin review-এর জন্য পাঠানো হয়েছে।', '/become-seller/verify?mode=' || coalesce(new.listing_mode, 'DIGITAL'), jsonb_build_object('registration_id', new.id));
  elsif old.status is distinct from new.status then
    perform public.notify_user_event(new.user_id, 'VERIFICATION', case when new.status = 'APPROVED' then 'সেলার verification অনুমোদিত' when new.status = 'REJECTED' then 'সেলার verification-এ পরিবর্তন দরকার' else 'সেলার verification status আপডেট' end, coalesce(new.admin_note, 'আপনার verification আবেদন সম্পর্কে নতুন আপডেট আছে।'), '/become-seller/verify?mode=' || coalesce(new.listing_mode, 'DIGITAL'), jsonb_build_object('registration_id', new.id, 'status', new.status));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_seller_verification_event on public.seller_registrations;
create trigger trg_notify_seller_verification_event after insert or update of status on public.seller_registrations for each row execute function public.notify_seller_verification_event();

create or replace function public.notify_wallet_event() returns trigger as $$
begin
  perform public.notify_user_event(new.user_id, 'WALLET', case when new.amount >= 0 then 'ওয়ালেটে টাকা যোগ হয়েছে' else 'ওয়ালেট থেকে টাকা কাটা হয়েছে' end, coalesce(new.description, 'Wallet ledger-এ নতুন update হয়েছে।'), '/wallet', jsonb_build_object('ledger_id', new.id, 'amount', new.amount, 'type', new.type));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_wallet_event on public.wallet_ledger;
create trigger trg_notify_wallet_event after insert on public.wallet_ledger for each row execute function public.notify_wallet_event();

create or replace function public.notify_chat_message_event() returns trigger as $$
declare v_recipient text; v_product_id uuid;
begin
  select case when t.buyer_id = new.sender_id then t.seller_id else t.buyer_id end, t.product_id into v_recipient, v_product_id from public.chat_threads t where t.id = new.thread_id;
  if v_recipient is not null then
    perform public.notify_user_event(v_recipient, 'CHAT', 'নতুন chat message', left(new.text, 160), '/chat/' || new.thread_id::text, jsonb_build_object('thread_id', new.thread_id, 'product_id', v_product_id));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_chat_message_event on public.chat_messages;
create trigger trg_notify_chat_message_event after insert on public.chat_messages for each row execute function public.notify_chat_message_event();

create or replace function public.admin_create_notification_campaign(p_admin_id text, p_target_type text, p_target_user_ids text[], p_title text, p_body text, p_link text default null, p_send_push boolean default false) returns table(campaign_id uuid, recipient_count integer) as $$
declare v_campaign_id uuid; v_recipient_count integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  if p_target_type not in ('ALL', 'CUSTOMERS', 'SELLERS', 'USER_LIST') then raise exception 'Invalid notification target'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 or length(trim(coalesce(p_body, ''))) < 2 then raise exception 'Notification title and body are required'; end if;
  insert into public.notification_campaigns(created_by, target_type, target_user_ids, title, body, link, send_push, status)
  values (p_admin_id, p_target_type, coalesce(p_target_user_ids, '{}'), trim(p_title), trim(p_body), nullif(trim(coalesce(p_link, '')), ''), p_send_push, case when p_send_push then 'PUSH_QUEUED' else 'IN_APP_SENT' end)
  returning id into v_campaign_id;

  with recipients as (
    select p.id as user_id from public.profiles p where p.is_blocked = false and p_target_type = 'ALL'
    union
    select p.id from public.profiles p where p.is_blocked = false and p_target_type = 'CUSTOMERS' and not exists (select 1 from public.products pr where pr.seller_id = p.id) and not exists (select 1 from public.seller_registrations sr where sr.user_id = p.id and sr.status = 'APPROVED')
    union
    select p.id from public.profiles p where p.is_blocked = false and p_target_type = 'SELLERS' and (exists (select 1 from public.products pr where pr.seller_id = p.id) or exists (select 1 from public.seller_registrations sr where sr.user_id = p.id and sr.status = 'APPROVED'))
    union
    select p.id from public.profiles p where p.is_blocked = false and p_target_type = 'USER_LIST' and p.id = any(coalesce(p_target_user_ids, '{}'))
  ), inserted as (
    insert into public.notifications(user_id, type, title, body, link, campaign_id, metadata)
    select user_id, 'CAMPAIGN', trim(p_title), trim(p_body), nullif(trim(coalesce(p_link, '')), ''), v_campaign_id, jsonb_build_object('target_type', p_target_type)
    from recipients returning user_id
  )
  insert into public.notification_deliveries(campaign_id, user_id, channel, status, delivered_at)
  select v_campaign_id, user_id, 'IN_APP', 'DELIVERED', now() from inserted;

  select count(*) into v_recipient_count from public.notification_deliveries where campaign_id = v_campaign_id and channel = 'IN_APP';
  update public.notification_campaigns set recipient_count = v_recipient_count, updated_at = now() where id = v_campaign_id;
  perform public.admin_log(p_admin_id, 'CREATE_NOTIFICATION_CAMPAIGN', 'NOTIFICATION_CAMPAIGN', v_campaign_id::text, jsonb_build_object('target_type', p_target_type, 'recipient_count', v_recipient_count, 'send_push', p_send_push));
  return query select v_campaign_id, v_recipient_count;
end;
$$ language plpgsql security definer;

create or replace function public.admin_get_campaign_push_targets(p_admin_id text, p_campaign_id uuid) returns table(user_id text, token text) as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  return query select d.user_id, t.token from public.notification_deliveries d join public.notification_push_tokens t on t.user_id = d.user_id and t.enabled = true where d.campaign_id = p_campaign_id and d.channel = 'IN_APP' order by d.user_id, t.last_seen_at desc;
end;
$$ language plpgsql security definer;

create or replace function public.admin_record_push_delivery(p_admin_id text, p_campaign_id uuid, p_user_id text, p_token text, p_status text, p_provider_message_id text default null, p_error_message text default null) returns void as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  insert into public.notification_deliveries(campaign_id, user_id, channel, token, status, provider_message_id, error_message, delivered_at)
  values (p_campaign_id, p_user_id, 'PUSH', p_token, p_status, p_provider_message_id, p_error_message, case when p_status = 'DELIVERED' then now() else null end);
  if p_status = 'DISABLED' then update public.notification_push_tokens set enabled = false where user_id = p_user_id and token = p_token; end if;
end;
$$ language plpgsql security definer;

create or replace function public.admin_finish_notification_campaign(p_admin_id text, p_campaign_id uuid) returns void as $$
declare v_sent integer; v_failed integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  select count(*) filter (where status = 'DELIVERED'), count(*) filter (where status in ('FAILED', 'DISABLED')) into v_sent, v_failed from public.notification_deliveries where campaign_id = p_campaign_id and channel = 'PUSH';
  update public.notification_campaigns set push_sent_count = coalesce(v_sent, 0), push_failed_count = coalesce(v_failed, 0), status = case when coalesce(v_failed, 0) = 0 then 'SENT' when coalesce(v_sent, 0) > 0 then 'PARTIAL' else 'FAILED' end, updated_at = now() where id = p_campaign_id;
end;
$$ language plpgsql security definer;

create or replace function public.admin_list_notification_campaigns(p_admin_id text) returns setof public.notification_campaigns as $$
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  return query select * from public.notification_campaigns order by created_at desc limit 100;
end;
$$ language plpgsql security definer;

create or replace function public.get_my_unread_notification_count(p_user_id text) returns integer as $$
declare v_count integer;
begin
  select count(*) into v_count from public.notifications where user_id = p_user_id and is_read = false;
  return coalesce(v_count, 0);
end;
$$ language plpgsql security definer stable;

create or replace function public.mark_all_notifications_read(p_user_id text) returns integer as $$
declare v_count integer;
begin
  update public.notifications set is_read = true where user_id = p_user_id and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

DO $$ BEGIN
  alter publication supabase_realtime add table public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

